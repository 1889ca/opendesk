/** Contract: contracts/api/rules.md */

import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import type { Request, Response, NextFunction } from 'express';

/**
 * Inject a CSP nonce into all inline `<script>` tags in an HTML
 * string. Tags with a `src` attribute are left untouched — external
 * scripts are already allowed by `'self'` in the CSP.
 */
function injectNonceIntoHtml(html: string, nonce: string): string {
  return html.replace(
    /<script(?=[\s>])(?![^>]*\bsrc\b)([^>]*)>/gi,
    `<script nonce="${nonce}"$1>`,
  );
}

/**
 * Middleware that generates a per-request CSP nonce and stores it on
 * res.locals.cspNonce. Downstream middleware (helmet CSP) and the
 * HTML-serving handler read this value to build a coherent nonce
 * policy for inline scripts.
 *
 * L11: replaces the previous sha256-hash approach, which required
 * manually updating hashes whenever an inline script changed and
 * couldn't prevent injection of NEW inline scripts that happen to
 * match no hash. Nonces are unique per response, so only scripts
 * the server explicitly annotates will execute.
 */
export function cspNonceMiddleware() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.locals.cspNonce = randomBytes(16).toString('base64');
    next();
  };
}

/**
 * Express middleware that intercepts `.html` file requests and serves
 * them with CSP nonces injected into inline `<script>` tags. Non-HTML
 * requests pass through to the next handler (e.g. express.static).
 */
export function serveHtmlWithNonce(publicDir: string) {
  const cache = new Map<string, string>();
  const isProd = process.env.NODE_ENV === 'production';

  return async (req: Request, res: Response, next: NextFunction) => {
    if (extname(req.path) !== '.html') return next();

    const filePath = resolve(publicDir, req.path.replace(/^\//, ''));
    if (!filePath.startsWith(publicDir)) return next();

    try {
      let html: string;
      if (isProd && cache.has(filePath)) {
        html = cache.get(filePath)!;
      } else {
        html = await readFile(filePath, 'utf-8');
        if (isProd) cache.set(filePath, html);
      }

      const nonce = res.locals.cspNonce as string;
      res.type('html').send(injectNonceIntoHtml(html, nonce));
    } catch {
      next();
    }
  };
}

/**
 * Read an HTML file from disk and send it with CSP nonces injected.
 * Used for the SPA catch-all route where express.static isn't
 * involved and we need to send a specific file.
 */
export async function sendHtmlWithNonce(
  res: Response,
  filePath: string,
): Promise<void> {
  const html = await readFile(filePath, 'utf-8');
  const nonce = res.locals.cspNonce as string;
  res.type('html').send(injectNonceIntoHtml(html, nonce));
}
