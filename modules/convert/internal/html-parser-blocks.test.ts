/** Contract: contracts/convert/rules.md */

import { describe, it, expect } from 'vitest';
import { htmlToProseMirrorJson } from './html-parser.ts';

describe('htmlToProseMirrorJson — block parsing', () => {
  it('parses a single paragraph', () => {
    const result = htmlToProseMirrorJson('<p>Hello world</p>');
    expect(result.type).toBe('doc');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('paragraph');
    expect(result.content[0].content?.[0].text).toBe('Hello world');
  });

  it('parses multiple paragraphs', () => {
    const html = '<p>First</p><p>Second</p><p>Third</p>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content).toHaveLength(3);
    expect(result.content[0].content?.[0].text).toBe('First');
    expect(result.content[2].content?.[0].text).toBe('Third');
  });

  it('parses headings with correct level', () => {
    const html = '<h1>Title</h1><h2>Subtitle</h2>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe('heading');
    expect(result.content[0].attrs?.level).toBe(1);
    expect(result.content[1].attrs?.level).toBe(2);
  });

  it('generates unique blockIds for each block', () => {
    const html = '<p>One</p><p>Two</p>';
    const result = htmlToProseMirrorJson(html);
    const id1 = result.content[0].attrs?.blockId;
    const id2 = result.content[1].attrs?.blockId;
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
  });

  it('returns a default paragraph for empty input', () => {
    const result = htmlToProseMirrorJson('');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('paragraph');
  });

  it('handles plain text without block tags', () => {
    const result = htmlToProseMirrorJson('Just some text');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('paragraph');
    expect(result.content[0].content?.[0].text).toBe('Just some text');
  });

  it('parses a bullet list', () => {
    const html = '<ul><li>One</li><li>Two</li><li>Three</li></ul>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content).toHaveLength(1);
    const list = result.content[0];
    expect(list.type).toBe('bulletList');
    expect(list.content).toHaveLength(3);
    expect(list.content![0].type).toBe('listItem');
    expect(list.content![0].content![0].type).toBe('paragraph');
    expect(list.content![0].content![0].content![0].text).toBe('One');
  });

  it('parses an ordered list', () => {
    const html = '<ol><li>First</li><li>Second</li></ol>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content).toHaveLength(1);
    const list = result.content[0];
    expect(list.type).toBe('orderedList');
    expect(list.content).toHaveLength(2);
  });

  it('parses nested lists', () => {
    const html = '<ul><li>Parent<ul><li>Child</li></ul></li></ul>';
    const result = htmlToProseMirrorJson(html);
    const outerList = result.content[0];
    expect(outerList.type).toBe('bulletList');
    const li = outerList.content![0];
    expect(li.type).toBe('listItem');
    expect(li.content).toHaveLength(2);
    expect(li.content![0].type).toBe('paragraph');
    expect(li.content![0].content![0].text).toBe('Parent');
    expect(li.content![1].type).toBe('bulletList');
    expect(li.content![1].content![0].content![0].content![0].text).toBe('Child');
  });

  it('parses a simple table', () => {
    const html = '<table><tr><th>Name</th><th>Age</th></tr><tr><td>Alice</td><td>30</td></tr></table>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content).toHaveLength(1);
    const table = result.content[0];
    expect(table.type).toBe('table');
    expect(table.content).toHaveLength(2);
    // Header row
    const headerRow = table.content![0];
    expect(headerRow.type).toBe('tableRow');
    expect(headerRow.content![0].type).toBe('tableHeader');
    expect(headerRow.content![0].content![0].content![0].text).toBe('Name');
    // Data row
    const dataRow = table.content![1];
    expect(dataRow.content![0].type).toBe('tableCell');
    expect(dataRow.content![0].content![0].content![0].text).toBe('Alice');
  });

  it('parses table cells with colspan and rowspan', () => {
    const html = '<table><tr><td colspan="2">Wide</td></tr><tr><td rowspan="2">Tall</td><td>B</td></tr></table>';
    const result = htmlToProseMirrorJson(html);
    const row1 = result.content[0].content![0];
    expect(row1.content![0].attrs?.colspan).toBe(2);
    const row2 = result.content[0].content![1];
    expect(row2.content![0].attrs?.rowspan).toBe(2);
  });

  it('parses list items with bold text', () => {
    const html = '<ul><li><strong>Bold item</strong></li></ul>';
    const result = htmlToProseMirrorJson(html);
    const li = result.content[0].content![0];
    const textContent = li.content![0].content![0];
    expect(textContent.marks).toEqual([{ type: 'bold' }]);
    expect(textContent.text).toBe('Bold item');
  });

  it('preserves document order with mixed content', () => {
    const html = '<p>Intro</p><ul><li>Item</li></ul><table><tr><td>Cell</td></tr></table><p>End</p>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content).toHaveLength(4);
    expect(result.content[0].type).toBe('paragraph');
    expect(result.content[1].type).toBe('bulletList');
    expect(result.content[2].type).toBe('table');
    expect(result.content[3].type).toBe('paragraph');
  });

  it('handles <p> inside <li> cleanly', () => {
    const html = '<ul><li><p>Item in paragraph</p></li></ul>';
    const result = htmlToProseMirrorJson(html);
    const li = result.content[0].content![0];
    expect(li.content![0].content![0].text).toBe('Item in paragraph');
  });

  it('handles table with thead/tbody wrappers', () => {
    const html = '<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>';
    const result = htmlToProseMirrorJson(html);
    const table = result.content[0];
    expect(table.type).toBe('table');
    expect(table.content).toHaveLength(2);
    expect(table.content![0].content![0].type).toBe('tableHeader');
    expect(table.content![1].content![0].type).toBe('tableCell');
  });
});
