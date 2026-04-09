/** Contract: contracts/app/rules.md */

/**
 * Issue #183: anonymous users get a deterministic fun name based on a random
 * session token stored in localStorage, so the same browser always shows the
 * same name without requiring a server round-trip.
 */

const COLORS = [
  '#958DF1', '#F98181', '#FBBC88', '#FAF594',
  '#70CFF8', '#94FADB', '#B9F18D', '#C3E2C2',
];

const ANONYMOUS_NAMES: readonly string[] = [
  'Red Panda', 'Blue Falcon', 'Green Gecko', 'Gold Lemur',
  'Pink Flamingo', 'Purple Parrot', 'Orange Otter', 'Silver Fox',
  'Teal Turtle', 'Crimson Crane', 'Cobalt Crow', 'Amber Axolotl',
  'Jade Jaguar', 'Mauve Marmot', 'Slate Salamander', 'Coral Capybara',
  'Indigo Ibis', 'Lime Lynx', 'Rose Raccoon', 'Cyan Chameleon',
  'Violet Vole', 'Ochre Ocelot', 'Bronze Badger', 'Scarlet Squirrel',
  'Navy Newt',
];

/** Returns a simple numeric hash of a string (djb2 variant). */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return Math.abs(h >>> 0);
}

/**
 * Returns a deterministic fun name for an anonymous session token.
 * Same token → same name, always.
 */
export function anonymousNameFromToken(token: string): string {
  return ANONYMOUS_NAMES[hashString(token) % ANONYMOUS_NAMES.length];
}

export function getUserIdentity(): { name: string; color: string } {
  let name = localStorage.getItem('opendesk:userName');
  let color = localStorage.getItem('opendesk:userColor');
  if (!name) {
    // Generate a stable session token to derive a deterministic fun name
    let token = localStorage.getItem('opendesk:anonToken');
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem('opendesk:anonToken', token);
    }
    name = anonymousNameFromToken(token);
    localStorage.setItem('opendesk:userName', name);
  }
  if (!color) {
    const token = localStorage.getItem('opendesk:anonToken') ?? name;
    const idx = hashString(token) % COLORS.length;
    color = COLORS[idx];
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
