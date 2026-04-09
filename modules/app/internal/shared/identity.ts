/** Contract: contracts/app/rules.md */

const COLORS = [
  '#958DF1', '#F98181', '#FBBC88', '#FAF594',
  '#70CFF8', '#94FADB', '#B9F18D', '#C3E2C2',
];

const DEFAULT_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana',
  'Eve', 'Frank', 'Grace', 'Hank',
];

export function getUserIdentity(): { name: string; color: string } {
  let name = localStorage.getItem('opendesk:userName');
  let color = localStorage.getItem('opendesk:userColor');
  if (!name) {
    name = DEFAULT_NAMES[Math.floor(Math.random() * DEFAULT_NAMES.length)];
    localStorage.setItem('opendesk:userName', name);
  }
  if (!color) {
    color = COLORS[Math.floor(Math.random() * COLORS.length)];
    localStorage.setItem('opendesk:userColor', color);
  }
  return { name, color };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns the document UUID from the ?doc= query param.
 * If the param is missing or not a valid UUID, redirects to the dashboard
 * immediately to prevent the server receiving a non-UUID document name,
 * which would crash with "invalid input syntax for type uuid" (issue #162).
 */
export function getDocumentId(): string {
  const params = new URLSearchParams(window.location.search);
  const doc = params.get('doc');
  if (!doc || !UUID_RE.test(doc)) {
    window.location.replace('/');
    // Return a placeholder — execution stops after the redirect, but
    // TypeScript requires a return value.
    return '';
  }
  return doc;
}
