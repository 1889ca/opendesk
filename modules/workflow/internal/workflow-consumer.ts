/** Contract: contracts/workflow/rules.md */
import type { Pool } from 'pg';
import { EventType, type DomainEvent, type EventBusModule } from '../../events/contract.ts';
import type { TriggerType } from '../contract.ts';
import { findByTrigger } from './workflow-store.ts';
import { createExecution, updateExecution } from './execution-store.ts';
import { runAction } from './action-runner.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('workflow:consumer');

const EVENT_TO_TRIGGER: Partial<Record<string, TriggerType>> = {
  [EventType.DocumentUpdated]: 'document.updated',
  [EventType.ExportReady]: 'document.exported',
  [EventType.GrantCreated]: 'grant.created',
  [EventType.GrantRevoked]: 'grant.revoked',
};

const SUBSCRIBED_EVENTS = [
  EventType.DocumentUpdated,
  EventType.ExportReady,
  EventType.GrantCreated,
  EventType.GrantRevoked,
] as const;

export function createWorkflowConsumer(
  pool: Pool,
  eventBus: EventBusModule,
) {
  async function handleEvent(event: DomainEvent): Promise<void> {
    const triggerType = EVENT_TO_TRIGGER[event.type];
    if (!triggerType) return;

    const definitions = await findByTrigger(pool, triggerType, event.aggregateId);
    if (definitions.length === 0) return;

    for (const def of definitions) {
      const execution = await createExecution(pool, def.id, event.id, 'running');
      try {
        await runAction(def.actionType, def.actionConfig, event);
        await updateExecution(pool, execution.id, { status: 'completed' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await updateExecution(pool, execution.id, {
          status: 'failed',
          error: message,
        });
        log.error('execution failed', {
          executionId: execution.id, workflowId: def.id, error: message,
        });
      }
    }
  }

  async function start(): Promise<void> {
    await eventBus.subscribe(
      'workflow',
      [...SUBSCRIBED_EVENTS],
      handleEvent,
    );
  }

  return { start };
}
