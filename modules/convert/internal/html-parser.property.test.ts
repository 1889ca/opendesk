/** Contract: contracts/convert/rules.md — Property-based tests */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { htmlToProseMirrorJson, stripTags } from './html-parser.ts';

/** Collect all text content from a ProseMirror node tree */
function collectText(node: Record<string, unknown>): string {
  let text = '';
  if (typeof node.text === 'string') text += node.text;
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += collectText(child as Record<string, unknown>);
    }
  }
  return text;
}

describe('convert/html-parser property tests', () => {
  it('handles nested tags without crashing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.stringMatching(/^[a-zA-Z]{1,30}$/),
        (depth: number, text: string) => {
          let html = text;
          for (let i = 0; i < depth; i++) {
            html = `<p>${html}</p>`;
          }
          const doc = htmlToProseMirrorJson(html);
          expect(doc.type).toBe('doc');
          expect(doc.content.length).toBeGreaterThan(0);
        },
      ),
    );
  });

  it('does not crash on malformed HTML', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 1000 }), (input: string) => {
        const doc = htmlToProseMirrorJson(input);
        expect(doc.type).toBe('doc');
        expect(Array.isArray(doc.content)).toBe(true);
        expect(doc.content.length).toBeGreaterThan(0);
      }),
    );
  });

  it('preserves text content from paragraph tags', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]{1,100}$/),
        (text: string) => {
          const html = `<p>${text}</p>`;
          const doc = htmlToProseMirrorJson(html);
          const outputText = collectText(
            doc as unknown as Record<string, unknown>,
          );
          expect(outputText).toContain(text);
        },
      ),
    );
  });

  it('always returns a doc with at least one content node', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (input: string) => {
        const doc = htmlToProseMirrorJson(input);
        expect(doc.type).toBe('doc');
        expect(doc.content.length).toBeGreaterThanOrEqual(1);
      }),
    );
  });

  it('stripTags removes all HTML tags and preserves text', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]{1,50}$/),
        fc.constantFrom('p', 'strong', 'em', 'div', 'span', 'h1'),
        (text: string, tag: string) => {
          const html = `<${tag}>${text}</${tag}>`;
          const stripped = stripTags(html);
          expect(stripped).toBe(text);
        },
      ),
    );
  });
});
