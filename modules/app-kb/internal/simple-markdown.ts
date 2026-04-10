/** Contract: contracts/app-kb/rules.md */

/**
 * Lightweight markdown-to-HTML renderer for note bodies.
 * XSS-safe: escapes HTML entities before applying markdown transforms.
 * No external dependencies.
 */

/** Escape HTML entities to prevent XSS. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert a block of lines into an unordered list if they start with "- ". */
function processLists(html: string): string {
  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const match = line.match(/^- (.+)$/);
    if (match) {
      if (!inList) { result.push('<ul>'); inList = true; }
      result.push(`<li>${match[1]}</li>`);
    } else {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(line);
    }
  }
  if (inList) result.push('</ul>');
  return result.join('\n');
}

/** Convert headings (# to ###). */
function processHeadings(html: string): string {
  return html
    .replace(/^### (.+)$/gm, '<h5>$1</h5>')
    .replace(/^## (.+)$/gm, '<h4>$1</h4>')
    .replace(/^# (.+)$/gm, '<h3>$1</h3>');
}

/** Convert inline formatting: bold, italic, code, links, and KB internal links. */
function processInline(html: string): string {
  return html
    // inline code (before bold/italic to avoid conflicts)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // KB internal links [[title|id]] — must come before external links
    .replace(
      /\[\[([^\]|]+)\|([^\]]+)\]\]/g,
      '<a class="kb-internal-link" data-kb-entry-id="$2" href="#kb-entry-$2">$1</a>',
    )
    // bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // italic (single asterisk, not inside bold)
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // links [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

/** Convert remaining newlines to <br> (skip lines already wrapped in block elements). */
function processLineBreaks(html: string): string {
  return html
    .split('\n')
    .map((line) => {
      if (/^<(h[345]|ul|\/ul|li|\/li)/.test(line)) return line;
      return line || '<br>';
    })
    .join('\n');
}

/**
 * Render simple markdown text to HTML.
 * Supports: headings (#-###), bold (**), italic (*), inline code (`),
 * unordered lists (-), links [text](url), and line breaks.
 */
export function renderSimpleMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = processHeadings(html);
  html = processLists(html);
  html = processInline(html);
  html = processLineBreaks(html);
  return html;
}
