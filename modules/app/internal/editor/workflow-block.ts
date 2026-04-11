/** Contract: contracts/app/rules.md */
import { onLocaleChange } from '../i18n/index.ts';
import { getDocumentId } from '../shared/identity.ts';
import { formatRelativeTime } from '../shared/time-format.ts';
import { TRIGGER_LABELS, ACTION_LABELS, STATUS_ICONS, type WorkflowDef } from './workflow-types.ts';
import { fetchWorkflows, updateWorkflow, deleteWorkflow, fetchExecutions } from './workflow-api.ts';
import { buildCreateForm } from './workflow-form.ts';
import type { PanelBlock } from './panel-system.ts';

export function buildWorkflowsBlock(): PanelBlock {
  const docId = getDocumentId();
  const content = document.createElement('div');
  content.className = 'workflows-block';

  const list = document.createElement('div');
  list.className = 'workflows-block-list';

  async function refresh() {
    const workflows = await fetchWorkflows(docId);
    list.innerHTML = '';
    if (workflows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'workflows-block-empty';
      empty.textContent = 'No workflows configured';
      list.appendChild(empty);
      return;
    }
    for (const wf of workflows) {
      list.appendChild(renderCard(wf, refresh));
    }
  }

  const createForm = buildCreateForm(docId, refresh);
  content.append(createForm, list);

  refresh();
  const unsubLocale = onLocaleChange(() => refresh());

  return {
    id: 'workflows',
    title: 'Workflows',
    content,
    cleanup: unsubLocale,
  };
}

function renderCard(wf: WorkflowDef, onRefresh: () => void): HTMLElement {
  const card = document.createElement('div');
  card.className = `workflow-card${wf.active ? '' : ' workflow-card-inactive'}`;

  const header = document.createElement('div');
  header.className = 'workflow-card-header';

  const name = document.createElement('span');
  name.className = 'workflow-card-name';
  name.textContent = wf.name;

  const toggle = document.createElement('button');
  toggle.className = 'comment-action-btn';
  toggle.textContent = wf.active ? 'Active' : 'Paused';
  toggle.addEventListener('click', async () => {
    await updateWorkflow(wf.id, { active: !wf.active });
    onRefresh();
  });

  header.append(name, toggle);

  const meta = document.createElement('div');
  meta.className = 'workflow-card-meta';
  meta.textContent = `${TRIGGER_LABELS[wf.triggerType] ?? wf.triggerType} \u2192 ${ACTION_LABELS[wf.actionType] ?? wf.actionType}`;

  const actions = document.createElement('div');
  actions.className = 'workflow-card-actions';

  const historyBtn = document.createElement('button');
  historyBtn.className = 'comment-action-btn';
  historyBtn.textContent = 'History';
  historyBtn.addEventListener('click', async () => {
    const existing = card.querySelector('.workflow-executions');
    if (existing) { existing.remove(); return; }
    const execs = await fetchExecutions(wf.id);
    const execList = document.createElement('div');
    execList.className = 'workflow-executions';
    if (execs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'workflow-exec-empty';
      empty.textContent = 'No executions yet';
      execList.appendChild(empty);
    } else {
      for (const exec of execs) {
        const row = document.createElement('div');
        row.className = `workflow-exec-row workflow-exec-${exec.status}`;
        row.textContent = `${STATUS_ICONS[exec.status] ?? ''} ${exec.status} \u00B7 ${formatRelativeTime(exec.startedAt)}`;
        if (exec.error) {
          const err = document.createElement('div');
          err.className = 'workflow-exec-error';
          err.textContent = exec.error;
          row.appendChild(err);
        }
        execList.appendChild(row);
      }
    }
    card.appendChild(execList);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'comment-action-btn comment-action-delete';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm(`Delete workflow "${wf.name}"?`)) return;
    await deleteWorkflow(wf.id);
    onRefresh();
  });

  actions.append(historyBtn, deleteBtn);
  card.append(header, meta, actions);
  return card;
}
