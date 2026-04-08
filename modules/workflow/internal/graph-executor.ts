/** Contract: contracts/workflow/rules.md */
import type { Pool } from 'pg';
import type { DomainEvent } from '../../events/contract.ts';
import type { WorkflowGraph, WorkflowNode, WorkflowEdge, ActionType } from '../contract.ts';
import { evaluateCondition } from './condition-evaluator.ts';
import { runAction } from './action-runner.ts';
import { createStep } from './step-store.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('workflow:graph');

type ExecutionContext = {
  pool: Pool;
  executionId: string;
  event: DomainEvent;
  eventContext: Record<string, unknown>;
};

function getOutgoingEdges(graph: WorkflowGraph, nodeId: string): WorkflowEdge[] {
  return graph.edges.filter((e) => e.sourceId === nodeId);
}

function findNode(graph: WorkflowGraph, nodeId: string): WorkflowNode | undefined {
  return graph.nodes.find((n) => n.id === nodeId);
}

function findTriggerNode(graph: WorkflowGraph): WorkflowNode | undefined {
  return graph.nodes.find((n) => n.type === 'trigger');
}

async function executeNode(
  ctx: ExecutionContext,
  graph: WorkflowGraph,
  node: WorkflowNode,
): Promise<void> {
  const start = performance.now();

  if (node.type === 'trigger') {
    const durationMs = Math.round(performance.now() - start);
    await createStep(ctx.pool, {
      executionId: ctx.executionId,
      nodeId: node.id,
      nodeType: 'trigger',
      input: { eventType: ctx.event.type },
      output: { matched: true },
      durationMs,
      status: 'evaluated',
    });
    const edges = getOutgoingEdges(graph, node.id);
    for (const edge of edges) {
      const target = findNode(graph, edge.targetId);
      if (target) await executeNode(ctx, graph, target);
    }
    return;
  }

  if (node.type === 'condition') {
    const config = node.config as {
      field?: string; operator?: string; value?: string;
    };
    const field = config.field ?? '';
    const operator = (config.operator ?? 'equals') as Parameters<typeof evaluateCondition>[1];
    const value = config.value ?? '';

    let result = false;
    let error: string | undefined;
    try {
      result = evaluateCondition(field, operator, value, ctx.eventContext);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const durationMs = Math.round(performance.now() - start);
    await createStep(ctx.pool, {
      executionId: ctx.executionId,
      nodeId: node.id,
      nodeType: 'condition',
      input: { field, operator, value },
      output: { result },
      durationMs,
      status: error ? 'failed' : 'evaluated',
      error,
    });

    if (error) return;

    const edges = getOutgoingEdges(graph, node.id);
    const trueEdges = edges.filter((e) => e.label === 'true' || e.label === 'yes');
    const falseEdges = edges.filter((e) => e.label === 'false' || e.label === 'no');
    const unlabeled = edges.filter((e) => !e.label);

    const follow = result ? [...trueEdges, ...unlabeled] : falseEdges;
    for (const edge of follow) {
      const target = findNode(graph, edge.targetId);
      if (target) await executeNode(ctx, graph, target);
    }
    return;
  }

  if (node.type === 'parallel_split') {
    const durationMs = Math.round(performance.now() - start);
    await createStep(ctx.pool, {
      executionId: ctx.executionId,
      nodeId: node.id,
      nodeType: 'parallel_split',
      input: null,
      output: null,
      durationMs,
      status: 'evaluated',
    });

    const edges = getOutgoingEdges(graph, node.id);
    await Promise.all(
      edges.map(async (edge) => {
        const target = findNode(graph, edge.targetId);
        if (target) await executeNode(ctx, graph, target);
      }),
    );
    return;
  }

  if (node.type === 'action') {
    const actionType = (node.config.actionType as ActionType) ?? 'notify';
    const actionConfig = (node.config.actionConfig as Record<string, unknown>) ?? {};
    let error: string | undefined;
    let status: 'executed' | 'failed' = 'executed';
    try {
      await runAction(actionType, actionConfig, ctx.event);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      status = 'failed';
    }
    const durationMs = Math.round(performance.now() - start);
    await createStep(ctx.pool, {
      executionId: ctx.executionId,
      nodeId: node.id,
      nodeType: 'action',
      input: { actionType, actionConfig },
      output: error ? { error } : { success: true },
      durationMs,
      status,
      error,
    });

    if (!error) {
      const edges = getOutgoingEdges(graph, node.id);
      for (const edge of edges) {
        const target = findNode(graph, edge.targetId);
        if (target) await executeNode(ctx, graph, target);
      }
    }
  }
}

/**
 * Execute a workflow graph starting from its trigger node.
 * Falls through the graph following edges and evaluating conditions.
 */
export async function executeGraph(
  pool: Pool,
  executionId: string,
  graph: WorkflowGraph,
  event: DomainEvent,
): Promise<void> {
  const trigger = findTriggerNode(graph);
  if (!trigger) {
    log.warn('graph has no trigger node', { executionId });
    return;
  }

  const eventContext: Record<string, unknown> = {
    event: {
      id: event.id,
      type: event.type,
      aggregateId: event.aggregateId,
      actorId: event.actorId,
      occurredAt: event.occurredAt,
    },
    document: { id: event.aggregateId },
    user: { id: event.actorId },
  };

  const ctx: ExecutionContext = {
    pool,
    executionId,
    event,
    eventContext,
  };

  await executeNode(ctx, graph, trigger);
}
