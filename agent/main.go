package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/docker/docker/api/types/container"

	"gettako.dev/tako/agent/config"
	"gettako.dev/tako/agent/docker"
	"gettako.dev/tako/agent/traefik"
	"gettako.dev/tako/internal/protocol"
)

const agentVersion = "0.1.0"

type sessionSender struct {
	session *SessionClient
}

func (s *sessionSender) SendBuildLog(chunk *protocol.BuildLogChunk) error {
	return s.session.Send(&protocol.AgentMessage{
		Payload: &protocol.AgentMessage_BuildLog{
			BuildLog: chunk,
		},
	})
}

func (s *sessionSender) SendStatusTransition(transition *protocol.DeploymentStatusTransition) error {
	return s.session.Send(&protocol.AgentMessage{
		Payload: &protocol.AgentMessage_DeploymentStatus{
			DeploymentStatus: transition,
		},
	})
}

func (s *sessionSender) SendContainerLog(chunk *protocol.ContainerLogChunk) error {
	return s.session.Send(&protocol.AgentMessage{
		Payload: &protocol.AgentMessage_ContainerLog{
			ContainerLog: chunk,
		},
	})
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg := config.Load()

	slog.Info("Tako Agent starting",
		slog.String("version", agentVersion),
		slog.String("server_url", cfg.ServerURL),
		slog.String("config_dir", cfg.ConfigDir),
	)

	dockerCli, err := initDockerClient(cfg.DockerHost)
	if err != nil {
		slog.Error("docker initialization failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer dockerCli.Close()

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	vCtx, vCancel := context.WithTimeout(ctx, 3*time.Second)
	v, err := dockerCli.ServerVersion(vCtx)
	vCancel()
	if err != nil {
		slog.Error("failed to retrieve docker version", slog.String("error", err.Error()))
		os.Exit(1)
	}

	slog.Info("connected to docker daemon",
		slog.String("docker_version", v.Version),
		slog.String("api_version", v.APIVersion),
		slog.String("os", v.Os),
		slog.String("arch", v.Arch),
	)

	creds, err := ensureEnrollment(ctx, cfg, v.Version)
	if err != nil {
		slog.Error("enrollment failed", slog.String("error", err.Error()))
		os.Exit(1)
	}

	builder := docker.NewBuilder(dockerCli, "")
	runner := docker.NewRunner(dockerCli, nil)
	traefikGen := traefik.NewGenerator(filepath.Join(cfg.TraefikDynamicDir, "tako.yml"))
	traefikMgr := docker.NewTraefikManager(filepath.Join(cfg.TraefikDynamicDir, "tako.yml"))
	acmeTracker := traefik.NewACMETracker(cfg.TraefikAcmePath)
	customCfgMgr := traefik.NewCustomConfigManager(
		filepath.Join(cfg.TraefikDynamicDir, "custom.yaml"),
		"/etc/traefik/traefik.yaml",
		dockerCli,
	)

	cronScheduler := docker.NewCronScheduler(dockerCli)
	defer cronScheduler.Stop()

	switchover := docker.NewSwitchoverManager(dockerCli, traefikMgr, 10*time.Second)
	pipeline := docker.NewDeployPipeline(builder, runner, switchover, dockerCli, cronScheduler)
	composeManager := docker.NewComposeManager(dockerCli, builder, traefikMgr)
	pipeline.SetComposeManager(composeManager)
	hookExecutor := docker.NewHookExecutor(dockerCli)
	pipeline.SetHookExecutor(hookExecutor)
	terminalManager := docker.NewTerminalManager(dockerCli)
	backupManager := docker.NewBackupManager(dockerCli)
	pruner := docker.NewPruner(dockerCli)

	sender := &sessionSender{}

	var sessionClient *SessionClient
	sessionClient = NewSessionClient(creds, func(msg *protocol.ServerMessage) {
		if ack := msg.GetHeartbeatAck(); ack != nil {
			slog.Debug("received heartbeat ack", slog.Int64("timestamp", ack.GetTimestamp()))
		}

		if termStart := msg.GetTerminalStart(); termStart != nil {
			go terminalManager.StartSession(ctx, termStart, sessionClient)
		}

		if termData := msg.GetTerminalData(); termData != nil {
			terminalManager.WriteData(termData.GetSessionId(), termData.GetData())
		}

		if termResize := msg.GetTerminalResize(); termResize != nil {
			terminalManager.Resize(termResize.GetSessionId(), termResize.GetCols(), termResize.GetRows())
		}

		if termClose := msg.GetTerminalClose(); termClose != nil {
			terminalManager.CloseSession(termClose.GetSessionId())
		}

		if job := msg.GetDeployJob(); job != nil {
			slog.Info("received deploy job from server",
				slog.String("deployment_id", job.GetDeploymentId()),
				slog.String("service_id", job.GetServiceId()),
			)
			go func() {
				if err := pipeline.Execute(ctx, job, sender); err != nil {
					slog.Error("deploy pipeline execution failed",
						slog.String("deployment_id", job.GetDeploymentId()),
						slog.String("error", err.Error()),
					)
				}
			}()
		}

		if action := msg.GetContainerAction(); action != nil {
			slog.Info("received container action from server",
				slog.String("service_id", action.GetServiceId()),
				slog.String("action", action.GetAction()),
				slog.String("task_id", action.GetTaskId()),
			)
			go func() {
				msgText, err := handleContainerAction(ctx, dockerCli, traefikMgr, cronScheduler, action)
				taskAck := &protocol.TaskAck{
					TaskId:  action.GetTaskId(),
					Success: err == nil,
				}
				if err != nil {
					taskAck.Message = err.Error()
				} else if msgText != "" {
					taskAck.Message = msgText
				}
				_ = sessionClient.Send(&protocol.AgentMessage{
					Payload: &protocol.AgentMessage_TaskAck{
						TaskAck: taskAck,
					},
				})
			}()
		}

		if pruneCmd := msg.GetPruneCommand(); pruneCmd != nil {
			slog.Info("received prune command from server", slog.String("task_id", pruneCmd.GetTaskId()))
			go func() {
				res, err := pruner.Prune(ctx)
				taskAck := &protocol.TaskAck{
					TaskId:  pruneCmd.GetTaskId(),
					Success: err == nil,
				}
				if err != nil {
					taskAck.Message = err.Error()
				} else if res != nil {
					taskAck.ReclaimedBytes = res.ReclaimedBytes
					taskAck.Message = fmt.Sprintf("Pruned %d containers, %d images, %d cache entries (%d bytes freed)",
						res.ContainersDeleted, res.ImagesDeleted, res.CacheDeleted, res.ReclaimedBytes)
				}
				_ = sessionClient.Send(&protocol.AgentMessage{
					Payload: &protocol.AgentMessage_TaskAck{
						TaskAck: taskAck,
					},
				})
			}()
		}

		if checkSSL := msg.GetCheckSslCommand(); checkSSL != nil {
			slog.Info("received check ssl command", slog.String("domain", checkSSL.GetDomain()))
			certInfo := acmeTracker.CheckDomain(checkSSL.GetDomain())
			_ = sessionClient.Send(&protocol.AgentMessage{
				Payload: &protocol.AgentMessage_DomainSslReport{
					DomainSslReport: &protocol.DomainSSLReport{
						Statuses: []*protocol.DomainSSLStatus{
							{
								Domain:       certInfo.Domain,
								Status:       certInfo.Status,
								ErrorMessage: certInfo.ErrorMessage,
								ExpiresAt:    certInfo.ExpiresAt.Unix(),
							},
						},
						Timestamp: time.Now().Unix(),
					},
				},
			})
			_ = sessionClient.Send(&protocol.AgentMessage{
				Payload: &protocol.AgentMessage_TaskAck{
					TaskAck: &protocol.TaskAck{
						TaskId:  checkSSL.GetTaskId(),
						Success: certInfo.Status == "active",
						Message: certInfo.Status,
					},
				},
			})
		}

		if query := msg.GetTraefikConfigQuery(); query != nil {
			customYAML, staticYAML, err := customCfgMgr.GetConfigs()
			resp := &protocol.TraefikConfigResponse{
				TaskId:     query.GetTaskId(),
				CustomYaml: customYAML,
				StaticYaml: staticYAML,
				Success:    err == nil,
			}
			if err != nil {
				resp.ErrorMessage = err.Error()
			}
			_ = sessionClient.Send(&protocol.AgentMessage{
				Payload: &protocol.AgentMessage_TraefikConfigResponse{
					TraefikConfigResponse: resp,
				},
			})
		}

		if update := msg.GetTraefikConfigUpdate(); update != nil {
			err := customCfgMgr.SaveCustomConfig(update.GetCustomYaml())
			resp := &protocol.TraefikConfigResponse{
				TaskId:     update.GetTaskId(),
				CustomYaml: update.GetCustomYaml(),
				Success:    err == nil,
			}
			if err != nil {
				resp.ErrorMessage = err.Error()
			}
			_ = sessionClient.Send(&protocol.AgentMessage{
				Payload: &protocol.AgentMessage_TraefikConfigResponse{
					TraefikConfigResponse: resp,
				},
			})
		}

		if restart := msg.GetTraefikRestartCommand(); restart != nil {
			err := customCfgMgr.RestartTraefik(ctx)
			ack := &protocol.TaskAck{
				TaskId:  restart.GetTaskId(),
				Success: err == nil,
			}
			if err != nil {
				ack.Message = err.Error()
			}
			_ = sessionClient.Send(&protocol.AgentMessage{
				Payload: &protocol.AgentMessage_TaskAck{
					TaskAck: ack,
				},
			})
		}

		if backupCmd := msg.GetBackupCommand(); backupCmd != nil {
			slog.Info("received backup command from server",
				slog.String("task_id", backupCmd.GetTaskId()),
				slog.String("service_id", backupCmd.GetServiceId()),
				slog.String("backup_type", backupCmd.GetBackupType()),
			)
			go func() {
				sizeBytes, err := backupManager.ExecuteBackup(ctx, backupCmd)
				ack := &protocol.TaskAck{
					TaskId:          backupCmd.GetTaskId(),
					Success:         err == nil,
					BackupSizeBytes: sizeBytes,
				}
				if err != nil {
					ack.Message = err.Error()
				}
				_ = sessionClient.Send(&protocol.AgentMessage{
					Payload: &protocol.AgentMessage_TaskAck{
						TaskAck: ack,
					},
				})
			}()
		}

		if restoreCmd := msg.GetRestoreCommand(); restoreCmd != nil {
			slog.Info("received restore command from server",
				slog.String("task_id", restoreCmd.GetTaskId()),
				slog.String("service_id", restoreCmd.GetServiceId()),
			)
			go func() {
				err := backupManager.ExecuteRestore(ctx, restoreCmd)
				ack := &protocol.TaskAck{
					TaskId:  restoreCmd.GetTaskId(),
					Success: err == nil,
				}
				if err != nil {
					ack.Message = err.Error()
				}
				_ = sessionClient.Send(&protocol.AgentMessage{
					Payload: &protocol.AgentMessage_TaskAck{
						TaskAck: ack,
					},
				})
			}()
		}

		if syncCmd := msg.GetSyncIngressCommand(); syncCmd != nil {
			go func() {
				slog.Info("received sync ingress command",
					slog.String("task_id", syncCmd.GetTaskId()),
					slog.String("service_id", syncCmd.GetServiceId()),
					slog.Int("rules_count", len(syncCmd.GetRules())),
				)

				var err error
				if traefikMgr != nil {
					containers, listErr := dockerCli.ContainerList(ctx, container.ListOptions{})
					ip := ""
					port := int32(3000)
					if listErr == nil {
						for _, c := range containers {
							if c.Labels["tako.service_id"] == syncCmd.GetServiceId() {
								insp, inspectErr := dockerCli.ContainerInspect(ctx, c.ID)
								if inspectErr == nil {
									if net, ok := insp.NetworkSettings.Networks["tako_network"]; ok && net.IPAddress != "" {
										ip = net.IPAddress
									} else if insp.NetworkSettings.IPAddress != "" {
										ip = insp.NetworkSettings.IPAddress
									}
									if pStr, ok := c.Labels["tako.port"]; ok {
										var p int
										if _, scanErr := fmt.Sscanf(pStr, "%d", &p); scanErr == nil && p > 0 {
											port = int32(p)
										}
									}
									break
								}
							}
						}
					}

					if len(syncCmd.GetRules()) == 0 {
						err = traefikMgr.RemoveRoute(syncCmd.GetServiceId())
					} else {
						rules := make([]docker.IngressRule, 0, len(syncCmd.GetRules()))
						for _, r := range syncCmd.GetRules() {
							rPort := r.GetPort()
							if rPort <= 0 {
								rPort = port
							}
							rIP := ip
							if r.GetServiceId() != "" && r.GetServiceId() != syncCmd.GetServiceId() {
								for _, c := range containers {
									if c.Labels["tako.service_id"] == r.GetServiceId() {
										insp, inspectErr := dockerCli.ContainerInspect(ctx, c.ID)
										if inspectErr == nil {
											if net, ok := insp.NetworkSettings.Networks["tako_network"]; ok && net.IPAddress != "" {
												rIP = net.IPAddress
											} else if insp.NetworkSettings.IPAddress != "" {
												rIP = insp.NetworkSettings.IPAddress
											}
											break
										}
									}
								}
							}
							rules = append(rules, docker.IngressRule{
								RuleID:       r.GetRuleId(),
								Domain:       r.GetDomain(),
								ServiceID:    r.GetServiceId(),
								IP:           rIP,
								Port:         rPort,
								PathPrefix:   r.GetPathPrefix(),
								StripPrefix:  r.GetStripPrefix(),
								IsCanonical:  r.GetIsCanonical(),
								RedirectMode: r.GetRedirectMode(),
								AuthEnabled:  r.GetAuthEnabled(),
								AuthUser:     r.GetAuthUser(),
								AuthPassword: r.GetAuthPassword(),
								EntryPoints:  r.GetEntrypoints(),
								SSLResolver:  r.GetSslResolver(),
							})
						}
						err = traefikMgr.UpdateIngressRules(syncCmd.GetServiceId(), rules, ip, port)
					}
				}

				ack := &protocol.TaskAck{
					TaskId:  syncCmd.GetTaskId(),
					Success: err == nil,
				}
				if err != nil {
					ack.Message = err.Error()
				}
				_ = sessionClient.Send(&protocol.AgentMessage{
					Payload: &protocol.AgentMessage_TaskAck{
						TaskAck: ack,
					},
				})
			}()
		}
	})
	sender.session = sessionClient

	sampler := NewTelemetrySampler(dockerCli)

	go sessionClient.Run(ctx)
	go sampler.StartHeartbeatLoop(ctx, sessionClient, 15*time.Second)
	go sampler.StartServiceMetricsLoop(ctx, sessionClient, 30*time.Second)
	go pruner.StartScheduledPrune(ctx, 24*time.Hour)

	// Periodic SSL health check loop
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				routes := traefikGen.ListRoutes()
				var domains []string
				for _, r := range routes {
					domains = append(domains, r.Domains...)
				}
				if len(domains) == 0 {
					continue
				}
				scanned := acmeTracker.ScanAll(domains)
				statuses := make([]*protocol.DomainSSLStatus, 0, len(scanned))
				for _, s := range scanned {
					statuses = append(statuses, &protocol.DomainSSLStatus{
						Domain:       s.Domain,
						Status:       s.Status,
						ErrorMessage: s.ErrorMessage,
						ExpiresAt:    s.ExpiresAt.Unix(),
					})
				}
				_ = sessionClient.Send(&protocol.AgentMessage{
					Payload: &protocol.AgentMessage_DomainSslReport{
						DomainSslReport: &protocol.DomainSSLReport{
							Statuses:  statuses,
							Timestamp: time.Now().Unix(),
						},
					},
				})
			}
		}
	}()

	slog.Info("agent running, listening for server events...")
	<-ctx.Done()
	slog.Info("shutting down Tako Agent...")
}
