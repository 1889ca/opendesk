/** Contract: contracts/kb/rules.md */

/**
 * Markdown serialization and parsing helpers for KB import/export.
 * Handles YAML front-matter, Confluence HTML-to-Markdown conversion,
 * and KB entry serialization.
 */

/** Serialize a KB entry as a Markdown string with YAML front-matter. */
export function entryToMarkdown(entry: {
  id: string; entryType: string; title: string; metadata: Record<string, unknown>;
  tags: string[]; version: number; corpus: string; jurisdiction: string | null;
  createdBy: string; createdAt: Date | string; updatedAt: Date | string;
}): string {
  const lines: string[] = [
    '---',
    `id: ${entry.id}`,
    `title: ${JSON.stringify(entry.title)}`,
    `entry_type: ${entry.entryType}`,
    `tags: [${entry.tags.map((t) => JSON.stringify(t)).join(', ')}]`,
    `version: ${entry.version}`,
    `corpus: ${entry.corpus}`,
  ];
  if (entry.jurisdiction) lines.push(`jurisdiction: ${entry.jurisdiction}`);
  lines.push(`created_by: ${entry.createdBy}`);
  lines.push(`created_at: ${new Date(entry.createdAt).toISOString()}`);
  lines.push(`updated_at: ${new Date(entry.updatedAt).toISOString()}`);
  lines.push('---', '', `# ${entry.title}`, '');

  const mainText = (entry.metadata.body ?? entry.metadata.content ?? entry.metadata.description) as string | undefined;
  if (mainText) lines.push(String(mainText), '');

  const otherMeta = Object.entries(entry.metadata).filter(([k]) => !['body', 'content', 'description'].includes(k));
  if (otherMeta.length > 0) {
    lines.push('## Metadata', '');
    for (const [k, v] of otherMeta) {
      lines.push(`**${k}:** ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** Parse YAML front-matter from a Markdown string. */
export function parseFrontMatter(md: string): { frontMatter: Record<string, string>; body: string } {
  const frontMatter: Record<string, string> = {};
  const trimmed = md.trimStart();
  if (!trimmed.startsWith('---')) return { frontMatter, body: md };
  const end = trimmed.indexOf('\n---', 3);
  if (end === -1) return { frontMatter, body: md };
  for (const line of trimmed.slice(3, end).trim().split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    frontMatter[line.slice(0, colon).trim()] = line.slice(colon + 1).trim().replace(/^"|"$/g, '');
  }
  return { frontMatter, body: trimmed.slice(end + 4).trimStart() };
}

/** Parse Confluence HTML export — extract title and body as plain text. */
export function parseConfluenceHtml(html: string): { title: string; body: string } {
  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Imported Entry';
  const bodyMatch = html.match(/<div[^>]+class="[^"]*wiki-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    ?? html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const rawBody = bodyMatch ? bodyMatch[1] : html;
  const body = rawBody
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis, (_, t) => `\n## ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<p[^>]*>(.*?)<\/p>/gis, (_, t) => `\n${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<li[^>]*>(.*?)<\/li>/gis, (_, t) => `- ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n').trim();
  return { title, body };
}
