/** Contract: contracts/app/rules.md */

interface PageSetup {
  size: 'a4' | 'letter' | 'legal';
  orientation: 'portrait' | 'landscape';
}

const KEY = 'opendesk-page-setup';

const PAPER_SIZES: Record<PageSetup['size'], Record<PageSetup['orientation'], { w: string; h: string }>> = {
  a4:     { portrait: { w: '210mm', h: '297mm' }, landscape: { w: '297mm', h: '210mm' } },
  letter: { portrait: { w: '216mm', h: '279mm' }, landscape: { w: '279mm', h: '216mm' } },
  legal:  { portrait: { w: '216mm', h: '356mm' }, landscape: { w: '356mm', h: '216mm' } },
};

function loadSetup(): Partial<PageSetup> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<PageSetup>;
  } catch {
    return {};
  }
}

function saveSetup(s: PageSetup): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function applySetup(s: PageSetup): void {
  const dims = PAPER_SIZES[s.size][s.orientation];
  document.documentElement.style.setProperty('--page-width', dims.w);
  document.documentElement.style.setProperty('--page-height', dims.h);
  const editorEl = document.getElementById('editor');
  if (editorEl) {
    editorEl.style.maxWidth = dims.w;
  }
}

function defaultSetup(): PageSetup {
  const saved = loadSetup();
  return {
    size: saved.size ?? 'a4',
    orientation: saved.orientation ?? 'portrait',
  };
}

export function initPageSetup(): void {
  applySetup(defaultSetup());
}

export function showPageSetupDialog(): void {
  const current = defaultSetup();

  const overlay = document.createElement('div');
  overlay.className = 'page-setup-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'page-setup-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-label', 'Page Setup');

  const title = document.createElement('h2');
  title.className = 'page-setup-title';
  title.textContent = 'Page Setup';
  dialog.appendChild(title);

  // Paper size
  const sizeLabel = document.createElement('label');
  sizeLabel.textContent = 'Paper size';
  sizeLabel.className = 'page-setup-label';
  const sizeSelect = document.createElement('select');
  sizeSelect.className = 'page-setup-select';
  ([
    ['a4', 'A4 (210 × 297 mm)'],
    ['letter', 'Letter (8.5 × 11 in)'],
    ['legal', 'Legal (8.5 × 14 in)'],
  ] as [string, string][]).forEach(([v, l]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = l;
    if (v === current.size) o.selected = true;
    sizeSelect.appendChild(o);
  });
  sizeLabel.appendChild(sizeSelect);
  dialog.appendChild(sizeLabel);

  // Orientation
  const orientLabel = document.createElement('label');
  orientLabel.textContent = 'Orientation';
  orientLabel.className = 'page-setup-label';
  const orientSelect = document.createElement('select');
  orientSelect.className = 'page-setup-select';
  ([
    ['portrait', 'Portrait'],
    ['landscape', 'Landscape'],
  ] as [string, string][]).forEach(([v, l]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = l;
    if (v === current.orientation) o.selected = true;
    orientSelect.appendChild(o);
  });
  orientLabel.appendChild(orientSelect);
  dialog.appendChild(orientLabel);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.className = 'page-setup-btns';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost btn-sm';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => overlay.remove());

  const okBtn = document.createElement('button');
  okBtn.className = 'btn btn-primary btn-sm';
  okBtn.textContent = 'Apply';
  okBtn.addEventListener('click', () => {
    const setup: PageSetup = {
      size: sizeSelect.value as PageSetup['size'],
      orientation: orientSelect.value as PageSetup['orientation'],
    };
    saveSetup(setup);
    applySetup(setup);
    overlay.remove();
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(okBtn);
  dialog.appendChild(btnRow);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}
