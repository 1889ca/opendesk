/** Contract: contracts/kb/rules.md */

import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import { listEntries, createEntry } from './entries-store.ts';
import { buildZip, parseZip, sanitizeFilename } from './kb-zip.ts';
import { entryToMarkdown, parseFrontMatter, parseConfluenceHtml } from './kb-markdown-helpers.ts';

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

export type KBImportExportRoutesOptions = {
  permissions: PermissionsModule;
};

/** Collect markdown files from the uploaded buffer based on file type. */
function extractMdFiles(
  buffer: Buffer,
  originalname: string,
  mimetype: string,
): { name: string; content: string }[] | null {
  const lower = originalname.toLowerCase();
  if (lower.endsWith('.zip') || mimetype === 'application/zip' || mimetype === 'application/x-zip-compressed') {
    return parseZip(buffer);
  }
  if (lower.endsWith('.md') || mimetype === 'text/markdown' || mimetype === 'text/plain') {
    return [{ name: originalname, content: buffer.toString('utf8') }];
  }
  if (lower.endsWith('.html') || lower.endsWith('.htm') || mimetype === 'text/html') {
    const { title, body } = parseConfluenceHtml(buffer.toString('utf8'));
    return [{ name: `${sanitizeFilename(title)}.md`, content: `# ${title}\n\n${body}` }];
  }
  return null;
}

/** Mount KB import/export routes under /api/kb/entries. */
export function createKBImportExportRoutes(opts: KBImportExportRoutesOptions): Router {
  const { permissions } = opts;
  const router = Router();

  // GET /export — download all KB entries as a ZIP of .md files
  router.get(
    '/export',
    permissions.requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      const entries = await listEntries(WORKSPACE_ID);
      const files = entries.map((entry) => ({
        name: `${sanitizeFilename(entry.title)}_${entry.id.slice(0, 8)}.md`,
        content: entryToMarkdown(entry),
      }));
      if (files.length === 0) {
        files.push({ name: 'README.md', content: '# Knowledge Base\n\nNo entries to export.\n' });
      }
      const zip = buildZip(files);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="kb-export.zip"');
      res.setHeader('Content-Length', zip.length);
      res.send(zip);
    }),
  );

  // POST /import — accept .md, .zip (Markdown/Notion), or .html (Confluence)
  router.post(
    '/import',
    permissions.requireAuth,
    upload.single('file'),
    asyncHandler(async (req: Request, res: Response) => {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const { originalname, buffer, mimetype } = req.file;
      const mdFiles = extractMdFiles(buffer, originalname, mimetype);
      if (!mdFiles) {
        res.status(400).json({ error: 'Unsupported file type. Upload .md, .zip, or .html' });
        return;
      }

      const principal = req.principal!;
      const imported: string[] = [];
      const errors: string[] = [];

      for (const file of mdFiles) {
        try {
          const { frontMatter, body } = parseFrontMatter(file.content);
          const rawTitle = frontMatter.title?.replace(/^"|"$/g, '')
            ?? file.name.replace(/\.md$/, '').replace(/_/g, ' ');
          const title = rawTitle.replace(/^#\s*/, '').trim() || 'Imported Entry';
          const entryType = frontMatter.entry_type ?? frontMatter.type ?? 'note';
          const tagsRaw = frontMatter.tags ?? '';
          const tags = tagsRaw
            .replace(/[[\]]/g, '').split(',')
            .map((t: string) => t.trim().replace(/^"|"$/g, ''))
            .filter(Boolean);

          const validTypes = ['reference', 'entity', 'dataset', 'note'];
          await createEntry({
            workspaceId: WORKSPACE_ID,
            entryType: validTypes.includes(entryType) ? entryType as 'note' : 'note',
            title: title.slice(0, 500),
            metadata: { body: body.slice(0, 100000) },
            tags,
            corpus: (frontMatter.corpus ?? 'knowledge') as 'knowledge' | 'operational' | 'reference',
            jurisdiction: frontMatter.jurisdiction || null,
            createdBy: principal.id,
          });
          imported.push(file.name);
        } catch (err) {
          errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      res.json({ imported: imported.length, files: imported, errors });
    }),
  );

  return router;
}
