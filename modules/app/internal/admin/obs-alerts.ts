/** Contract: contracts/observability/rules.md */

import { acknowledgeAlert, type AnomalyAlert } from './obs-api.ts';

/** Render the alert list into a container. */
export function renderAlertList(
  container: HTMLElement,
  alerts: AnomalyAlert[],
  onRefresh: () => void,
): void {
  container.innerHTML = '';

  if (alerts.length === 0) {
    container.innerHTML = '<div class="obs-empty">No anomalies detected.</div>';
    return;
  }

  for (const alert of alerts) {
    container.appendChild(createAlertCard(alert, onRefresh));
  }
}

function createAlertCard(alert: AnomalyAlert, onRefresh: () => void): HTMLElement {
  const card = document.createElement('div');
  card.className = `obs-alert-card${alert.acknowledgedAt ? ' acknowledged' : ''}`;

  const badge = document.createElement('span');
  badge.className = `obs-severity obs-severity--${alert.severity}`;
  badge.textContent = alert.severity;

  const body = document.createElement('div');
  body.className = 'obs-alert-body';

  const metric = document.createElement('div');
  metric.className = 'obs-alert-metric';
  metric.textContent = `${alert.metric} (${alert.contentType})`;

  const message = document.createElement('div');
  message.className = 'obs-alert-message';
  message.textContent = alert.message;

  body.appendChild(metric);
  body.appendChild(message);

  const time = document.createElement('div');
  time.className = 'obs-alert-time';
  time.textContent = formatTime(alert.createdAt);

  const actions = document.createElement('div');
  actions.className = 'obs-alert-actions';

  if (!alert.acknowledgedAt) {
    const ackBtn = document.createElement('button');
    ackBtn.className = 'btn btn-secondary';
    ackBtn.textContent = 'Acknowledge';
    ackBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await acknowledgeAlert(alert.id);
        onRefresh();
      } catch (err) {
        console.error('Failed to acknowledge alert:', err);
      }
    });
    actions.appendChild(ackBtn);
  } else {
    const ackedLabel = document.createElement('span');
    ackedLabel.style.fontSize = '0.6875rem';
    ackedLabel.style.color = 'var(--text-secondary)';
    ackedLabel.textContent = `Acked by ${alert.acknowledgedBy}`;
    actions.appendChild(ackedLabel);
  }

  card.appendChild(badge);
  card.appendChild(body);
  card.appendChild(time);
  card.appendChild(actions);

  return card;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
