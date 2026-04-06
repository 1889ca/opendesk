/** Contract: contracts/collab/rules.md */
import { Hocuspocus } from '@hocuspocus/server';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { saveYjsState, loadYjsState } from '../../storage/internal/pg.ts';

export function createCollabServer() {
  const hocuspocus = new Hocuspocus({
    name: 'opendesk-collab',
    timeout: 30000,
    debounce: 2000,
    maxDebounce: 10000,
    quiet: true,

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
    },
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, request) => {
    hocuspocus.handleConnection(ws, request);
  });

  function handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }

  return { hocuspocus, handleUpgrade };
}
