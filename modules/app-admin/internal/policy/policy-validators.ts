/** Contract: contracts/app-admin/policy.md */

import type { WorkspacePolicy } from './policy-types.ts';

export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * Client-side validation. The server re-validates every PUT and is the
 * final authority; this exists purely to disable the Save button and
 * surface inline errors fast.
 */
export function validatePolicy(p: WorkspacePolicy): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const { retention, export: exp, watermark } = p;

  if (retention.documents_days !== null && retention.documents_days < 0) {
    issues.push({ path: 'retention.documents_days', message: 'must be ≥ 0 or null (forever)' });
  }
  if (retention.audit_days !== null && retention.audit_days < 0) {
    issues.push({ path: 'retention.audit_days', message: 'must be ≥ 0 or null (forever)' });
  }
  if (retention.erasure_grace_days < 0) {
    issues.push({ path: 'retention.erasure_grace_days', message: 'must be ≥ 0' });
  }

  if (exp.require_approval_over_mb !== null && exp.require_approval_over_mb <= 0) {
    issues.push({ path: 'export.require_approval_over_mb', message: 'must be > 0 or null' });
  }

  if (watermark.opacity < 0.05 || watermark.opacity > 0.5) {
    issues.push({ path: 'watermark.opacity', message: 'must be between 0.05 and 0.5' });
  }

  for (let i = 0; i < p.dlp.blocked_regex.length; i++) {
    const pattern = p.dlp.blocked_regex[i];
    try {
      new RegExp(pattern);
    } catch (err) {
      issues.push({
        path: `dlp.blocked_regex[${i}]`,
        message: `invalid pattern: ${(err as Error).message}`,
      });
    }
  }

  for (let i = 0; i < p.sensitivity_labels.length; i++) {
    const label = p.sensitivity_labels[i];
    if (!/^#[0-9a-fA-F]{6}$/.test(label.color)) {
      issues.push({ path: `sensitivity_labels[${i}].color`, message: 'must be #rrggbb' });
    }
  }

  if (p.branding.accent_hex !== null && !/^#[0-9a-fA-F]{6}$/.test(p.branding.accent_hex)) {
    issues.push({ path: 'branding.accent_hex', message: 'must be #rrggbb or null' });
  }

  return issues;
}
