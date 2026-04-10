/** Contract: contracts/app/rules.md */

/**
 * App Toolbar Shell — shared header chrome for all editor views.
 *
 * Each HTML page declares <header class="toolbar" id="app-toolbar">.
 * Page-specific action buttons live in a <div class="toolbar-actions-slot">
 * inside that header. mountAppToolbar() rescues that slot, builds the
 * standard left chrome (logo + title) and right chrome (status + users),
 * then reassembles them into a consistent layout.
 *
 * Because IDs are preserved, existing JS that uses getElementById() or
 * querySelector('.toolbar-right') continues to work unchanged.
 */

const LOGO_SVG = `<svg class="logo-mark logo-mark--sm" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <rect x="2" y="3" width="16" height="20" rx="2.5" fill="var(--accent)" opacity="0.9"/>
  <path d="M14 3 L18 7 L18 23" fill="var(--accent-hover, var(--accent))" opacity="0.7"/>
  <line x1="5" y1="10" x2="13" y2="10" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="5" y1="14" x2="13" y2="14" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="5" y1="18" x2="10" y2="18" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
  <rect x="16" y="16" width="10" height="8" rx="1.5" fill="var(--accent)" opacity="0.85"/>
  <line x1="18" y1="20" x2="24" y2="20" stroke="white" stroke-width="1.25" stroke-linecap="round"/>
  <line x1="18" y1="22.5" x2="22" y2="22.5" stroke="white" stroke-width="1.25" stroke-linecap="round"/>
</svg>`;

export interface AppToolbarConfig {
  /**
   * Start users-section hidden. Use for editors (like the doc editor) that
   * show users only when collaborators are present. Defaults to false.
   */
  usersHidden?: boolean;
}

export interface AppToolbarRefs {
  /** The .toolbar-right div — prepend page-specific actions here via insertBefore(x, firstChild) */
  toolbarRightEl: HTMLElement;
  statusEl: HTMLElement;
  usersEl: HTMLElement;
  usersSectionEl: HTMLElement;
  titleInputEl: HTMLInputElement;
}

function buildLeft(): HTMLElement {
  const left = document.createElement('div');
  left.className = 'toolbar-left';

  const logoLink = document.createElement('a');
  logoLink.href = '/';
  logoLink.className = 'logo-link';
  logoLink.setAttribute('aria-label', 'OpenDesk — back to documents');
  logoLink.innerHTML = LOGO_SVG;

  const breadcrumb = document.createElement('span');
  breadcrumb.className = 'breadcrumb-sep';
  breadcrumb.setAttribute('aria-hidden', 'true');
  breadcrumb.textContent = '›';

  const titleInput = document.createElement('input');
  titleInput.id = 'doc-title';
  titleInput.className = 'doc-title-input';
  titleInput.type = 'text';
  titleInput.value = 'Loading...';
  titleInput.spellcheck = false;

  left.append(logoLink, breadcrumb, titleInput);
  return left;
}

function buildRight(actionsSlot: HTMLElement | null, usersHidden: boolean): {
  right: HTMLElement;
  statusEl: HTMLElement;
  usersEl: HTMLElement;
  usersSectionEl: HTMLElement;
} {
  const right = document.createElement('div');
  right.className = 'toolbar-right';

  if (actionsSlot) right.appendChild(actionsSlot);

  const sep = document.createElement('span');
  sep.className = 'toolbar-separator';
  right.appendChild(sep);

  const statusEl = document.createElement('span');
  statusEl.id = 'status';
  statusEl.className = 'status disconnected';
  statusEl.textContent = 'Connecting...';
  right.appendChild(statusEl);

  const usersSection = document.createElement('span');
  usersSection.className = 'users-section';
  usersSection.id = 'users-section';
  if (usersHidden) usersSection.hidden = true;

  const usersLabel = document.createElement('span');
  usersLabel.className = 'users-label';
  usersLabel.textContent = 'Editors:';

  const usersEl = document.createElement('span');
  usersEl.id = 'users';
  usersEl.className = 'users';

  usersSection.append(usersLabel, usersEl);
  right.appendChild(usersSection);

  return { right, statusEl, usersEl, usersSectionEl: usersSection };
}

export function mountAppToolbar(config: AppToolbarConfig = {}): AppToolbarRefs {
  const header = document.getElementById('app-toolbar') as HTMLElement | null;
  if (!header) throw new Error('[app-toolbar] No #app-toolbar element found in DOM');

  // Rescue slot content and optional center section before clearing
  const actionsSlot = header.querySelector<HTMLElement>('.toolbar-actions-slot');
  const centerEl = header.querySelector<HTMLElement>('.toolbar-center');
  actionsSlot?.remove();
  centerEl?.remove();
  header.innerHTML = '';

  header.setAttribute('role', 'banner');

  const left = buildLeft();
  const { right, statusEl, usersEl, usersSectionEl } = buildRight(
    actionsSlot,
    config.usersHidden ?? false,
  );

  header.appendChild(left);
  if (centerEl) header.appendChild(centerEl);
  header.appendChild(right);

  return {
    toolbarRightEl: right,
    statusEl,
    usersEl,
    usersSectionEl,
    titleInputEl: left.querySelector<HTMLInputElement>('#doc-title')!,
  };
}
