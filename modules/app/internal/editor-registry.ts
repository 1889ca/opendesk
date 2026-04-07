/** Contract: contracts/app/rules.md */

/**
 * Editor registry — maps document types to their editor plugins.
 * Each document type registers a plugin that provides:
 * - init: mounts the editor into the DOM and connects to Yjs
 * - destroy: tears down the editor cleanly
 * - toolbar: optional toolbar builder
 * - search: optional search adapter
 */

import type * as Y from 'yjs';
import type { HocuspocusProvider } from '@hocuspocus/provider';

export type EditorContext = {
  documentId: string;
  ydoc: Y.Doc;
  provider: HocuspocusProvider;
  user: { name: string; color: string };
};

export type EditorPlugin = {
  init(el: HTMLElement, ctx: EditorContext): void;
  destroy(): void;
};

export type EditorPluginFactory = () => EditorPlugin;

type DocumentType = 'text' | 'spreadsheet' | 'presentation';

const registry = new Map<DocumentType, EditorPluginFactory>();

export function registerEditor(type: DocumentType, factory: EditorPluginFactory): void {
  registry.set(type, factory);
}

export function getEditorFactory(type: DocumentType): EditorPluginFactory | undefined {
  return registry.get(type);
}

export function getRegisteredTypes(): DocumentType[] {
  return [...registry.keys()];
}
