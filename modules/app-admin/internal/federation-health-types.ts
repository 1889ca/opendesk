/** Contract: contracts/app-admin/rules.md */

export interface FederationPeerHealth {
  peer: {
    id: string;
    name: string;
    endpointUrl: string;
    trustLevel: string;
    status: string;
    lastSeenAt: string | null;
    registeredBy: string;
    createdAt: string;
  };
  lastSuccessfulSyncAt: string | null;
  conflictCount: number;
  failedRequestCount: number;
  connectionStatus: 'connected' | 'disconnected' | 'error';
}

export interface PingResult {
  peerId: string;
  reachable: boolean;
  latencyMs: number | null;
  error: string | null;
}

export function formatRelativeTime(isoStr: string | null): string {
  if (!isoStr) return 'Never';
  const diff = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function connectionStatusLabel(status: FederationPeerHealth['connectionStatus']): string {
  return { connected: 'Connected', disconnected: 'Disconnected', error: 'Error' }[status];
}
