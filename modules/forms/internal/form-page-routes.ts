/** Contract: contracts/forms/rules.md */

/**
 * Server-side page routes for the forms module.
 *
 * Serves:
 *   GET /f/:formId              — respondent page (form-respondent.html)
 *   GET /form-builder/:formId   — builder page (form-builder.html)
 *   GET /form-builder/new       — builder page for a new form
 *
 * These are NOT under /api — they deliver HTML to the browser.
 * Authentication for the builder is enforced by the client-side bundle;
 * the respondent page is intentionally public.
 */

import { Router, type Request, type Response } from 'express';
import { resolve } from 'node:path';
import { sendHtmlWithNonce } from '../../api/internal/csp-nonce.ts';

export function createFormPageRoutes(publicDir: string): Router {
  const router = Router();

  const respondentHtml = resolve(publicDir, 'form-respondent.html');
  const builderHtml = resolve(publicDir, 'form-builder.html');

  // Public respondent page
  router.get('/f/:formId', (_req: Request, res: Response) => {
    sendHtmlWithNonce(res, respondentHtml).catch(() =>
      res.status(500).json({ error: 'Internal server error' }),
    );
  });

  // Authenticated builder page
  router.get('/form-builder/:formId', (_req: Request, res: Response) => {
    sendHtmlWithNonce(res, builderHtml).catch(() =>
      res.status(500).json({ error: 'Internal server error' }),
    );
  });

  router.get('/form-builder', (_req: Request, res: Response) => {
    sendHtmlWithNonce(res, builderHtml).catch(() =>
      res.status(500).json({ error: 'Internal server error' }),
    );
  });

  return router;
}
