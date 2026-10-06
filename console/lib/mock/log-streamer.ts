import { DeploymentStepName } from '@/lib/types';
import { LogLine } from '@/components/ui/log-viewer';

export interface StepLogGroup {
  stepName: DeploymentStepName;
  logs: LogLine[];
}

export function getMockBuildLogs(serviceName: string, commitHash: string): StepLogGroup[] {
  return [
    {
      stepName: 'Queued',
      logs: [
        { message: `[tako-scheduler] Job enqueued at priority NORMAL for service "${serviceName}"`, level: 'info' },
        { message: '[tako-scheduler] Runner allocated: node-1 (tako-control-01)', level: 'info' },
        { message: '[tako-scheduler] Initializing pipeline execution environment...', level: 'info' },
      ],
    },
    {
      stepName: 'Clone',
      logs: [
        { message: `git clone --depth=50 --branch=main https://github.com/gettako/${serviceName}.git /workspace`, level: 'info' },
        { message: `Cloning into '/workspace' ...`, level: 'info' },
        { message: `remote: Enumerating objects: 142, done.`, level: 'info' },
        { message: `remote: Total 142 (delta 48), reused 120 (delta 35)`, level: 'info' },
        { message: `HEAD is now at ${commitHash} feat: automatic deployment pipeline commit`, level: 'info' },
        { message: `Repository checkout completed in 1.4s`, level: 'info' },
      ],
    },
    {
      stepName: 'Build',
      logs: [
        { message: `[buildkit] Using dockerfile: Dockerfile`, level: 'info' },
        { message: `[buildkit] #1 [internal] load build definition from Dockerfile`, level: 'info' },
        { message: `[buildkit] #2 [1/6] FROM node:22-alpine AS runner`, level: 'info' },
        { message: `[buildkit] #3 [2/6] WORKDIR /app`, level: 'info' },
        { message: `[buildkit] #4 [3/6] COPY package.json bun.lock ./`, level: 'info' },
        { message: `[buildkit] #5 [4/6] RUN bun install --frozen-lockfile`, level: 'info' },
        { message: `bun install v1.4.2: 412 packages installed [480ms]`, level: 'info' },
        { message: `[buildkit] #6 [5/6] COPY . .`, level: 'info' },
        { message: `[buildkit] #7 [6/6] RUN bun run build`, level: 'info' },
        { message: `▲ Next.js 16.3.8 (Turbopack)`, level: 'info' },
        { message: `✓ Compiled successfully in 3.4s`, level: 'info' },
        { message: `✓ Finished TypeScript in 420ms`, level: 'info' },
        { message: `Build artifact generated: size 42.8 MB`, level: 'info' },
      ],
    },
    {
      stepName: 'Push/Load image',
      logs: [
        { message: `Tagging image local/tako-${serviceName}:${commitHash}`, level: 'info' },
        { message: `Importing image into cluster containerd CRI namespace...`, level: 'info' },
        { message: `SHA256: 7f3a8b2c9d1e405a7c2b3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4`, level: 'info' },
        { message: `Image ready on node tako-control-01 (42.8 MB)`, level: 'info' },
      ],
    },
    {
      stepName: 'Deploy',
      logs: [
        { message: `Scheduling container rollout for tako-${serviceName}...`, level: 'info' },
        { message: `Applying ingress route definitions for domains`, level: 'info' },
        { message: `Starting container tako-${serviceName}-1 on port 3000`, level: 'info' },
        { message: `Container status: running [PID 12480]`, level: 'info' },
      ],
    },
    {
      stepName: 'Health check',
      logs: [
        { message: `Polling HTTP http://127.0.0.1:3000/api/health (attempt 1/10)...`, level: 'info' },
        { message: `HTTP 200 OK received in 18ms`, level: 'info' },
        { message: `Container passed readiness probe (status: healthy)`, level: 'info' },
      ],
    },
    {
      stepName: 'Live',
      logs: [
        { message: `Routing active traffic to new release ${commitHash}`, level: 'info' },
        { message: `Previous release container gracefully stopped`, level: 'info' },
        { message: `✓ Release successfully deployed and live!`, level: 'info' },
      ],
    },
  ];
}
