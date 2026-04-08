/** Contract: contracts/observability/rules.md */

import type { ForensicsEvent } from './obs-api.ts';

/** Render forensics events as a timeline. */
export function renderForensicsTimeline(
  container: HTMLElement,
  events: ForensicsEvent[],
  onSelect: (event: ForensicsEvent) => void,
): void {
  container.innerHTML = '';

  if (events.length === 0) {
    container.innerHTML = '<div class="obs-empty">No events match the query.</div>';
    return;
  }

  for (const event of events) {
    container.appendChild(createTimelineRow(event, onSelect));
  }
}

function createTimelineRow(
  event: ForensicsEvent,
  onSelect: (e: ForensicsEvent) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'obs-timeline-event';

  const dot = document.createElement('div');
  dot.className = `obs-timeline-dot obs-timeline-dot--${event.contentType}`;

  const info = document.createElement('div');
  info.innerHTML = `
    <strong>${event.action}</strong> on <code>${event.resourceId}</code>
    <br><small>${event.actorId} (${event.actorType}) &mdash; ${event.eventType}</small>
  `;

  const time = document.createElement('div');
  time.className = 'obs-alert-time';
  time.textContent = new Date(event.occurredAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  row.appendChild(dot);
  row.appendChild(info);
  row.appendChild(time);

  row.addEventListener('click', () => onSelect(event));
  return row;
}

/** Show event detail in the side panel. */
export function showEventDetail(
  panel: HTMLElement,
  content: HTMLPreElement,
  event: ForensicsEvent,
): void {
  content.textContent = JSON.stringify(event, null, 2);
  panel.hidden = false;
}

/** Build the forensics query from DOM inputs. */
export function buildForensicsQuery(): Record<string, string> {
  const get = (id: string) => (document.getElementById(id) as HTMLInputElement)?.value ?? '';
  const query: Record<string, string> = {};
  const type = get('fr-type');
  const actor = get('fr-actor');
  const action = get('fr-action');
  const from = get('fr-from');
  const to = get('fr-to');

  if (type) query.contentType = type;
  if (actor) query.actorId = actor;
  if (action) query.action = action;
  if (from) query.from = new Date(from).toISOString();
  if (to) query.to = new Date(to).toISOString();

  return query;
}

/** Export forensics events as a downloadable JSON file. */
export function exportForensicsJson(events: ForensicsEvent[]): void {
  const json = JSON.stringify(events, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `forensics-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
