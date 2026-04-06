/** Contract: contracts/collab/rules.md */
import { Hocuspocus } from '@hocuspocus/server';
import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

export function createCollabServer() {
  const hocuspocus = new Hocuspocus({
    name: 'opendesk-collab',
    timeout: 30000,
    debounce: 2000,
    maxDebounce: 10000,
    quiet: true,
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
