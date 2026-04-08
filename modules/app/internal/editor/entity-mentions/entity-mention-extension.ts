/** Contract: contracts/app/rules.md */
import { Mention } from '@tiptap/extension-mention';
import { apiFetch } from '../../shared/api-client.ts';
import type { EntityMentionItem } from './types.ts';
import {
  renderEntityMentionHTML,
  renderEntityMentionText,
} from './entity-mention-render.ts';
import { entityMentionSuggestionRender } from './entity-mention-list.ts';

/**
 * Fetch matching entities from the KB search API.
 */
async function fetchEntities(query: string): Promise<EntityMentionItem[]> {
  if (!query) return [];
  const url = `/api/kb/entities/search?q=${encodeURIComponent(query)}`;
  const res = await apiFetch(url);
  if (!res.ok) return [];
  return res.json();
}

/**
 * Create a TipTap Mention extension configured for KB entity mentions.
 * Uses '#' as the trigger character (@ is used for user mentions).
 */
export function createEntityMentionExtension() {
  return Mention.extend({ name: 'entityMention' }).configure({
    HTMLAttributes: { class: 'entity-mention' },
    renderHTML: renderEntityMentionHTML,
    renderText: renderEntityMentionText,
    suggestion: {
      char: '#',
      items: async ({ query }) => {
        if (!query || query.length < 1) return [];
        return fetchEntities(query);
      },
      render: entityMentionSuggestionRender,
    },
  });
}
