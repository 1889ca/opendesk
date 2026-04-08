/** Contract: contracts/workflow/rules.md */
import type { DomainEvent } from '../../events/contract.ts';
import type { ActionType, WebhookConfig, ExportConfig, NotifyConfig } from '../contract.ts';
import { createLogger } from '../../logger/index.ts';
import { httpFetch } from '../../http/index.ts';

const log = createLogger('workflow:action');

function buildEventPayload(event: DomainEvent): Record<string, unknown> {
  return {
    eventId: event.id,
    type: event.type,
    aggregateId: event.aggregateId,
    actorId: event.actorId,
    occurredAt: event.occurredAt,
  };
}

async function runWebhook(config: WebhookConfig, event: DomainEvent): Promise<void> {
  const response = await httpFetch(config.url, {
    method: 'POST',
    body: JSON.stringify(buildEventPayload(event)),
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
    timeoutMs: 10_000,
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
  }
}

function runExport(config: ExportConfig, event: DomainEvent): void {
  log.info('export action triggered', {
    format: config.format, eventId: event.id, aggregateId: event.aggregateId,
  });
}

function runNotify(config: NotifyConfig, event: DomainEvent): void {
  log.info('notify action triggered', { message: config.message, eventId: event.id });
}

export async function runAction(
  actionType: ActionType,
  actionConfig: Record<string, unknown>,
  event: DomainEvent,
): Promise<void> {
  switch (actionType) {
    case 'webhook':
      await runWebhook(actionConfig as unknown as WebhookConfig, event);
      break;
    case 'export':
      runExport(actionConfig as unknown as ExportConfig, event);
      break;
    case 'notify':
      runNotify(actionConfig as unknown as NotifyConfig, event);
      break;
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}
