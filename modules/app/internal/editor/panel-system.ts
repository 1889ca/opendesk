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
  addBlock: (block: PanelBlock) => void;
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

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'panel-rail-collapse';
  collapseBtn.setAttribute('aria-label', 'Collapse panels');
  collapseBtn.textContent = side === 'left' ? '\u00ab' : '\u00bb';
  collapseBtn.addEventListener('click', () => toggle(false));

  header.append(title, collapseBtn);
  rail.appendChild(header);

  for (const block of blocks) {
    rail.appendChild(renderBlock(block));
  }

  const saved = localStorage.getItem(`${RAIL_STATE_KEY}-${side}`);
  const startOpen = saved !== 'closed';
  rail.classList.toggle('is-open', startOpen);

  function toggle(show?: boolean): void {
    const next = show ?? !rail.classList.contains('is-open');
    rail.classList.toggle('is-open', next);
    localStorage.setItem(`${RAIL_STATE_KEY}-${side}`, next ? 'open' : 'closed');
  }

  function addBlock(block: PanelBlock): void {
    blocks.push(block);
    rail.appendChild(renderBlock(block));
  }

  const cleanup = () => {
    for (const block of blocks) block.cleanup?.();
    rail.remove();
  };

  return { el: rail, toggle, addBlock, cleanup };
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
