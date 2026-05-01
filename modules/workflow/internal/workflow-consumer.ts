/** Contract: contracts/workflow/rules.md */
import type { Pool } from 'pg';
import { EventType, type DomainEvent, type EventBusModule } from '../../events/contract.ts';
import type { TriggerType } from '../contract.ts';
import { findByTrigger, findByTriggerType } from './workflow-store.ts';
import { createExecution, updateExecution } from './execution-store.ts';
import { runAction } from './action-runner.ts';
import { executeGraph } from './graph-executor.ts';
import { evalTriggerCondition, type TriggerEvalContext } from './trigger-condition-evaluator.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('workflow:consumer');

const EVENT_TO_TRIGGER: Partial<Record<string, TriggerType>> = {
  [EventType.DocumentUpdated]: 'document.updated',
  [EventType.ExportReady]: 'document.exported',
  [EventType.GrantCreated]: 'grant.created',
  [EventType.GrantRevoked]: 'grant.revoked',
  [EventType.DocumentVersionCreated]: 'document.version_created',
  [EventType.KBEntityChanged]: 'kb_entity.changed',
  [EventType.FormSubmitted]: 'form.submitted',
};

const SUBSCRIBED_EVENTS = [
  EventType.DocumentUpdated,
  EventType.ExportReady,
  EventType.GrantCreated,
  EventType.GrantRevoked,
  EventType.DocumentVersionCreated,
  EventType.KBEntityChanged,
  EventType.FormSubmitted,
] as const;

/**
 * Build the TriggerEvalContext for condition-based trigger types.
 * Events are thin (no payload), so we receive a pre-built context
 * from the consumer loop instead of fetching here — the caller owns
 * data fetching so this module stays I/O-free for testability.
 */
function isConditionTrigger(triggerType: TriggerType): boolean {
  return (
    triggerType === 'document.version_created' ||
    triggerType === 'kb_entity.changed' ||
    triggerType === 'form.submitted'
  );
}

export type EventContextFetcher = (
  event: DomainEvent,
  triggerType: TriggerType,
) => Promise<TriggerEvalContext | null>;

export function createWorkflowConsumer(
  pool: Pool,
  eventBus: EventBusModule,
  /** Optional fetcher for trigger condition contexts. When not provided, condition
   * evaluation is skipped and the workflow fires unconditionally (safe default for
   * legacy trigger types that have no triggerConditions). */
  fetchContext?: EventContextFetcher,
) {
  async function handleEvent(event: DomainEvent): Promise<void> {
    const triggerType = EVENT_TO_TRIGGER[event.type];
    if (!triggerType) return;

    // Document-scoped triggers: query by (trigger_type, document_id)
    // Cross-domain triggers (KB, form): query by trigger_type alone, then filter by conditions
    const definitions = isConditionTrigger(triggerType)
      ? await findByTriggerType(pool, triggerType)
      : await findByTrigger(pool, triggerType, event.aggregateId);

    if (definitions.length === 0) return;

    // Fetch entity context once per event if this is a condition-based trigger type
    let evalContext: TriggerEvalContext | null = null;
    if (isConditionTrigger(triggerType) && fetchContext) {
      try {
        evalContext = await fetchContext(event, triggerType);
      } catch (err) {
        log.error('failed to fetch trigger eval context', {
          eventId: event.id, triggerType, error: String(err),
        });
        return;
      }
    }

    for (const def of definitions) {
      // Evaluate pre-trigger conditions when present
      if (def.triggerConditions && evalContext) {
        try {
          const passes = evalTriggerCondition(def.triggerConditions, evalContext);
          if (!passes) continue;
        } catch (err) {
          log.warn('trigger condition evaluation error — skipping workflow', {
            workflowId: def.id, eventId: event.id, error: String(err),
          });
          continue;
        }
      }

      const execution = await createExecution(pool, def.id, event.id, 'running');
      try {
        if (def.graph && def.graph.nodes.length > 0) {
          await executeGraph(pool, execution.id, def.graph, event);
        } else {
          await runAction(def.actionType, def.actionConfig, event, { pool });
        }
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
