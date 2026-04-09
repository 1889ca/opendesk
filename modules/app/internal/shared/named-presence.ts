/** Contract: contracts/app/rules.md */

/**
 * Assigns deterministic fun names to anonymous collaborators based on a
 * numeric client ID (e.g. Yjs awareness clientID). The same ID always
 * resolves to the same name within a session, so presence display is stable.
 *
 * Issue #183 — "Anonymous, Anonymous" is uninformative.
 */

const NAMES: readonly string[] = [
  'Red Panda',
  'Blue Falcon',
  'Green Gecko',
  'Gold Lemur',
  'Pink Flamingo',
  'Purple Parrot',
  'Orange Otter',
  'Silver Fox',
  'Teal Turtle',
  'Crimson Crane',
  'Cobalt Crow',
  'Amber Axolotl',
  'Jade Jaguar',
  'Mauve Marmot',
  'Slate Salamander',
  'Coral Capybara',
  'Indigo Ibis',
  'Lime Lynx',
  'Rose Raccoon',
  'Cyan Chameleon',
  'Violet Vole',
  'Ochre Ocelot',
  'Bronze Badger',
  'Scarlet Squirrel',
  'Navy Newt',
];

/**
 * Returns a fun display name for a given numeric client ID.
 * Deterministic: same clientId → same name.
 */
export function nameFromClientId(clientId: number): string {
  const index = Math.abs(clientId) % NAMES.length;
  return NAMES[index];
}
