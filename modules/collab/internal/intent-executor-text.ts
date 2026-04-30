/** Contract: contracts/collab/rules.md */
import * as Y from 'yjs';
import type { TextIntentAction } from '../../document/contract/index.ts';

export function applyTextIntent(ydoc: Y.Doc, action: TextIntentAction): number {
  const fragment = ydoc.getXmlFragment('default');

  if (action.type === 'insert_block') {
    const newBlock = new Y.XmlElement(action.blockType);
    const blockId = action.attrs?.blockId ?? crypto.randomUUID();
    const attrs: Record<string, unknown> = { ...(action.attrs ?? {}), blockId };
    for (const [key, val] of Object.entries(attrs)) {
      newBlock.setAttribute(key, String(val));
    }
    if (action.content) {
      const textNode = new Y.XmlText();
      textNode.insert(0, action.content);
      newBlock.insert(0, [textNode]);
    }

    if (action.afterBlockId === null) {
      fragment.insert(0, [newBlock]);
    } else {
      const children = fragment.toArray();
      const idx = children.findIndex((child) => {
        const el = child as Y.XmlElement;
        return el.getAttribute?.('blockId') === action.afterBlockId;
      });
      if (idx === -1) {
        throw new Error(`block_not_found:${action.afterBlockId}`);
      }
      fragment.insert(idx + 1, [newBlock]);
    }
    return 1;
  }

  if (action.type === 'update_block') {
    const children = fragment.toArray();
    const el = children.find((child) => {
      return (child as Y.XmlElement).getAttribute?.('blockId') === action.blockId;
    }) as Y.XmlElement | undefined;
    if (!el) throw new Error(`block_not_found:${action.blockId}`);

    const textChildren = el.toArray();
    for (const child of textChildren) {
      if (child instanceof Y.XmlText) {
        const len = child.length;
        if (len > 0) child.delete(0, len);
        child.insert(0, action.content);
        return 1;
      }
    }
    const textNode = new Y.XmlText();
    textNode.insert(0, action.content);
    el.insert(0, [textNode]);
    return 1;
  }

  if (action.type === 'delete_block') {
    const children = fragment.toArray();
    const idx = children.findIndex((child) => {
      return (child as Y.XmlElement).getAttribute?.('blockId') === action.blockId;
    });
    if (idx === -1) throw new Error(`block_not_found:${action.blockId}`);
    fragment.delete(idx, 1);
    return 1;
  }

  if (action.type === 'update_marks') {
    const children = fragment.toArray();
    const el = children.find((child) => {
      return (child as Y.XmlElement).getAttribute?.('blockId') === action.blockId;
    }) as Y.XmlElement | undefined;
    if (!el) throw new Error(`block_not_found:${action.blockId}`);

    const textChildren = el.toArray();
    for (const child of textChildren) {
      if (child instanceof Y.XmlText) {
        const attrs: Record<string, unknown> = {};
        for (const mark of action.marks) {
          attrs[mark.type] = action.action === 'add' ? (mark.attrs ?? true) : null;
        }
        child.format(action.range.start, action.range.end - action.range.start, attrs);
        return 1;
      }
    }
    return 0;
  }

  return 0;
}
