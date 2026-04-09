/** Contract: contracts/observability/rules.md */

const BASE = '/api/observability';

/** Fetch time-series metric buckets. */
export async function fetchTimeSeries(
  metric: string,
  from: string,
  to: string,
  bucketSeconds = 300,
): Promise<TimeSeriesBucket[]> {
  const params = new URLSearchParams({ metric, from, to, bucketSeconds: String(bucketSeconds) });
  const res = await fetch(`${BASE}/metrics/timeseries?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch time series: ${res.status}`);
  return res.json();
}

/** Trigger anomaly detection. */
export async function runDetection(): Promise<AnomalyAlert[]> {
  const res = await fetch(`${BASE}/anomalies/detect`, { method: 'POST' });
  if (!res.ok) throw new Error(`Detection failed: ${res.status}`);
  return res.json();
}

/** Acknowledge an anomaly alert. */
export async function acknowledgeAlert(id: string): Promise<void> {
  const res = await fetch(`${BASE}/anomalies/${id}/acknowledge`, { method: 'POST' });
  if (!res.ok) throw new Error(`Acknowledge failed: ${res.status}`);
}

/** Query forensics events. */
export async function fetchForensics(query: Record<string, string>): Promise<ForensicsEvent[]> {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(query).filter(([, v]) => v)),
  );
  const res = await fetch(`${BASE}/forensics?${params}`);
  if (!res.ok) throw new Error(`Forensics query failed: ${res.status}`);
  return res.json();
}

/** Download SIEM export. */
export async function downloadSiemExport(
  format: string,
  from: string,
  to: string,
): Promise<void> {
  const params = new URLSearchParams({ format, from, to });
  const res = await fetch(`${BASE}/siem/export?${params}`);
  if (!res.ok) throw new Error(`SIEM export failed: ${res.status}`);
  const blob = await res.blob();
  const ext = format === 'jsonlines' ? 'ndjson' : 'txt';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `siem-export-${format}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

/** List SIEM configs. */
export async function fetchSiemConfigs(): Promise<SiemConfig[]> {
  const res = await fetch(`${BASE}/siem/configs`);
  if (!res.ok) throw new Error(`Failed to fetch SIEM configs: ${res.status}`);
  return res.json();
}

/** Delete a SIEM config. */
export async function deleteSiemConfig(id: string): Promise<void> {
  const res = await fetch(`${BASE}/siem/configs/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete config failed: ${res.status}`);
}

// --- Shared types for the admin dashboard ---

export type TimeSeriesBucket = {
  bucket: string;
  metric: string;
  contentType: string;
  avg: number;
  min: number;
  max: number;
  count: number;
};

export type AnomalyAlert = {
  id: string;
  metric: string;
  contentType: string;
  value: number;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  detectionType: string;
  message: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
};

export type ForensicsEvent = {
  id: string;
  eventType: string;
  contentType: string;
  actorId: string;
  actorType: string;
  action: string;
  resourceId: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
};

export type SiemConfig = {
  id: string;
  name: string;
  format: string;
  mode: string;
  endpoint?: string;
  enabled: boolean;
  createdAt: string;
};
