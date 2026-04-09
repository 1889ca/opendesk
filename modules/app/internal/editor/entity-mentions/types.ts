/** Contract: contracts/app/rules.md */

/** Lightweight entity summary for the mention picker. */
export interface EntityMentionItem {
  id: string;
  subtype: string;
  name: string;
}

/** Subtype display configuration. */
export interface SubtypeConfig {
  label: string;
  icon: string;
  color: string;
}

/** Map of subtype to display config. */
export const SUBTYPE_CONFIG: Record<string, SubtypeConfig> = {
  person: { label: 'Person', icon: 'P', color: '#2563eb' },
  organization: { label: 'Org', icon: 'O', color: '#7c3aed' },
  project: { label: 'Project', icon: 'J', color: '#059669' },
  term: { label: 'Term', icon: 'T', color: '#d97706' },
};

export function getSubtypeConfig(subtype: string): SubtypeConfig {
  return SUBTYPE_CONFIG[subtype] ?? {
    label: subtype,
    icon: '?',
    color: '#6b7280',
  };
}
