/** Contract: contracts/app-kb/rules.md */
import { describe, it, expect } from 'vitest';
import { renderSimpleMarkdown } from './simple-markdown.ts';

describe('renderSimpleMarkdown', () => {
  describe('XSS prevention', () => {
    it('escapes HTML entities', () => {
      const result = renderSimpleMarkdown('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('escapes ampersands', () => {
      const result = renderSimpleMarkdown('A & B');
      expect(result).toContain('&amp;');
    });

    it('escapes quotes', () => {
      const result = renderSimpleMarkdown('say "hello"');
      expect(result).toContain('&quot;');
    });
  });

  describe('headings', () => {
    it('converts # to h3', () => {
      const result = renderSimpleMarkdown('# Title');
      expect(result).toContain('<h3>Title</h3>');
    });

    it('converts ## to h4', () => {
      const result = renderSimpleMarkdown('## Subtitle');
      expect(result).toContain('<h4>Subtitle</h4>');
    });

    it('converts ### to h5', () => {
      const result = renderSimpleMarkdown('### Section');
      expect(result).toContain('<h5>Section</h5>');
    });

    it('processes headings in correct order (### before ## before #)', () => {
      const input = '### Small\n## Medium\n# Large';
      const result = renderSimpleMarkdown(input);
      expect(result).toContain('<h5>Small</h5>');
      expect(result).toContain('<h4>Medium</h4>');
      expect(result).toContain('<h3>Large</h3>');
    });
  });

  describe('inline formatting', () => {
    it('renders bold text', () => {
      const result = renderSimpleMarkdown('**bold**');
      expect(result).toContain('<strong>bold</strong>');
    });

    it('renders italic text', () => {
      const result = renderSimpleMarkdown('*italic*');
      expect(result).toContain('<em>italic</em>');
    });

    it('renders inline code', () => {
      const result = renderSimpleMarkdown('use `code` here');
      expect(result).toContain('<code>code</code>');
    });

    it('renders links', () => {
      const result = renderSimpleMarkdown('[click](https://example.com)');
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('target="_blank"');
      expect(result).toContain('rel="noopener"');
      expect(result).toContain('>click</a>');
    });
  });

  describe('lists', () => {
    it('renders unordered lists', () => {
      const result = renderSimpleMarkdown('- item one\n- item two');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>item one</li>');
      expect(result).toContain('<li>item two</li>');
      expect(result).toContain('</ul>');
    });

    it('closes list when non-list line follows', () => {
      const result = renderSimpleMarkdown('- item\nParagraph');
      expect(result).toContain('</ul>');
      expect(result).toContain('Paragraph');
    });
  });

  describe('line breaks', () => {
    it('converts empty lines to <br>', () => {
      const result = renderSimpleMarkdown('line one\n\nline two');
      expect(result).toContain('<br>');
    });

    it('does not add <br> to block elements', () => {
      const result = renderSimpleMarkdown('# Heading');
      expect(result).not.toContain('<br>');
    });
  });

  describe('combined formatting', () => {
    it('processes heading with bold text', () => {
      const result = renderSimpleMarkdown('# **Important** Title');
      expect(result).toContain('<h3>');
      expect(result).toContain('<strong>Important</strong>');
    });

    it('renders empty string without errors', () => {
      const result = renderSimpleMarkdown('');
      expect(result).toBe('<br>');
    });
  });
});
