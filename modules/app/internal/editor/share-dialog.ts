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

  document.getElementById('share-create')?.addEventListener('click', () => {
    const role = (document.getElementById('share-role') as HTMLSelectElement).value;
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
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    });
  });
}
