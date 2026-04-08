/** Contract: contracts/workflow/rules.md */
import type { WorkflowExecution, ExecutionStepLog } from './types.ts';
import * as api from './workflow-api.ts';

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function statusBadge(status: string): HTMLElement {
  const badge = el('span', `wf-exec-status wf-exec-status--${status}`, status);
  return badge;
}

export function createExecutionLog(
  container: HTMLElement,
  workflowId: string,
) {
  let visible = false;

  async function renderExecutions() {
    container.innerHTML = '';

    const heading = el('h3', 'wf-exec-heading', 'Execution History');
    container.appendChild(heading);

    let executions: WorkflowExecution[];
    try {
      executions = await api.listExecutions(workflowId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      container.appendChild(el('p', 'wf-exec-error', `Failed to load: ${msg}`));
      return;
    }

    if (executions.length === 0) {
      container.appendChild(el('p', 'wf-exec-empty', 'No executions yet'));
      return;
    }

    for (const exec of executions) {
      const row = el('div', 'wf-exec-row');
      row.appendChild(statusBadge(exec.status));

      const time = el('span', 'wf-exec-time', formatTime(exec.startedAt));
      row.appendChild(time);

      if (exec.error) {
        const errEl = el('span', 'wf-exec-err', exec.error);
        row.appendChild(errEl);
      }

      const expandBtn = el('button', 'wf-exec-expand', 'Steps');
      const stepsContainer = el('div', 'wf-exec-steps');
      stepsContainer.style.display = 'none';

      expandBtn.addEventListener('click', async () => {
        if (stepsContainer.style.display === 'none') {
          stepsContainer.style.display = 'block';
          await renderSteps(stepsContainer, workflowId, exec.id);
          expandBtn.textContent = 'Hide';
        } else {
          stepsContainer.style.display = 'none';
          expandBtn.textContent = 'Steps';
        }
      });

      row.appendChild(expandBtn);
      container.appendChild(row);
      container.appendChild(stepsContainer);
    }
  }

  async function renderSteps(
    stepsEl: HTMLElement,
    wfId: string,
    execId: string,
  ) {
    stepsEl.innerHTML = '';
    let steps: ExecutionStepLog[];
    try {
      steps = await api.getExecutionSteps(wfId, execId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stepsEl.appendChild(el('p', 'wf-exec-error', `Failed: ${msg}`));
      return;
    }

    if (steps.length === 0) {
      stepsEl.appendChild(el('p', 'wf-exec-empty', 'No step logs'));
      return;
    }

    const table = document.createElement('table');
    table.className = 'wf-steps-table';
    table.innerHTML = `<thead><tr>
      <th>Node</th><th>Type</th><th>Status</th>
      <th>Duration</th><th>Output</th>
    </tr></thead>`;

    const tbody = document.createElement('tbody');
    for (const step of steps) {
      const tr = document.createElement('tr');
      tr.className = `wf-step--${step.status}`;
      tr.innerHTML = `
        <td>${step.nodeId}</td>
        <td>${step.nodeType}</td>
        <td>${step.status}</td>
        <td>${step.durationMs}ms</td>
        <td class="wf-step-output">${step.output ? JSON.stringify(step.output) : '-'}</td>
      `;
      if (step.error) {
        const errRow = document.createElement('tr');
        errRow.className = 'wf-step-error-row';
        errRow.innerHTML = `<td colspan="5" class="wf-step-error">${step.error}</td>`;
        tbody.appendChild(tr);
        tbody.appendChild(errRow);
      } else {
        tbody.appendChild(tr);
      }
    }
    table.appendChild(tbody);
    stepsEl.appendChild(table);
  }

  function toggle() {
    visible = !visible;
    container.style.display = visible ? 'block' : 'none';
    if (visible) renderExecutions();
  }

  function show() {
    visible = true;
    container.style.display = 'block';
    renderExecutions();
  }

  function hide() {
    visible = false;
    container.style.display = 'none';
  }

  container.style.display = 'none';
  return { toggle, show, hide, refresh: renderExecutions };
}
