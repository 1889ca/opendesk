/** Contract: contracts/api/rules.md */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCollabServer } from '../../collab/internal/server.ts';
import {
  listDocuments,
  createDocument,
  getDocument,
  deleteDocument,
  updateDocumentTitle,
} from '../../storage/internal/pg.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function startServer(port = 3000) {
  const app = express();
  const { handleUpgrade } = createCollabServer();

  app.use(express.json());

  // Serve static frontend
  const publicDir = resolve(__dirname, '../../app/internal/public');
  app.use(express.static(publicDir));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
  });

  // List documents
  app.get('/api/documents', async (_req, res) => {
    const docs = await listDocuments();
    res.json(docs);
  });

  // Create document
  app.post('/api/documents', async (req, res) => {
    const title = req.body?.title || 'Untitled';
    const id = randomUUID();
    const doc = await createDocument(id, title);
    res.status(201).json(doc);
  });

  // Get document
  app.get('/api/documents/:id', async (req, res) => {
    const doc = await getDocument(req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json(doc);
  });

  // Update document title
  app.patch('/api/documents/:id', async (req, res) => {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    await updateDocumentTitle(req.params.id, title);
    res.json({ ok: true });
  });

  // Delete document
  app.delete('/api/documents/:id', async (req, res) => {
    const deleted = await deleteDocument(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json({ ok: true });
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
