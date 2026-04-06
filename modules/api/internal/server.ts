/** Contract: contracts/api/rules.md */
import { createServer } from 'node:http';
import express from 'express';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCollabServer } from '../../collab/internal/server.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function startServer(port = 3000) {
  const app = express();
  const { handleUpgrade } = createCollabServer();

  // Serve static frontend
  const publicDir = resolve(__dirname, '../../app/internal/public');
  app.use(express.static(publicDir));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
  });

  const httpServer = createServer(app);

  // Mount Hocuspocus WebSocket on /collab
  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/collab')) {
      handleUpgrade(request, socket, head);
    } else {
      socket.destroy();
    }
  });

  httpServer.listen(port, () => {
    console.log(`[opendesk] server running at http://localhost:${port}`);
    console.log(`[opendesk] WebSocket collab at ws://localhost:${port}/collab`);
  });

  return httpServer;
}
