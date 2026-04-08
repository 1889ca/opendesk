/** Contract: contracts/app/rules.md */
import { apiFetch } from '../shared/api-client.ts';
import { t, onLocaleChange } from '../i18n/index.ts';
import { getDocumentId } from '../shared/identity.ts';
import { formatRelativeTime } from '../shared/time-format.ts';

// --- Types ---

interface WorkflowDef {
  id: string;
  documentId: string;
  name: string;
  triggerType: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
  active: boolean;
  createdBy: string;
  createdAt: string;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

const TRIGGER_LABELS: Record<string, string> = {
  'document.updated': 'Document Updated',
  'document.exported': 'Document Exported',
  'grant.created': 'Access Granted',
  'grant.revoked': 'Access Revoked',
};

const ACTION_LABELS: Record<string, string> = {
  webhook: 'Webhook',
  export: 'Export',
  notify: 'Notification',
};

const STATUS_ICONS: Record<string, string> = {
  pending: '\u23F3',
  running: '\u26A1',
  completed: '\u2705',
  failed: '\u274C',
};

// --- API ---

async function fetchWorkflows(docId: string): Promise<WorkflowDef[]> {
  const res = await apiFetch(`/api/workflows?documentId=${encodeURIComponent(docId)}`);
  if (!res.ok) return [];
  return res.json();
}

async function createWorkflow(data: Record<string, unknown>): Promise<WorkflowDef | null> {
  const res = await apiFetch('/api/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  return res.json();
}

async function updateWorkflow(id: string, data: Record<string, unknown>): Promise<boolean> {
  const res = await apiFetch(`/api/workflows/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.ok;
}

async function deleteWorkflow(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.ok;
}

async function fetchExecutions(workflowId: string): Promise<WorkflowExecution[]> {
  const res = await apiFetch(`/api/workflows/${encodeURIComponent(workflowId)}/executions?limit=20`);
  if (!res.ok) return [];
  return res.json();
}

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

function buildCreateForm(docId: string, onCreated: () => void): HTMLElement {
  const form = document.createElement('form');
  form.className = 'workflow-create-form';

  // Name
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Workflow name';
  nameInput.required = true;
  nameInput.maxLength = 200;
  nameInput.className = 'workflow-input';

  // Trigger select
  const triggerSelect = document.createElement('select');
  triggerSelect.className = 'workflow-select';
  for (const [value, label] of Object.entries(TRIGGER_LABELS)) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    triggerSelect.appendChild(opt);
  }

  // Action select
  const actionSelect = document.createElement('select');
  actionSelect.className = 'workflow-select';
  for (const [value, label] of Object.entries(ACTION_LABELS)) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    actionSelect.appendChild(opt);
  }

  // Dynamic config area
  const configArea = document.createElement('div');
  configArea.className = 'workflow-config-area';

  function updateConfigFields() {
    configArea.innerHTML = '';
    const action = actionSelect.value;
    if (action === 'webhook') {
      const urlInput = document.createElement('input');
      urlInput.type = 'url';
      urlInput.placeholder = 'Webhook URL (https://...)';
      urlInput.required = true;
      urlInput.className = 'workflow-input';
      urlInput.name = 'url';
      configArea.appendChild(urlInput);
    } else if (action === 'export') {
      const formatSelect = document.createElement('select');
      formatSelect.className = 'workflow-select';
      formatSelect.name = 'format';
      for (const fmt of ['docx', 'odt', 'pdf']) {
        const opt = document.createElement('option');
        opt.value = fmt;
        opt.textContent = fmt.toUpperCase();
        formatSelect.appendChild(opt);
      }
      configArea.appendChild(formatSelect);
    } else if (action === 'notify') {
      const msgInput = document.createElement('input');
      msgInput.type = 'text';
      msgInput.placeholder = 'Notification message';
      msgInput.required = true;
      msgInput.className = 'workflow-input';
      msgInput.name = 'message';
      configArea.appendChild(msgInput);
    }
  }

  actionSelect.addEventListener('change', updateConfigFields);
  updateConfigFields();

  // Submit
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'workflow-submit-btn';
  submitBtn.textContent = 'Create Workflow';

  const errorEl = document.createElement('div');
  errorEl.className = 'workflow-form-error';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const actionType = actionSelect.value;
    let actionConfig: Record<string, unknown> = {};
    if (actionType === 'webhook') {
      const urlEl = configArea.querySelector<HTMLInputElement>('[name="url"]');
      actionConfig = { url: urlEl?.value ?? '' };
    } else if (actionType === 'export') {
      const fmtEl = configArea.querySelector<HTMLSelectElement>('[name="format"]');
      actionConfig = { format: fmtEl?.value ?? 'pdf' };
    } else if (actionType === 'notify') {
      const msgEl = configArea.querySelector<HTMLInputElement>('[name="message"]');
      actionConfig = { message: msgEl?.value ?? '' };
    }

    const result = await createWorkflow({
      name: nameInput.value,
      documentId: docId,
      triggerType: triggerSelect.value,
      actionType,
      actionConfig,
    });

    if (result) {
      form.reset();
      updateConfigFields();
      onCreated();
    } else {
      errorEl.textContent = 'Failed to create workflow';
    }
  });

  form.append(nameInput, triggerSelect, actionSelect, configArea, errorEl, submitBtn);
  return form;
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
