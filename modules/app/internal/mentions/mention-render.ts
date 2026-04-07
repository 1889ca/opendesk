/** Contract: contracts/app/rules.md */
import type { DOMOutputSpec, Node as PmNode } from '@tiptap/pm/model';
import type { MentionOptions } from '@tiptap/extension-mention';

/**
 * Render a mention node as a colored inline chip.
 * The chip uses the `data-user-id` and `data-label` attributes
 * for identification and styling.
 */
export function renderMentionHTML(props: {
  options: MentionOptions;
  node: PmNode;
}): DOMOutputSpec {
  const { node, options } = props;
  const label = node.attrs.label ?? node.attrs.id ?? '';
  const userId = node.attrs.id ?? '';

  return [
    'span',
    {
      class: 'mention',
      'data-type': 'mention',
      'data-user-id': userId,
      'data-label': label,
      ...options.HTMLAttributes,
    },
    `@${label}`,
  ];
}

/**
 * Render mention as plain text (for copy/paste, export).
 */
export function renderMentionText(props: {
  node: PmNode;
}): string {
  const label = props.node.attrs.label ?? props.node.attrs.id ?? '';
  return `@${label}`;
}
