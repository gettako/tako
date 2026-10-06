export interface AuditActor {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface AuditLog {
  id: string;
  actor: AuditActor;
  action: string;
  targetType: 'service' | 'project' | 'node' | 'user' | 'settings';
  targetId: string;
  targetName: string;
  metadata?: Record<string, unknown>;
  ipAddress: string;
  timestamp: string;
}
