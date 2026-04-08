/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import type { ReferenceData } from './types.ts';
import { formatBibliographyEntry, type CitationStyle } from './citation-render.ts';
import { apiFetch } from '../../shared/api-client.ts';

/** Cache of fetched reference data keyed by referenceId. */
const refCache = new Map<string, ReferenceData>();

/** Scan the ProseMirror doc for all unique citation referenceIds. */
function collectReferenceIds(editor: Editor): Set<string> {
  const ids = new Set<string>();
  const { doc } = editor.state;
  doc.descendants((node) => {
    node.marks.forEach((mark) => {
      if (mark.type.name === 'citation' && mark.attrs.referenceId) {
        ids.add(mark.attrs.referenceId as string);
      }
    });
  });
  return ids;
}

/** Fetch reference data, using cache when available. */
async function fetchReferences(ids: Set<string>): Promise<ReferenceData[]> {
  const toFetch = [...ids].filter((id) => !refCache.has(id));
  const fetches = toFetch.map(async (id) => {
    try {
      const res = await apiFetch(`/api/references/${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = (await res.json()) as ReferenceData;
      refCache.set(id, data);
    } catch {
      /* network error — skip this reference */
    }
  });
  await Promise.all(fetches);
  return [...ids].map((id) => refCache.get(id)).filter(Boolean) as ReferenceData[];
}

/** Render bibliography entries into the container element. */
function renderEntries(
  container: HTMLElement,
  refs: ReferenceData[],
  style: CitationStyle,
): void {
  container.innerHTML = '';
  const heading = document.createElement('h2');
  heading.textContent = 'References';
  container.appendChild(heading);

  if (refs.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'bibliography-empty';
    empty.textContent = 'No citations in document.';
    container.appendChild(empty);
    return;
  }

  const sorted = [...refs].sort((a, b) => {
    const aName = a.authors[0]?.family ?? a.authors[0]?.literal ?? a.title;
    const bName = b.authors[0]?.family ?? b.authors[0]?.literal ?? b.title;
    return aName.localeCompare(bName);
  });

  sorted.forEach((ref, i) => {
    const entry = document.createElement('p');
    entry.className = 'bibliography-entry';
    if (style === 'vancouver') {
      entry.textContent = `[${i + 1}] ${formatBibliographyEntry(ref, style)}`;
    } else {
      entry.textContent = formatBibliographyEntry(ref, style);
    }
    container.appendChild(entry);
  });
}

/** Simple debounce helper. */
function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout>;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

export interface BibliographyHandle {
  element: HTMLElement;
  destroy: () => void;
  setStyle: (style: CitationStyle) => void;
}

/**
 * Create an auto-updating bibliography section for the editor.
 * The returned element should be appended outside the editable content.
 */
export function createBibliography(
  editor: Editor,
  initialStyle: CitationStyle = 'apa',
): BibliographyHandle {
  const section = document.createElement('section');
  section.className = 'bibliography';
  section.setAttribute('aria-label', 'Bibliography');

  let currentStyle: CitationStyle = initialStyle;
  let prevIds = new Set<string>();
  let destroyed = false;

  async function update(): Promise<void> {
    if (destroyed) return;
    const ids = collectReferenceIds(editor);

    /* Skip fetch if the id set hasn't changed. */
    const idsChanged = ids.size !== prevIds.size || [...ids].some((id) => !prevIds.has(id));
    if (!idsChanged) return;
    prevIds = ids;

    const refs = await fetchReferences(ids);
    if (destroyed) return;
    renderEntries(section, refs, currentStyle);
  }

  const debouncedUpdate = debounce(() => void update(), 500);

  /* Initial render. */
  void update();

  /* Listen for document changes. */
  editor.on('update', debouncedUpdate);

  return {
    element: section,
    destroy() {
      destroyed = true;
      editor.off('update', debouncedUpdate);
    },
    setStyle(style: CitationStyle) {
      currentStyle = style;
      prevIds = new Set(); /* force re-render */
      void update();
    },
  };
}

/** Generate bibliography HTML string for export (non-interactive). */
export async function getBibliographyHtml(
  editor: Editor,
  style: CitationStyle = 'apa',
): Promise<string> {
  const ids = collectReferenceIds(editor);
  if (ids.size === 0) return '';
  const refs = await fetchReferences(ids);
  if (refs.length === 0) return '';

  const sorted = [...refs].sort((a, b) => {
    const aName = a.authors[0]?.family ?? a.authors[0]?.literal ?? a.title;
    const bName = b.authors[0]?.family ?? b.authors[0]?.literal ?? b.title;
    return aName.localeCompare(bName);
  });

  const entries = sorted.map((ref, i) => {
    const text = style === 'vancouver'
      ? `[${i + 1}] ${formatBibliographyEntry(ref, style)}`
      : formatBibliographyEntry(ref, style);
    return `<p class="bibliography-entry">${text}</p>`;
  }).join('\n');

  return `<section class="bibliography"><h2>References</h2>\n${entries}\n</section>`;
}
