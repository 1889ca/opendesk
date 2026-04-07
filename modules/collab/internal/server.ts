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

  const onAuthenticate = createOnAuthenticate(deps.tokenVerifier);

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

    async onStoreDocument({ documentName, document }) {
      const state = Y.encodeStateAsUpdate(document);
      await saveYjsState(documentName, state);

      // Trigger compaction check asynchronously (fire-and-forget).
      // Errors are logged but do not block the save cycle.
      compactionManager.maybeCompact(documentName, state).catch((err) => {
        console.error(
          `[collab] compaction failed for ${documentName}:`,
          err,
        );
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

  return { hocuspocus, handleUpgrade, compactionManager };
}
