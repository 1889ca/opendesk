/** Contract: contracts/app/rules.md */

export interface PanelBlock {
  id: string;
  title: string;
  content: HTMLElement;
  cleanup?: () => void;
}

export interface PanelRail {
  el: HTMLElement;
  toggle: (show?: boolean) => void;
  cleanup: () => void;
}

const RAIL_STATE_KEY = 'opendesk-panel-rail';

export function buildPanelRail(side: 'left' | 'right', blocks: PanelBlock[]): PanelRail {
  const rail = document.createElement('aside');
  rail.className = `panel-rail panel-rail--${side}`;
  rail.setAttribute('aria-label', `${side === 'left' ? 'Left' : 'Right'} panels`);

  const header = document.createElement('div');
  header.className = 'panel-rail-header';

  const title = document.createElement('span');
  title.className = 'panel-rail-title';
  title.textContent = 'Panels';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'panel-rail-close';
  closeBtn.setAttribute('aria-label', 'Close panels');
  closeBtn.textContent = '\u00d7';
  closeBtn.addEventListener('click', () => toggle(false));

  header.append(title, closeBtn);
  rail.appendChild(header);

  for (const block of blocks) {
    rail.appendChild(renderBlock(block));
  }

  document.body.appendChild(rail);

  syncChromeHeight();
  window.addEventListener('resize', syncChromeHeight);

  const saved = localStorage.getItem(`${RAIL_STATE_KEY}-${side}`);
  if (saved === 'open') rail.classList.add('is-open');

  function toggle(show?: boolean): void {
    const next = show ?? !rail.classList.contains('is-open');
    rail.classList.toggle('is-open', next);
    localStorage.setItem(`${RAIL_STATE_KEY}-${side}`, next ? 'open' : 'closed');
  }

  const cleanup = () => {
    window.removeEventListener('resize', syncChromeHeight);
    for (const block of blocks) block.cleanup?.();
    rail.remove();
  };

  return { el: rail, toggle, cleanup };
}

function syncChromeHeight(): void {
  const chrome = document.querySelector('.editor-top-chrome');
  if (chrome) {
    document.documentElement.style.setProperty(
      '--chrome-height', `${chrome.getBoundingClientRect().height}px`,
    );
  }
}

function renderBlock(block: PanelBlock): HTMLElement {
  const section = document.createElement('section');
  section.className = 'panel-block';
  section.id = `panel-${block.id}`;

  const saved = localStorage.getItem(`panel-${block.id}-collapsed`);
  if (saved === 'true') section.classList.add('is-collapsed');

  const header = document.createElement('div');
  header.className = 'panel-block-header';

  const title = document.createElement('span');
  title.className = 'panel-block-title';
  title.textContent = block.title;

  const chevron = document.createElement('span');
  chevron.className = 'panel-block-chevron';
  chevron.textContent = section.classList.contains('is-collapsed') ? '\u25b8' : '\u25be';

  header.append(title, chevron);
  header.addEventListener('click', () => {
    section.classList.toggle('is-collapsed');
    const collapsed = section.classList.contains('is-collapsed');
    chevron.textContent = collapsed ? '\u25b8' : '\u25be';
    localStorage.setItem(`panel-${block.id}-collapsed`, String(collapsed));
  });

  const content = document.createElement('div');
  content.className = 'panel-block-content';
  content.appendChild(block.content);

  section.append(header, content);
  return section;
}
