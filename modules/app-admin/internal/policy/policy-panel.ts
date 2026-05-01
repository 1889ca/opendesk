/** Contract: contracts/app-admin/policy.md */

import { apiFetch } from '@opendesk/app';
import { escapeHtml } from '../admin-helpers.ts';
import { DEFAULT_POLICY, type WorkspacePolicy } from './policy-types.ts';
import { validatePolicy, type ValidationIssue } from './policy-validators.ts';

/**
 * Skeleton "Policy" tab for the admin dashboard. Loads the workspace
 * policy from /api/admin/policies, renders compact section panels, and
 * saves back via PUT. Returns the root element so the dashboard can mount
 * it into its tab container.
 *
 * This is a read-only scaffold for sections beyond Retention + Watermark +
 * Branding; full per-section editors land in follow-up PRs.
 */

export async function buildPolicyPanel(workspaceId: string): Promise<HTMLElement> {
  const root = document.createElement('section');
  root.className = 'admin-policy';
  root.innerHTML = '<h2>Workspace Policy</h2><div class="admin-policy-body"></div>';
  const body = root.querySelector('.admin-policy-body') as HTMLElement;

  const policy = await loadPolicy(workspaceId);
  renderSections(body, policy, (next) => savePolicy(workspaceId, next, body));

  return root;
}

async function loadPolicy(workspaceId: string): Promise<WorkspacePolicy> {
  try {
    const res = await apiFetch(`/api/admin/policies?workspace_id=${encodeURIComponent(workspaceId)}`);
    if (!res.ok) throw new Error(`load failed: ${res.status}`);
    return (await res.json()) as WorkspacePolicy;
  } catch {
    return {
      workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
      ...DEFAULT_POLICY,
    };
  }
}

async function savePolicy(
  workspaceId: string,
  next: WorkspacePolicy,
  body: HTMLElement,
): Promise<void> {
  const issues = validatePolicy(next);
  if (issues.length > 0) {
    surfaceIssues(body, issues);
    return;
  }

  const res = await apiFetch(`/api/admin/policies?workspace_id=${encodeURIComponent(workspaceId)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(next),
  });

  if (res.status === 409) {
    surfaceIssues(body, [{ path: '', message: 'Policy changed in another tab. Reload and retry.' }]);
    return;
  }
  if (!res.ok) {
    surfaceIssues(body, [{ path: '', message: `Save failed (${res.status}).` }]);
    return;
  }

  surfaceIssues(body, []);
}

function surfaceIssues(body: HTMLElement, issues: ValidationIssue[]): void {
  const existing = body.querySelector('.admin-policy-issues');
  if (existing) existing.remove();
  if (issues.length === 0) return;

  const list = document.createElement('ul');
  list.className = 'admin-policy-issues';
  for (const issue of issues) {
    const li = document.createElement('li');
    li.textContent = issue.path ? `${issue.path}: ${issue.message}` : issue.message;
    list.appendChild(li);
  }
  body.prepend(list);
}

function renderSections(
  body: HTMLElement,
  policy: WorkspacePolicy,
  onSave: (next: WorkspacePolicy) => void,
): void {
  body.innerHTML = `
    <p class="admin-policy-stamp">Last updated ${escapeHtml(policy.updated_at)}</p>
    <fieldset class="admin-policy-section">
      <legend>Retention (days)</legend>
      <label>Documents <input type="number" min="0" name="retention.documents_days" value="${policy.retention.documents_days ?? ''}" placeholder="forever"></label>
      <label>Audit <input type="number" min="0" name="retention.audit_days" value="${policy.retention.audit_days ?? ''}" placeholder="forever"></label>
      <label>Erasure grace <input type="number" min="0" name="retention.erasure_grace_days" value="${policy.retention.erasure_grace_days}"></label>
    </fieldset>
    <fieldset class="admin-policy-section">
      <legend>Watermark</legend>
      <label><input type="checkbox" name="watermark.enabled" ${policy.watermark.enabled ? 'checked' : ''}> Enable</label>
      <label>Template <input type="text" name="watermark.text_template" value="${escapeHtml(policy.watermark.text_template)}"></label>
      <label>Opacity <input type="number" step="0.05" min="0.05" max="0.5" name="watermark.opacity" value="${policy.watermark.opacity}"></label>
    </fieldset>
    <fieldset class="admin-policy-section admin-policy-readonly">
      <legend>DLP, labels, branding, export rules</legend>
      <p>Full editors land in a follow-up PR. For now, manage via the policy API directly.</p>
    </fieldset>
    <button class="admin-policy-save" type="button">Save</button>
  `;

  const saveBtn = body.querySelector('.admin-policy-save') as HTMLButtonElement;
  saveBtn.addEventListener('click', () => {
    const next = readFormIntoPolicy(body, policy);
    onSave(next);
  });
}

function readFormIntoPolicy(body: HTMLElement, base: WorkspacePolicy): WorkspacePolicy {
  const get = (name: string) => body.querySelector<HTMLInputElement>(`[name="${name}"]`);
  const numOrNull = (v: string): number | null => (v === '' ? null : Number(v));

  const docsDays = get('retention.documents_days');
  const auditDays = get('retention.audit_days');
  const graceDays = get('retention.erasure_grace_days');
  const wmEnabled = get('watermark.enabled');
  const wmTemplate = get('watermark.text_template');
  const wmOpacity = get('watermark.opacity');

  return {
    ...base,
    retention: {
      documents_days: numOrNull(docsDays?.value ?? ''),
      audit_days: numOrNull(auditDays?.value ?? ''),
      erasure_grace_days: Number(graceDays?.value ?? base.retention.erasure_grace_days),
    },
    watermark: {
      enabled: Boolean(wmEnabled?.checked),
      text_template: wmTemplate?.value ?? base.watermark.text_template,
      opacity: Number(wmOpacity?.value ?? base.watermark.opacity),
    },
    updated_at: base.updated_at,
  };
}
