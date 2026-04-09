/** Contract: contracts/app/rules.md */
import { onLocaleChange } from '../i18n/index.ts';
import { getDocumentId } from '../shared/identity.ts';
import { formatRelativeTime } from '../shared/time-format.ts';
import { TRIGGER_LABELS, ACTION_LABELS, STATUS_ICONS, type WorkflowDef } from './workflow-types.ts';
import { fetchWorkflows, updateWorkflow, deleteWorkflow, fetchExecutions } from './workflow-api.ts';
import { buildCreateForm } from './workflow-form.ts';

// --- Rendering ---

function renderWorkflowCard(
  wf: WorkflowDef,
  onRefresh: () => void,
): HTMLElement {
  const card = document.createElement('div');
  card.className = `workflow-card${wf.active ? '' : ' workflow-card-inactive'}`;

  const header = document.createElement('div');
  header.className = 'workflow-card-header';

  const name = document.createElement('span');
  name.className = 'workflow-card-name';
  name.textContent = wf.name;

  const toggle = document.createElement('button');
  toggle.className = 'workflow-toggle-btn';
  toggle.textContent = wf.active ? 'Active' : 'Paused';
  toggle.title = wf.active ? 'Click to pause' : 'Click to activate';
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
  historyBtn.className = 'workflow-action-btn';
  historyBtn.textContent = 'History';
  historyBtn.addEventListener('click', async () => {
    const existing = card.querySelector('.workflow-executions');
    if (existing) { existing.remove(); return; }

    const execs = await fetchExecutions(wf.id);
    const list = document.createElement('div');
    list.className = 'workflow-executions';

    if (execs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'workflow-exec-empty';
      empty.textContent = 'No executions yet';
      list.appendChild(empty);
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
        list.appendChild(row);
      }
    }
    card.appendChild(list);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'workflow-action-btn workflow-action-delete';
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

// --- Sidebar ---

/**
 * Build the workflow editor sidebar panel.
 */
export function buildWorkflowPanel(): HTMLElement {
  const docId = getDocumentId();
  const sidebar = document.createElement('aside');
  sidebar.className = 'workflow-sidebar';
  sidebar.setAttribute('aria-label', 'Workflows');

  const headerEl = document.createElement('div');
  headerEl.className = 'workflow-sidebar-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'workflow-sidebar-title';
  titleEl.textContent = 'Workflows';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'workflow-sidebar-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.addEventListener('click', () => toggleWorkflowPanel(sidebar, false));

  headerEl.append(titleEl, closeBtn);

  const listEl = document.createElement('div');
  listEl.className = 'workflow-sidebar-list';

  async function refresh() {
    const workflows = await fetchWorkflows(docId);
    listEl.innerHTML = '';
    if (workflows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'workflow-sidebar-empty';
      empty.textContent = 'No workflows configured';
      listEl.appendChild(empty);
    } else {
      for (const wf of workflows) {
        listEl.appendChild(renderWorkflowCard(wf, refresh));
      }
    }
  }

  const createForm = buildCreateForm(docId, refresh);

  sidebar.append(headerEl, createForm, listEl);

  sidebar.addEventListener('workflow-sidebar-open', () => { refresh(); });

  onLocaleChange(() => {
    titleEl.textContent = 'Workflows';
    refresh();
  });

  return sidebar;
}

/** Toggle the workflow sidebar open/closed. */
export function toggleWorkflowPanel(sidebar: HTMLElement, force?: boolean): void {
  const isOpen = force ?? !sidebar.classList.contains('workflow-sidebar-open');
  sidebar.classList.toggle('workflow-sidebar-open', isOpen);
  if (isOpen) {
    sidebar.dispatchEvent(new CustomEvent('workflow-sidebar-open'));
  }
}
