/** Contract: contracts/ai/rules.md */
import * as Y from 'yjs';
import { loadYjsState, getDocument } from '../../storage/index.ts';

/**
 * Extract plain text content from a document's Yjs state.
 * Returns empty string if document has no content or is not a text document.
 */
export async function extractDocumentText(documentId: string): Promise<string> {
  const doc = await getDocument(documentId);
  if (!doc) return '';

  const state = await loadYjsState(documentId);
  if (!state) return '';

  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, state);

  // TipTap stores content in an XmlFragment named 'default'
  const fragment = ydoc.getXmlFragment('default');
  const text = xmlFragmentToText(fragment);
  ydoc.destroy();

  // Prepend the document title for context
  const title = doc.title || '';
  return title ? `${title}\n\n${text}` : text;
}

/** Recursively extract text from a Yjs XmlFragment. */
function xmlFragmentToText(fragment: Y.XmlFragment): string {
  const parts: string[] = [];

  for (const child of fragment.toArray()) {
    if (child instanceof Y.XmlText) {
      parts.push(child.toString());
    } else if (child instanceof Y.XmlElement) {
      const tag = child.nodeName;
      const inner = xmlFragmentToText(child);

      // Add newlines for block elements
      if (['paragraph', 'heading', 'codeBlock', 'blockquote', 'listItem'].includes(tag)) {
        parts.push(inner + '\n');
      } else if (tag === 'hardBreak') {
        parts.push('\n');
      } else {
        parts.push(inner);
      }
    }
  }

  return parts.join('');
}
