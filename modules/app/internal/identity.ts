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

export function getDocumentId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('doc') || 'default';
}
