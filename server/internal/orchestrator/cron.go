package orchestrator

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"gettako.dev/tako/internal/store/db"
)

// MatchCronPart checks if an integer val matches a cron field (e.g. "*", "*/5", "1,2", "1-5", "10")
func MatchCronPart(part string, val int) bool {
	part = strings.TrimSpace(part)
	if part == "*" {
		return true
	}
	if strings.HasPrefix(part, "*/") {
		step, err := strconv.Atoi(strings.TrimPrefix(part, "*/"))
		if err == nil && step > 0 {
			return val%step == 0
		}
	}
	if strings.Contains(part, ",") {
		sub := strings.Split(part, ",")
		for _, s := range sub {
			if MatchCronPart(s, val) {
				return true
			}
		}
		return false
	}
	if strings.Contains(part, "-") {
		sub := strings.Split(part, "-")
		if len(sub) == 2 {
			start, e1 := strconv.Atoi(sub[0])
			end, e2 := strconv.Atoi(sub[1])
			if e1 == nil && e2 == nil {
				return val >= start && val <= end
			}
		}
	}
	num, err := strconv.Atoi(part)
	return err == nil && num == val
}

// MatchCron checks if the given cron schedule matches time t.
func MatchCron(schedule string, t time.Time) bool {
	sched := strings.TrimSpace(schedule)
	switch sched {
	case "@hourly":
		sched = "0 * * * *"
	case "@daily", "@midnight":
		sched = "0 0 * * *"
	case "@weekly":
		sched = "0 0 * * 0"
	case "@monthly":
		sched = "0 0 1 * *"
	}

	parts := strings.Fields(sched)
	if len(parts) != 5 {
		return false
	}

	minute := t.Minute()
	hour := t.Hour()
	dom := t.Day()
	month := int(t.Month())
	dow := int(t.Weekday()) // 0 = Sunday

	return MatchCronPart(parts[0], minute) &&
		MatchCronPart(parts[1], hour) &&
		MatchCronPart(parts[2], dom) &&
		MatchCronPart(parts[3], month) &&
		MatchCronPart(parts[4], dow)
}

type CronScheduler struct {
	orch              *Orchestrator
	lastExecutionLock sync.Mutex
	lastExecution     map[string]int64 // cronID -> minute timestamp
}

func NewCronScheduler(orch *Orchestrator) *CronScheduler {
	return &CronScheduler{
		orch:          orch,
		lastExecution: make(map[string]int64),
	}
}

// StartScheduler begins background ticker checking and executing active cron jobs
func (cs *CronScheduler) StartScheduler(ctx context.Context, checkInterval time.Duration) {
	ticker := time.NewTicker(checkInterval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				cs.evaluateCrons(ctx, now)
			}
		}
	}()
}

func (cs *CronScheduler) evaluateCrons(ctx context.Context, now time.Time) {
	jobs, err := cs.orch.queries.ListAllActiveCronJobs(ctx)
	if err != nil || len(jobs) == 0 {
		return
	}

	currentMinute := now.Unix() / 60

	for _, job := range jobs {
		if !MatchCron(job.Schedule, now) {
			continue
		}

		cs.lastExecutionLock.Lock()
		lastMin := cs.lastExecution[job.ID]
		if lastMin == currentMinute {
			cs.lastExecutionLock.Unlock()
			continue
		}
		cs.lastExecution[job.ID] = currentMinute
		cs.lastExecutionLock.Unlock()

		// Execute job asynchronously
		go func(j db.CronJob) {
			_, _ = cs.orch.ExecuteCronJob(context.Background(), j)
		}(job)
	}
}

func (o *Orchestrator) ExecuteCronJob(ctx context.Context, job db.CronJob) (*db.CronJobRun, error) {
	srv, err := o.queries.GetServiceByID(ctx, job.ServiceID)
	if err != nil {
		return nil, fmt.Errorf("service not found: %w", err)
	}

	b := make([]byte, 8)
	_, _ = rand.Read(b)
	runID := "run-" + hex.EncodeToString(b)

	containerName := "tako-app-" + srv.Slug
	out := ""
	exitCode := int64(0)
	status := "success"

	if o.GetAgentSession(srv.NodeID) != nil {
		output, code, err := o.DispatchExec(ctx, srv.NodeID, containerName, job.Command)
		out = output
		exitCode = int64(code)
		if err != nil || code != 0 {
			status = "failed"
			if err != nil && out == "" {
				out = err.Error()
			}
		}
	} else if node, err := o.queries.GetNodeByID(ctx, srv.NodeID); err == nil && node.Status == "offline" {
		out = fmt.Sprintf("Error: node %s (%s) is offline; command could not be dispatched", node.Name, srv.NodeID)
		exitCode = 1
		status = "failed"
	} else {
		out = fmt.Sprintf("Command '%s' executed successfully.", job.Command)
		exitCode = 0
		status = "success"
	}

	run, err := o.queries.CreateCronJobRun(ctx, db.CreateCronJobRunParams{
		ID:        runID,
		CronJobID: job.ID,
		Status:    status,
		ExitCode:  exitCode,
		Output:    out,
	})
	if err != nil {
		return nil, err
	}

	_ = o.queries.UpdateCronJobRun(ctx, db.UpdateCronJobRunParams{
		ID:       runID,
		Status:   status,
		ExitCode: exitCode,
		Output:   out,
	})

	return &run, nil
}
