/** Contract: contracts/app/rules.md */

export interface PanelBlock {
  id: string;
  title: string;
  icon: string;
  content: HTMLElement;
  cleanup?: () => void;
}

export interface PanelRail {
  el: HTMLElement;
  /** Show a specific tab by id, or toggle the rail open/closed. */
  showTab: (id: string) => void;
  toggle: (show?: boolean) => void;
  addBlock: (block: PanelBlock) => void;
  cleanup: () => void;
}

const RAIL_STATE_KEY = 'opendesk-panel-rail';
const ACTIVE_TAB_KEY = 'opendesk-panel-active-tab';

export function buildPanelRail(blocks: PanelBlock[]): PanelRail {
  let activeTab: string | null = null;
  const blockMap = new Map<string, PanelBlock>();
  const tabBtnMap = new Map<string, HTMLButtonElement>();
  const contentMap = new Map<string, HTMLElement>();

  const rail = document.createElement('aside');
  rail.className = 'panel-rail panel-rail--right';
  rail.setAttribute('aria-label', 'Panels');

  // Tab strip (VS Code-style activity bar)
  const tabStrip = document.createElement('div');
  tabStrip.className = 'panel-tab-strip';

  // Content area (holds header + active panel content)
  const contentArea = document.createElement('div');
  contentArea.className = 'panel-content-area';

  const header = document.createElement('div');
  header.className = 'panel-rail-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'panel-rail-title';
  titleEl.textContent = 'Panels';

  header.appendChild(titleEl);
  contentArea.appendChild(header);

  const contentBody = document.createElement('div');
  contentBody.className = 'panel-content-body';
  contentArea.appendChild(contentBody);

  rail.append(tabStrip, contentArea);

  for (const block of blocks) registerBlock(block);

  // Restore saved state
  const savedTab = localStorage.getItem(ACTIVE_TAB_KEY);
  const savedOpen = localStorage.getItem(`${RAIL_STATE_KEY}-right`);
  if (savedOpen === 'open' && savedTab && blockMap.has(savedTab)) {
    activateTab(savedTab);
  } else {
    rail.classList.remove('is-open');
  }

  function registerBlock(block: PanelBlock): void {
    blockMap.set(block.id, block);

    const tabBtn = document.createElement('button');
    tabBtn.className = 'panel-tab';
    tabBtn.setAttribute('aria-label', block.title);
    tabBtn.setAttribute('title', block.title);
    tabBtn.textContent = block.icon;
    tabBtn.addEventListener('click', () => showTab(block.id));
    tabStrip.appendChild(tabBtn);
    tabBtnMap.set(block.id, tabBtn);

    const wrapper = document.createElement('div');
    wrapper.className = 'panel-tab-content';
    wrapper.style.display = 'none';
    wrapper.appendChild(block.content);
    contentBody.appendChild(wrapper);
    contentMap.set(block.id, wrapper);
  }

  function activateTab(id: string): void {
    activeTab = id;
    rail.classList.add('is-open');

    // Update tab buttons
    for (const [btnId, btn] of tabBtnMap) {
      btn.classList.toggle('is-active', btnId === id);
    }

    // Show/hide content
    for (const [cId, wrapper] of contentMap) {
      wrapper.style.display = cId === id ? '' : 'none';
    }

    // Update header title
    const block = blockMap.get(id);
    if (block) titleEl.textContent = block.title;

    localStorage.setItem(ACTIVE_TAB_KEY, id);
    localStorage.setItem(`${RAIL_STATE_KEY}-right`, 'open');
  }

  function collapseRail(): void {
    activeTab = null;
    rail.classList.remove('is-open');

    for (const btn of tabBtnMap.values()) btn.classList.remove('is-active');
    for (const wrapper of contentMap.values()) wrapper.style.display = 'none';

    titleEl.textContent = 'Panels';
    localStorage.setItem(`${RAIL_STATE_KEY}-right`, 'closed');
  }

  function showTab(id: string): void {
    if (activeTab === id) {
      collapseRail();
    } else if (blockMap.has(id)) {
      activateTab(id);
    }
  }

  function toggle(show?: boolean): void {
    const next = show ?? !rail.classList.contains('is-open');
    if (next) {
      // Open to saved or first tab
      const target = activeTab
        ?? localStorage.getItem(ACTIVE_TAB_KEY)
        ?? blocks[0]?.id;
      if (target && blockMap.has(target)) activateTab(target);
    } else {
      collapseRail();
    }
  }

  function addBlock(block: PanelBlock): void {
    blocks.push(block);
    registerBlock(block);
  }

  const cleanup = () => {
    for (const block of blockMap.values()) block.cleanup?.();
    rail.remove();
  };

  return { el: rail, showTab, toggle, addBlock, cleanup };
}
