/** Contract: contracts/collab/rules.md */
import { Hocuspocus } from '@hocuspocus/server';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { saveYjsState, loadYjsState } from '../../storage/index.ts';
import { CompactionManager } from './compaction-manager.ts';
import { createOnAuthenticate } from './authenticate.ts';
import type { CollabConfig } from '../contract.ts';
import type { CollabDependencies } from './types.ts';
import { HocuspocusConnectionFinder, subscribeGrantRevoked } from './grant-revoked-handler.ts';
import { createDocumentMaterializer, type DocumentMaterializer } from './document-materializer.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('collab');

const DEFAULT_COMPACTION_THRESHOLD = 1_048_576; // 1 MiB

export function createCollabServer(
  deps: CollabDependencies,
  config?: Partial<CollabConfig>,
) {
  const thresholdBytes =
    config?.compactionThresholdBytes ?? DEFAULT_COMPACTION_THRESHOLD;

  const compactionManager = new CompactionManager(thresholdBytes, {
    saveYjsState,
    loadYjsState,
  });

  const onAuthenticate = createOnAuthenticate(deps.tokenVerifier, deps.permissions);

  const materializer: DocumentMaterializer | null = deps.repo
    ? createDocumentMaterializer({
        repo: deps.repo,
        eventBus: deps.eventBus,
        debounceMs: config?.materializer?.debounceIntervalMs ?? 2000,
      })
    : null;

  const hocuspocus = new Hocuspocus({
    name: config?.hocuspocus?.name ?? 'opendesk-collab',
    timeout: 30000,
    debounce: 2000,
    maxDebounce: 10000,
    quiet: config?.hocuspocus?.quiet ?? true,

    onAuthenticate,

    async onLoadDocument({ document, documentName }) {
      const state = await loadYjsState(documentName);
      if (state) {
        Y.applyUpdate(document, state);
      }
      return document;
    },

    async onChange({ documentName, document }) {
      materializer?.schedule(documentName, document);
    },

    async onStoreDocument({ documentName, document }) {
      const state = Y.encodeStateAsUpdate(document);
      await saveYjsState(documentName, state);

      // Trigger compaction check asynchronously (fire-and-forget).
      // Errors are logged but do not block the save cycle.
      compactionManager.maybeCompact(documentName, state).catch((err) => {
        log.error('compaction failed', { documentName, error: String(err) });
      });
    },
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, request) => {
    hocuspocus.handleConnection(ws, request);
  });

  function handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }

  // Subscribe to GrantRevoked events if an event bus is provided.
  // HocuspocusConnectionFinder reads live document state at event time —
  // no separate connection tracking is needed.
  // Fire-and-forget: subscription errors are non-fatal at startup.
  if (deps.eventBus) {
    const finder = new HocuspocusConnectionFinder(hocuspocus);
    subscribeGrantRevoked(deps.eventBus, finder).catch((err) => {
      log.error('failed to subscribe to GrantRevoked events', { error: String(err) });
    });
  }

  /**
   * Immediately flush (materialise) the current Yjs state for a document.
   * Useful for on-demand export or version saving — bypasses the debounce window.
   * No-op when no repo was provided to the server.
   */
  async function flushDocument(docId: string): Promise<void> {
    if (!materializer) return;
    const ydoc = hocuspocus.documents.get(docId);
    if (!ydoc) {
      log.warn('flushDocument: document not found in memory', { docId });
      return;
    }
    await materializer.flush(docId, ydoc as unknown as Y.Doc);
  }

  return { hocuspocus, handleUpgrade, compactionManager, flushDocument };
}
