/** Contract: contracts/app/rules.md */

import { apiFetch } from '../shared/api-client.ts';

export function setupShareDialog(docId: string): void {
  const overlay = document.getElementById('share-dialog')!;
  const resultDiv = document.getElementById('share-result')!;
  const urlInput = document.getElementById('share-url') as HTMLInputElement;

  document.getElementById('share-btn')?.addEventListener('click', () => {
    resultDiv.hidden = true;
    overlay.hidden = false;
  });

  document.getElementById('share-close')?.addEventListener('click', () => { overlay.hidden = true; });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.hidden = true; });

  setupRoleDropdown();

  document.getElementById('share-create')?.addEventListener('click', () => {
    const role = (document.getElementById('share-role') as HTMLInputElement).value;
    const btn = document.getElementById('share-create') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Creating...';

    apiFetch(`/api/documents/${encodeURIComponent(docId)}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
      .then((res) => { if (!res.ok) throw new Error('Failed to create share link'); return res.json(); })
      .then((link: { token: string }) => {
        urlInput.value = `${window.location.origin}/share.html?token=${encodeURIComponent(link.token)}`;
        resultDiv.hidden = false;
      })
      .catch((err) => alert(err.message))
      .finally(() => { btn.disabled = false; btn.textContent = 'Create link'; });
  });

  document.getElementById('share-copy')?.addEventListener('click', () => {
    urlInput.select();
    navigator.clipboard.writeText(urlInput.value).then(() => {
      const copyBtn = document.getElementById('share-copy')!;
      copyBtn.textContent = '\u2713 Copied!';
      copyBtn.classList.add('share-copy-btn--copied');
      setTimeout(() => {
        copyBtn.textContent = 'Copy link';
        copyBtn.classList.remove('share-copy-btn--copied');
      }, 2000);
    });
  });
}

function setupRoleDropdown(): void {
  const dropdown = document.getElementById('share-role-dropdown');
  const hiddenInput = document.getElementById('share-role') as HTMLInputElement;
  const triggerText = dropdown?.querySelector('.share-role-trigger-text');
  const optionsRaw = dropdown?.querySelectorAll<HTMLElement>('.share-role-option');
  if (!dropdown || !hiddenInput || !triggerText || !optionsRaw) return;
  const options = optionsRaw;

  let isOpen = false;

  function openMenu(): void {
    isOpen = true;
    dropdown!.setAttribute('aria-expanded', 'true');
    dropdown!.classList.add('share-role-dropdown--open');
    const selected = dropdown!.querySelector<HTMLElement>('[aria-selected="true"]');
    selected?.focus();
  }

  function closeMenu(): void {
    isOpen = false;
    dropdown!.setAttribute('aria-expanded', 'false');
    dropdown!.classList.remove('share-role-dropdown--open');
    dropdown!.focus();
  }

  function selectOption(option: HTMLElement): void {
    const value = option.dataset['value'] ?? '';
    const label = option.querySelector('.share-role-option-label')?.textContent ?? value;

    options.forEach((opt) => {
      opt.classList.remove('share-role-option--selected');
      opt.setAttribute('aria-selected', 'false');
    });

    option.classList.add('share-role-option--selected');
    option.setAttribute('aria-selected', 'true');
    hiddenInput.value = value;
    triggerText!.textContent = label;
    closeMenu();
  }

  dropdown.addEventListener('click', (e) => {
    const opt = (e.target as HTMLElement).closest<HTMLElement>('.share-role-option');
    if (opt) {
      selectOption(opt);
      return;
    }
    if (isOpen) closeMenu();
    else openMenu();
  });

  dropdown.addEventListener('keydown', (e) => {
    const optionList = Array.from(options);
    const focused = document.activeElement as HTMLElement;
    const idx = optionList.indexOf(focused);

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!isOpen) { openMenu(); return; }
        if (idx >= 0) selectOption(optionList[idx]!);
        break;
      case 'Escape':
        e.preventDefault();
        closeMenu();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) { openMenu(); return; }
        optionList[Math.min(idx + 1, optionList.length - 1)]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) { openMenu(); return; }
        if (idx > 0) optionList[idx - 1]?.focus();
        break;
      default:
        break;
    }
  });

  document.addEventListener('click', (e) => {
    if (isOpen && !dropdown.contains(e.target as Node)) closeMenu();
  });
}
