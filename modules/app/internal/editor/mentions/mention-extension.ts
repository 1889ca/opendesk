/** Contract: contracts/app/rules.md */
import { Mention } from '@tiptap/extension-mention';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { renderMentionHTML, renderMentionText } from './mention-render.ts';
import { mentionSuggestionRender, type MentionUser } from './mention-list.ts';

/**
 * Collect collaborators from Yjs awareness states.
 * Returns users currently present in the document.
 */
function getCollaborators(provider: HocuspocusProvider): MentionUser[] {
  const awareness = provider.awareness;
  if (!awareness) return [];

  const users: MentionUser[] = [];
  const localId = awareness.clientID;

  awareness.getStates().forEach(
    (state: { user?: { name?: string; color?: string } }, clientId: number) => {
      if (clientId === localId) return;
      const user = state.user;
      if (!user?.name) return;
      users.push({
        id: String(clientId),
        label: user.name,
        color: user.color ?? '#999',
      });
    },
  );

  return users;
}

/**
 * Simple fuzzy match: checks if all characters of the query
 * appear in order within the target string (case-insensitive).
 */
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

/**
 * Create a configured Mention extension that pulls users
 * from the Yjs awareness protocol.
 */
export function createMentionExtension(provider: HocuspocusProvider) {
  return Mention.configure({
    HTMLAttributes: { class: 'mention' },
    renderHTML: renderMentionHTML,
    renderText: renderMentionText,
    suggestion: {
      char: '@',
      items: ({ query }) => {
        const collaborators = getCollaborators(provider);
        if (!query) return collaborators.slice(0, 5);
        return collaborators
          .filter((u) => fuzzyMatch(query, u.label))
          .slice(0, 5);
      },
      render: mentionSuggestionRender,
    },
  });
}
