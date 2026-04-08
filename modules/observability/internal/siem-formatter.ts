/** Contract: contracts/observability/rules.md */

import type { ForensicsEvent, SiemFormat } from '../contract.ts';

/**
 * Format forensics events into a SIEM-compatible string.
 * Supports CEF (ArcSight/QRadar), syslog RFC 5424, and JSON lines (Splunk/Elastic).
 */
export function formatEvents(
  events: ForensicsEvent[],
  format: SiemFormat,
): string {
  switch (format) {
    case 'cef':
      return events.map(formatCef).join('\n');
    case 'syslog':
      return events.map(formatSyslog).join('\n');
    case 'jsonlines':
      return events.map(formatJsonLine).join('\n');
    default:
      throw new Error(`Unsupported SIEM format: ${format}`);
  }
}

/**
 * CEF (Common Event Format) — ArcSight, QRadar.
 * Format: CEF:0|vendor|product|version|signatureId|name|severity|extensions
 */
function formatCef(event: ForensicsEvent): string {
  const severity = mapSeverity(event.action);
  const extensions = [
    `src=${event.actorId}`,
    `dst=${event.resourceId}`,
    `rt=${new Date(event.occurredAt).getTime()}`,
    `cs1=${event.contentType}`,
    `cs1Label=contentType`,
    `cs2=${event.actorType}`,
    `cs2Label=actorType`,
  ].join(' ');

  return `CEF:0|OpenDesk|Observability|1.0|${event.eventType}|${event.action}|${severity}|${extensions}`;
}

/**
 * Syslog RFC 5424.
 * Format: <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID SD MSG
 */
function formatSyslog(event: ForensicsEvent): string {
  const pri = mapSyslogPriority(event.action);
  const timestamp = event.occurredAt;
  const hostname = 'opendesk';
  const appName = 'observability';
  const procId = '-';
  const msgId = event.eventType;
  const sd = `[opendesk@1 contentType="${event.contentType}" actorType="${event.actorType}" resourceId="${event.resourceId}"]`;
  const msg = `actor=${event.actorId} action=${event.action}`;

  return `<${pri}>1 ${timestamp} ${hostname} ${appName} ${procId} ${msgId} ${sd} ${msg}`;
}

/**
 * JSON lines — one JSON object per line (Splunk, Elastic).
 */
function formatJsonLine(event: ForensicsEvent): string {
  return JSON.stringify({
    timestamp: event.occurredAt,
    event_type: event.eventType,
    content_type: event.contentType,
    actor_id: event.actorId,
    actor_type: event.actorType,
    action: event.action,
    resource_id: event.resourceId,
    metadata: event.metadata ?? {},
  });
}

/** Map action to CEF severity (0-10). */
function mapSeverity(action: string): number {
  if (action.includes('delete') || action.includes('purge')) return 8;
  if (action.includes('export') || action.includes('download')) return 5;
  if (action.includes('create') || action.includes('update')) return 3;
  return 1;
}

/** Map action to syslog priority (facility 16 = local0). */
function mapSyslogPriority(action: string): number {
  const facility = 16; // local0
  let severity = 6; // informational
  if (action.includes('delete') || action.includes('purge')) severity = 3; // error
  else if (action.includes('export')) severity = 4; // warning
  return facility * 8 + severity;
}
