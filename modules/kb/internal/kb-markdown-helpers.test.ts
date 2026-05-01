/** Contract: contracts/kb/rules.md — kb-markdown-helpers tests */
import { describe, it, expect } from 'vitest';
import { parseConfluenceHtml, parseFrontMatter, entryToMarkdown } from './kb-markdown-helpers.ts';

// ---------------------------------------------------------------------------
// parseConfluenceHtml — XSS regression (issue #513 / original #485)
// ---------------------------------------------------------------------------

describe('parseConfluenceHtml — XSS prevention', () => {
  it('does not include <script> tags when input uses entity-encoded markup (PoC from #513)', () => {
    // PoC: entity-encoded tags were decoded AFTER stripping, so strip was a no-op.
    // With the fix, decoding happens first, turning &lt;script&gt; into <script>,
    // which is then stripped before reaching the output.
    const input = '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>';
    const { body } = parseConfluenceHtml(input);
    expect(body).not.toContain('<script>');
    expect(body).not.toContain('</script>');
  });

  it('does not include <script> in title when entity-encoded inside h1', () => {
    const input = '<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1><p>Safe content</p>';
    const { title } = parseConfluenceHtml(input);
    expect(title).not.toContain('<script>');
    expect(title).not.toContain('</script>');
  });

  it('strips entity-encoded script tags in list items', () => {
    const input = '<ul><li>&lt;script&gt;evil()&lt;/script&gt;text</li></ul>';
    const { body } = parseConfluenceHtml(input);
    expect(body).not.toContain('<script>');
  });

  it('strips entity-encoded script tags in headings', () => {
    const input = '<h2>&lt;script&gt;evil()&lt;/script&gt;Heading</h2>';
    const { body } = parseConfluenceHtml(input);
    expect(body).not.toContain('<script>');
  });
});

// ---------------------------------------------------------------------------
// parseConfluenceHtml — correct output for clean Confluence HTML
// ---------------------------------------------------------------------------

describe('parseConfluenceHtml — standard extraction', () => {
  it('extracts title from h1', () => {
    const { title } = parseConfluenceHtml('<h1>My Page</h1><p>Hello</p>');
    expect(title).toBe('My Page');
  });

  it('falls back to "Imported Entry" when no h1 is present', () => {
    const { title } = parseConfluenceHtml('<p>No title here</p>');
    expect(title).toBe('Imported Entry');
  });

  it('extracts body paragraphs as plain text', () => {
    const { body } = parseConfluenceHtml('<p>First paragraph</p><p>Second paragraph</p>');
    expect(body).toContain('First paragraph');
    expect(body).toContain('Second paragraph');
  });

  it('decodes harmless entities in body text', () => {
    const { body } = parseConfluenceHtml('<p>AT&amp;T &amp; friends</p>');
    expect(body).toContain('AT&T & friends');
  });

  it('converts h2-h6 headings to markdown ## headings', () => {
    const { body } = parseConfluenceHtml('<h2>Section One</h2><p>Text</p>');
    expect(body).toContain('## Section One');
  });

  it('converts list items to markdown bullets', () => {
    const { body } = parseConfluenceHtml('<ul><li>Item A</li><li>Item B</li></ul>');
    expect(body).toContain('- Item A');
    expect(body).toContain('- Item B');
  });

  it('prefers wiki-content div over body when both present', () => {
    const input =
      '<body><div class="wiki-content">Wiki text</div><p>Body only</p></body>';
    const { body } = parseConfluenceHtml(input);
    expect(body).toContain('Wiki text');
  });
});

// ---------------------------------------------------------------------------
// parseFrontMatter
// ---------------------------------------------------------------------------

describe('parseFrontMatter', () => {
  it('parses YAML front-matter correctly', () => {
    const md = '---\nid: abc\ntitle: "Hello"\n---\nBody text';
    const { frontMatter, body } = parseFrontMatter(md);
    expect(frontMatter.id).toBe('abc');
    expect(frontMatter.title).toBe('Hello');
    expect(body).toBe('Body text');
  });

  it('returns empty frontMatter when no front-matter delimiter', () => {
    const { frontMatter, body } = parseFrontMatter('Just a body');
    expect(frontMatter).toEqual({});
    expect(body).toBe('Just a body');
  });
});

// ---------------------------------------------------------------------------
// entryToMarkdown — round-trip smoke test
// ---------------------------------------------------------------------------

describe('entryToMarkdown', () => {
  it('produces a markdown string with YAML front-matter and title heading', () => {
    const entry = {
      id: 'test-id',
      entryType: 'note',
      title: 'Test Entry',
      metadata: { body: 'Some body text' },
      tags: ['a', 'b'],
      version: 1,
      corpus: 'default',
      jurisdiction: null,
      createdBy: 'user-1',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };
    const md = entryToMarkdown(entry);
    expect(md).toContain('---');
    expect(md).toContain('id: test-id');
    expect(md).toContain('# Test Entry');
    expect(md).toContain('Some body text');
  });
});
