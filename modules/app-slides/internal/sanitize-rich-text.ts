/** Contract: contracts/app-slides/rules.md */

/**
 * Invariant 12: Rich text content is sanitized on write and read.
 *
 * Uses browser built-in DOMParser — no external dependencies.
 * Allowlist matches TipTap StarterKit + Underline extension schema.
 */

const ALLOWED_TAGS = new Set([
  'P', 'STRONG', 'EM', 'U', 'S', 'CODE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'UL', 'OL', 'LI', 'BR', 'HR',
  'A',
]);

/** Tags whose text content must NOT be preserved (executable/style code) */
const SILENT_DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

/** Remove on* event-handler attributes from an element */
function removeEventHandlers(el: Element): void {
  const toRemove: string[] = [];
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.toLowerCase().startsWith('on')) {
      toRemove.push(attr.name);
    }
  }
  for (const name of toRemove) {
    el.removeAttribute(name);
  }
}

/** Validate and clean href: only http/https permitted */
function sanitizeHref(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol === 'http:' || url.protocol === 'https:') return href;
  } catch {
    // relative or malformed — reject
  }
  return null;
}

/**
 * Walk the DOM tree bottom-up, replacing disallowed elements with their
 * text content. Runs recursively so nested disallowed tags are also handled.
 */
function walkAndSanitize(node: Element): void {
  // Walk children first (depth-first) so we process from leaves up
  const children = Array.from(node.children);
  for (const child of children) {
    walkAndSanitize(child);
  }

  // Re-read children after recursive pass
  const currentChildren = Array.from(node.children);
  for (const child of currentChildren) {
    const tag = child.tagName.toUpperCase();

    if (!ALLOWED_TAGS.has(tag)) {
      if (SILENT_DROP_TAGS.has(tag)) {
        // Remove entirely — do NOT expose the raw text content of scripts/styles
        child.remove();
      } else {
        // Replace disallowed element with its text content (preserves readable text)
        const text = document.createTextNode(child.textContent ?? '');
        child.replaceWith(text);
      }
      continue;
    }

    // Remove all event handlers unconditionally
    removeEventHandlers(child);

    if (tag === 'A') {
      // Only keep href on <a>, and validate the scheme
      const href = child.getAttribute('href');
      const safeHref = href ? sanitizeHref(href) : null;
      // Remove all attributes first
      const attrNames = Array.from(child.attributes).map((a) => a.name);
      for (const name of attrNames) {
        child.removeAttribute(name);
      }
      if (safeHref) {
        child.setAttribute('href', safeHref);
      }
    } else {
      // Keep only 'class' on non-<a> elements; strip any remaining attrs
      const attrNames = Array.from(child.attributes).map((a) => a.name);
      for (const name of attrNames) {
        if (name !== 'class') {
          child.removeAttribute(name);
        }
      }
      // Sanitize class: remove entries that look like event handlers or JS
      const cls = child.getAttribute('class');
      if (cls) {
        const safe = cls
          .split(/\s+/)
          .filter((c) => !/[()'"=;]/.test(c))
          .join(' ')
          .trim();
        if (safe) {
          child.setAttribute('class', safe);
        } else {
          child.removeAttribute('class');
        }
      }
    }
  }
}

/**
 * Sanitize rich-text HTML before writing to Yjs or rendering to DOM.
 * Uses browser DOMParser (no external deps). Returns sanitized innerHTML.
 */
export function sanitizeRichTextHtml(html: string): string {
  if (!html) return '';

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  walkAndSanitize(body);

  return body.innerHTML;
}
