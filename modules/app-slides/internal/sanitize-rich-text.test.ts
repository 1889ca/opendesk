/** Contract: contracts/app-slides/rules.md */
// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { sanitizeRichTextHtml } from './sanitize-rich-text.ts';

describe('sanitizeRichTextHtml', () => {
  describe('strips event handlers', () => {
    it('removes onclick attributes', () => {
      const result = sanitizeRichTextHtml('<p onclick="alert(1)">Hello</p>');
      expect(result).not.toContain('onclick');
      expect(result).toContain('Hello');
    });

    it('removes onload attributes', () => {
      const result = sanitizeRichTextHtml('<p onload="steal()">text</p>');
      expect(result).not.toContain('onload');
    });

    it('removes onerror attributes', () => {
      const result = sanitizeRichTextHtml('<p onerror="xss()">text</p>');
      expect(result).not.toContain('onerror');
    });

    it('removes all on* attributes regardless of case', () => {
      const result = sanitizeRichTextHtml('<p ONCLICK="bad()" OnMouseOver="bad()">text</p>');
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('ONCLICK');
      expect(result).not.toContain('OnMouseOver');
      expect(result).not.toContain('onmouseover');
    });
  });

  describe('strips disallowed tags', () => {
    it('removes script tags and replaces with text content', () => {
      const result = sanitizeRichTextHtml('<p>safe<script>alert("xss")</script></p>');
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
    });

    it('removes iframe tags', () => {
      const result = sanitizeRichTextHtml('<p>text<iframe src="evil.html"></iframe></p>');
      expect(result).not.toContain('<iframe');
    });

    it('removes img tags (not in allowlist)', () => {
      const result = sanitizeRichTextHtml('<p>text<img src="https://evil.com/track.gif" onerror="xss()"></p>');
      expect(result).not.toContain('<img');
      expect(result).not.toContain('onerror');
    });

    it('removes style tags', () => {
      const result = sanitizeRichTextHtml('<style>body { display: none }</style><p>text</p>');
      expect(result).not.toContain('<style');
    });

    it('removes nested disallowed tags', () => {
      const result = sanitizeRichTextHtml('<p><span data-x="y">nested <script>bad()</script></span></p>');
      expect(result).not.toContain('<script');
      expect(result).not.toContain('<span');
    });
  });

  describe('preserves valid markup', () => {
    it('preserves <strong>', () => {
      const result = sanitizeRichTextHtml('<p><strong>Bold</strong></p>');
      expect(result).toContain('<strong>Bold</strong>');
    });

    it('preserves <em>', () => {
      const result = sanitizeRichTextHtml('<p><em>Italic</em></p>');
      expect(result).toContain('<em>Italic</em>');
    });

    it('preserves <u>', () => {
      const result = sanitizeRichTextHtml('<p><u>Underline</u></p>');
      expect(result).toContain('<u>Underline</u>');
    });

    it('preserves <s> (strikethrough)', () => {
      const result = sanitizeRichTextHtml('<p><s>Strike</s></p>');
      expect(result).toContain('<s>Strike</s>');
    });

    it('preserves heading tags', () => {
      const result = sanitizeRichTextHtml('<h1>Title</h1><h2>Sub</h2>');
      expect(result).toContain('<h1>Title</h1>');
      expect(result).toContain('<h2>Sub</h2>');
    });

    it('preserves <a> with http href', () => {
      const result = sanitizeRichTextHtml('<p><a href="https://example.com">link</a></p>');
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('link');
    });

    it('preserves list markup', () => {
      const result = sanitizeRichTextHtml('<ul><li>Item 1</li><li>Item 2</li></ul>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
    });

    it('preserves <blockquote>', () => {
      const result = sanitizeRichTextHtml('<blockquote>Quote</blockquote>');
      expect(result).toContain('<blockquote>Quote</blockquote>');
    });

    it('preserves <code>', () => {
      const result = sanitizeRichTextHtml('<p><code>const x = 1;</code></p>');
      expect(result).toContain('<code>const x = 1;</code>');
    });

    it('returns empty string for empty input', () => {
      expect(sanitizeRichTextHtml('')).toBe('');
    });

    it('handles plain text with no tags', () => {
      const result = sanitizeRichTextHtml('just text');
      expect(result).toContain('just text');
    });
  });

  describe('sanitizes <a> href', () => {
    it('allows https href on <a>', () => {
      const result = sanitizeRichTextHtml('<a href="https://example.com">link</a>');
      expect(result).toContain('href="https://example.com"');
    });

    it('allows http href on <a>', () => {
      const result = sanitizeRichTextHtml('<a href="http://example.com">link</a>');
      expect(result).toContain('href="http://example.com"');
    });

    it('strips javascript: href', () => {
      const result = sanitizeRichTextHtml('<a href="javascript:alert(1)">click</a>');
      expect(result).not.toContain('javascript:');
      expect(result).toContain('click');
    });

    it('strips data: href', () => {
      const result = sanitizeRichTextHtml('<a href="data:text/html,<script>xss</script>">click</a>');
      expect(result).not.toContain('data:');
    });

    it('strips non-href attributes from <a>', () => {
      const result = sanitizeRichTextHtml('<a href="https://ok.com" onclick="bad()" class="c">text</a>');
      expect(result).not.toContain('onclick');
      expect(result).toContain('href="https://ok.com"');
    });
  });
});
