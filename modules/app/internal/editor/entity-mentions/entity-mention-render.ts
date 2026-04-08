/** Contract: contracts/app/rules.md */
import type { DOMOutputSpec, Node as PmNode } from '@tiptap/pm/model';
import type { MentionOptions } from '@tiptap/extension-mention';

/**
 * Render an entity mention node as a styled inline chip.
 * Uses data attributes for entity identification and tooltip rendering.
 */
export function renderEntityMentionHTML(props: {
  options: MentionOptions;
  node: PmNode;
}): DOMOutputSpec {
  const { node, options } = props;
  const label = node.attrs.label ?? node.attrs.id ?? '';
  const entityId = node.attrs.id ?? '';

  return [
    'span',
    {
      class: 'entity-mention',
      'data-type': 'entity-mention',
      'data-entity-id': entityId,
      'data-label': label,
      contenteditable: 'false',
      ...options.HTMLAttributes,
    },
    `@${label}`,
  ];
}

/**
 * Render entity mention as plain text (for copy/paste, export).
 */
export function renderEntityMentionText(props: {
  node: PmNode;
}): string {
  const label = props.node.attrs.label ?? props.node.attrs.id ?? '';
  return `@${label}`;
}
