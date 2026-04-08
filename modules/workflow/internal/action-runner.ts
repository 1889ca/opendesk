/** Contract: contracts/workflow/rules.md */
import type { DomainEvent } from '../../events/contract.ts';
import type {
  ActionType,
  WebhookConfig,
  ExportConfig,
  NotifyConfig,
  SetMetadataConfig,
  MoveToFolderConfig,
  ChangeStatusConfig,
  SendEmailConfig,
} from '../contract.ts';
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

function runSetMetadata(config: SetMetadataConfig, event: DomainEvent): void {
  log.info('set_metadata action triggered', {
    key: config.key, value: config.value,
    eventId: event.id, aggregateId: event.aggregateId,
  });
}

function runMoveToFolder(config: MoveToFolderConfig, event: DomainEvent): void {
  log.info('move_to_folder action triggered', {
    folderId: config.folderId,
    eventId: event.id, aggregateId: event.aggregateId,
  });
}

function runChangeStatus(config: ChangeStatusConfig, event: DomainEvent): void {
  log.info('change_status action triggered', {
    status: config.status,
    eventId: event.id, aggregateId: event.aggregateId,
  });
}

function runSendEmail(config: SendEmailConfig, event: DomainEvent): void {
  log.info('send_email action triggered', {
    to: config.to, subject: config.subject,
    eventId: event.id, aggregateId: event.aggregateId,
  });
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
    case 'set_metadata':
      runSetMetadata(actionConfig as unknown as SetMetadataConfig, event);
      break;
    case 'move_to_folder':
      runMoveToFolder(actionConfig as unknown as MoveToFolderConfig, event);
      break;
    case 'change_status':
      runChangeStatus(actionConfig as unknown as ChangeStatusConfig, event);
      break;
    case 'send_email':
      runSendEmail(actionConfig as unknown as SendEmailConfig, event);
      break;
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}
