import {
  mockProjects,
  mockServices,
  mockNodes,
  mockDeployments,
  mockAuditLogs,
  mockNotifications,
} from './data';
import { Project, Service, Node, Deployment, AuditLog, Notification } from '@/lib/types';
import { setProjectsMockData } from '@/lib/api/projects';
import { setServicesMockData } from '@/lib/api/services';
import { setNodesMockData } from '@/lib/api/nodes';
import { setDeploymentsMockData } from '@/lib/api/deployments';
import { setAuditLogsMockData } from '@/lib/api/audit';
import { setNotificationsMockData } from '@/lib/api/settings';

export type ScenarioType = 'normal' | 'errors' | 'empty';

let currentScenario: ScenarioType = 'normal';

// Scenario Data: Many Errors
const errorProjects: Project[] = mockProjects.map((p, idx) => ({
  ...p,
  status: idx === 0 ? 'degraded' : idx === 1 ? 'unhealthy' : p.status,
  healthyServicesCount: Math.max(0, p.healthyServicesCount - 2),
}));

const errorServices: Service[] = mockServices.map((s, idx) => {
  if (idx === 0) {
    return {
      ...s,
      status: 'unhealthy',
      usage: { ...s.usage, cpuPercent: 96, memoryUsedMb: 980 },
    };
  }
  if (idx === 1) {
    return {
      ...s,
      status: 'degraded',
      usage: { ...s.usage, cpuPercent: 88, memoryUsedMb: 850 },
    };
  }
  if (idx === 4) {
    return {
      ...s,
      status: 'unhealthy',
      usage: { ...s.usage, cpuPercent: 0, memoryUsedMb: 0 },
    };
  }
  return s;
});

const errorNodes: Node[] = mockNodes.map((n, idx) => {
  if (idx === 0) {
    return {
      ...n,
      status: 'degraded',
      usage: { ...n.usage, cpuPercent: 94, memoryUsedMb: 31000 },
    };
  }
  return {
    ...n,
    status: 'offline',
    usage: { ...n.usage, cpuPercent: 0, memoryUsedMb: 0 },
  };
});

const errorDeployments: Deployment[] = [
  {
    id: 'dep-err-1',
    serviceId: 'srv-1',
    serviceName: 'web-frontend',
    commitHash: 'f49a12c',
    commitMessage: 'fix: updated API client connection timeout',
    branch: 'main',
    author: 'Alex Chen',
    status: 'failed',
    startedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    finishedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    steps: [
      { name: 'Queued', status: 'success', durationMs: 450 },
      { name: 'Clone', status: 'success', durationMs: 2300 },
      {
        name: 'Build',
        status: 'failed',
        durationMs: 14200,
        logs: [
          'Step 5/8 : RUN npm run build',
          'TypeScript compiler error TS2307: Cannot find module @/lib/auth',
          'npm error code ELIFECYCLE',
          'npm error errno 1',
        ],
      },
      { name: 'Push/Load image', status: 'pending' },
      { name: 'Deploy', status: 'pending' },
      { name: 'Health check', status: 'pending' },
      { name: 'Live', status: 'pending' },
    ],
  },
  ...mockDeployments,
];

const errorNotifications: Notification[] = [
  {
    id: 'notif-err-1',
    title: 'Cluster Critical: 2 of 3 Nodes Offline',
    message: 'Nodes tako-worker-01 and tako-edge-01 are unresponsive. Container workloads re-scheduling failed.',
    type: 'error',
    read: false,
    timestamp: new Date().toISOString(),
    link: '/nodes',
  },
  {
    id: 'notif-err-2',
    title: 'Deployment Failed: web-frontend',
    message: 'Build phase terminated with exit code 1. TypeScript compilation error.',
    type: 'error',
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    link: '/projects/proj-1/services/srv-1',
  },
  {
    id: 'notif-err-3',
    title: 'High CPU Load: tako-control-01',
    message: 'Control plane host CPU consumption exceeded 90% threshold for >15 minutes.',
    type: 'warning',
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    link: '/monitoring',
  },
  ...mockNotifications,
];

export function getCurrentScenario(): ScenarioType {
  return currentScenario;
}

export function applyScenario(scenario: ScenarioType): void {
  currentScenario = scenario;

  switch (scenario) {
    case 'empty':
      setProjectsMockData([]);
      setServicesMockData([]);
      setNodesMockData([]);
      setDeploymentsMockData([]);
      setAuditLogsMockData([]);
      setNotificationsMockData([]);
      break;

    case 'errors':
      setProjectsMockData(errorProjects);
      setServicesMockData(errorServices);
      setNodesMockData(errorNodes);
      setDeploymentsMockData(errorDeployments);
      setAuditLogsMockData(mockAuditLogs);
      setNotificationsMockData(errorNotifications);
      break;

    case 'normal':
    default:
      setProjectsMockData(mockProjects);
      setServicesMockData(mockServices);
      setNodesMockData(mockNodes);
      setDeploymentsMockData(mockDeployments);
      setAuditLogsMockData(mockAuditLogs);
      setNotificationsMockData(mockNotifications);
      break;
  }
}
