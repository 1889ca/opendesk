/** Contract: contracts/workflow/rules.md */
import type { Pool } from 'pg';
import type { EventBusModule } from '../../events/contract.ts';
import type { WorkflowModule, CreateWorkflow, UpdateWorkflow } from '../contract.ts';
import * as store from './workflow-store.ts';
import * as execStore from './execution-store.ts';
import * as stepStore from './step-store.ts';
import { createWorkflowConsumer } from './workflow-consumer.ts';

export type WorkflowDependencies = {
  pool: Pool;
  eventBus: EventBusModule;
};

export function createWorkflow(deps: WorkflowDependencies): WorkflowModule {
  const { pool, eventBus } = deps;
  const consumer = createWorkflowConsumer(pool, eventBus);

  return {
    createDefinition(def: CreateWorkflow, createdBy: string) {
      return store.createDefinition(pool, def, createdBy);
    },
    getDefinition(id: string) {
      return store.getDefinition(pool, id);
    },
    listDefinitions(documentId: string) {
      return store.listDefinitions(pool, documentId);
    },
    listAllDefinitions() {
      return store.listAllDefinitions(pool);
    },
    updateDefinition(id: string, updates: UpdateWorkflow) {
      return store.updateDefinition(pool, id, updates);
    },
    deleteDefinition(id: string) {
      return store.deleteDefinition(pool, id);
    },
    listExecutions(workflowId: string, limit?: number) {
      return execStore.listExecutions(pool, workflowId, limit);
    },
    getExecutionLog(executionId: string) {
      return stepStore.listSteps(pool, executionId);
    },
    startConsuming() {
      return consumer.start();
    },
  };
}
