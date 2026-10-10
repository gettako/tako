import { GET as getLogsHandler } from '@/app/api/sse/deployments/[id]/logs/route';

export const dynamic = 'force-dynamic';

export const GET = getLogsHandler;
