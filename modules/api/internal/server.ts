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
import { getDocumentForExport } from '../../convert/internal/converter.ts';
import { getRedisClient, disconnectRedis } from './redis.ts';
import { idempotencyMiddleware } from './idempotency.ts';
import { createConvertRoutes } from './convert-routes.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function startServer(port = 3000) {
  const app = express();
  const { handleUpgrade } = createCollabServer();

  app.use(express.json());

  // Idempotency middleware for mutating endpoints (POST, PUT, DELETE)
  const redisClient = getRedisClient();
  app.use('/api', idempotencyMiddleware({ cache: redisClient }));

  // Collabora convert routes (import/export binary formats)
  app.use(createConvertRoutes());

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

  // Export document (MVP: returns metadata; actual content comes client-side)
  app.post('/api/documents/:id/export', async (req, res) => {
    const format = req.body?.format;
    if (!format || !['html', 'text'].includes(format)) {
      res.status(400).json({ error: 'format must be "html" or "text"' });
      return;
    }
    const meta = await getDocumentForExport(req.params.id);
    if (!meta) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    // For MVP, the client sends content along with the request
    const content = req.body?.content;
    if (!content && content !== '') {
      res.status(400).json({ error: 'content is required (client-side export)' });
      return;
    }
    const filename = `${meta.title || 'document'}.${format === 'html' ? 'html' : 'txt'}`;
    const contentType = format === 'html' ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(content);
  });

  // Import HTML file into document (MVP: accept raw HTML in body)
  app.post('/api/documents/:id/import', async (req, res) => {
    const html = req.body?.html;
    if (!html) {
      res.status(400).json({ error: 'html content is required' });
      return;
    }
    const doc = await getDocument(req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    // For MVP, we return the HTML and let the client set it via editor.commands.setContent()
    res.json({ ok: true, html, documentId: req.params.id });
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

  // Graceful shutdown: disconnect Redis on process exit
  const shutdown = async () => {
    console.log('[opendesk] shutting down...');
    await disconnectRedis();
    httpServer.close();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return httpServer;
}
