/** Contract: contracts/app/rules.md */

import type { KbEntryStatus } from '../../../kb/contract.ts';
import { STATUS_TRANSITIONS } from '../../../kb/contract.ts';

const STATUS_LABELS: Record<KbEntryStatus, string> = {
  draft: 'Draft',
  reviewed: 'Reviewed',
  published: 'Published',
  deprecated: 'Deprecated',
};

/**
 * Create a status badge element for a KB entry.
 */
export function createStatusBadge(status: KbEntryStatus): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = `kb-status-badge kb-status-${status}`;
  badge.textContent = STATUS_LABELS[status];
  badge.setAttribute('data-status', status);
  return badge;
}

/**
 * Create transition buttons for a KB entry based on its current status.
 * Returns an array of buttons (may be empty for terminal states).
 */
export function createTransitionButtons(
  status: KbEntryStatus,
  onTransition: (to: KbEntryStatus) => void,
): HTMLButtonElement[] {
  const targets = STATUS_TRANSITIONS[status];
  return targets.map((target: KbEntryStatus) => {
    const btn = document.createElement('button');
    btn.className = `btn btn-transition kb-transition-${target}`;
    btn.textContent = transitionLabel(status, target);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onTransition(target);
    });
    return btn;
  });
}

function transitionLabel(from: KbEntryStatus, to: KbEntryStatus): string {
  if (from === 'draft' && to === 'reviewed') return 'Submit for Review';
  if (from === 'reviewed' && to === 'published') return 'Publish';
  if (from === 'reviewed' && to === 'draft') return 'Reject';
  if (from === 'published' && to === 'deprecated') return 'Deprecate';
  return `Move to ${STATUS_LABELS[to]}`;
}
