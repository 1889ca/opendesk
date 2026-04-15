/** Contract: contracts/app/rules.md */
/**
 * Spell check enhancement — Issue #358.
 *
 * Browser native spellcheck is already enabled via spellcheck="true" on the
 * ProseMirror element (set in editor.ts editorProps).
 *
 * This module adds:
 * - A 'opendesk:spellcheck-cycle' event handler that cycles the cursor through
 *   words in the document, which triggers the browser's built-in spell check
 *   context menu on each word.
 * - CSS in public/spellcheck.css styles the ::spelling-error pseudo-element.
 */

export function initSpellCheckCycle(editorEl: HTMLElement): void {
  let spellPos = 0;

  document.addEventListener('opendesk:spellcheck-cycle', () => {
    const content = editorEl.querySelector('.editor-content') ?? editorEl;
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) textNodes.push(n as Text);
    if (textNodes.length === 0) return;

    const words: { node: Text; start: number; end: number }[] = [];
    for (const node of textNodes) {
      const text = node.textContent ?? '';
      const regex = /\b\w+\b/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        words.push({ node, start: m.index, end: m.index + m[0].length });
      }
    }
    if (words.length === 0) return;

    const idx = spellPos % words.length;
    spellPos = idx + 1;
    const { node, start, end } = words[idx];

    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    sel.removeAllRanges();
    sel.addRange(range);
    node.parentElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    editorEl.focus();
  });
}
