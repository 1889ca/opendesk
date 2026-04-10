/** Contract: contracts/app/rules.md */

export type ToastType = 'success' | 'error' | 'info';

let container: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
  }
  return container;
}

function removeToast(el: HTMLElement): void {
  el.classList.add('toast--dismissing');
  el.addEventListener('animationend', () => el.remove(), { once: true });
  // Fallback in case animationend doesn't fire
  setTimeout(() => el.remove(), 400);
}

export function showToast(message: string, type: ToastType = 'info'): void {
  const root = getContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.className = 'toast-message';
  text.textContent = message;

  const dismiss = document.createElement('button');
  dismiss.className = 'toast-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss notification');
  dismiss.textContent = '\u00D7';
  dismiss.addEventListener('click', () => removeToast(toast));

  toast.append(text, dismiss);
  root.appendChild(toast);

  if (type !== 'error') {
    setTimeout(() => {
      if (toast.isConnected) removeToast(toast);
    }, 3000);
  }
}
