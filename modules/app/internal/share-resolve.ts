/** Contract: contracts/app/rules.md */

/**
 * Share link resolver — handles token-based share URL resolution,
 * including password-protected links.
 */

import { apiFetch } from './api-client.ts';

function init(): void {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const heading = document.getElementById('heading');
  const message = document.getElementById('message');
  if (!heading || !message) return;

  if (!token) {
    heading.textContent = 'Invalid link';
    message.textContent = 'This share link is missing a token.';
    message.classList.add('share-error');
    return;
  }

  function resolve(password?: string): void {
    const body = password ? JSON.stringify({ password }) : '{}';
    apiFetch(`/api/share/${encodeURIComponent(token!)}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
      .then((res) => {
        if (res.status === 403) {
          heading!.textContent = 'Password required';
          message!.textContent = 'This link is password-protected.';
          message!.classList.remove('share-error');
          const form = document.getElementById('password-form');
          if (form) form.hidden = false;
          document.getElementById('password-input')?.focus();
          return null;
        }
        if (!res.ok) return res.json().then((d: { error?: string }) => { throw new Error(d.error || 'Failed'); });
        return res.json();
      })
      .then((data: { grant?: { docId?: string } } | null) => {
        if (!data) return;
        const docId = data.grant?.docId;
        if (docId) {
          window.location.href = '/editor.html?doc=' + encodeURIComponent(docId);
        } else {
          heading!.textContent = 'Error';
          message!.textContent = 'Could not determine document ID.';
          message!.classList.add('share-error');
        }
      })
      .catch((err: Error) => {
        heading!.textContent = 'Link unavailable';
        const messages: Record<string, string> = {
          not_found: 'This share link does not exist or has been deleted.',
          expired: 'This share link has expired.',
          revoked: 'This share link has been revoked.',
          exhausted: 'This share link has reached its maximum number of uses.',
        };
        message!.textContent = messages[err.message] || 'Could not resolve this share link.';
        message!.classList.add('share-error');
      });
  }

  document.getElementById('password-submit')?.addEventListener('click', () => {
    const pw = (document.getElementById('password-input') as HTMLInputElement)?.value;
    if (pw) resolve(pw);
  });

  document.getElementById('password-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const pw = (document.getElementById('password-input') as HTMLInputElement)?.value;
      if (pw) resolve(pw);
    }
  });

  resolve();
}

document.addEventListener('DOMContentLoaded', init);
