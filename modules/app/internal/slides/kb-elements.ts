/** Contract: contracts/app/rules.md */

/**
 * KB element rendering for slides.
 * Creates styled DOM elements for citations, entity mentions,
 * and dataset charts inserted from the KB.
 */

import * as Y from 'yjs';
import type { KbInsertResult } from './kb-picker.ts';
import { apiFetch } from '../shared/api-client.ts';

/**
 * Insert a KB item into the slide as a new element.
 * Citations become styled text blocks, entities become mention chips,
 * datasets become chart image placeholders.
 */
export function insertKbElement(
  ydoc: Y.Doc,
  yslides: Y.Array<Y.Map<unknown>>,
  activeSlideIndex: number,
  result: KbInsertResult,
): void {
  const slide = yslides.get(activeSlideIndex);
  if (!slide) return;

  const elements = slide.get('elements') as Y.Array<Y.Map<unknown>> | undefined;
  if (!elements) return;

  ydoc.transact(() => {
    const el = new Y.Map<unknown>();
    el.set('id', crypto.randomUUID());
    el.set('type', 'text');
    el.set('x', 10);
    el.set('y', 70);
    el.set('width', 80);
    el.set('height', 15);

    const attrs: Record<string, unknown> = {
      kbRef: true,
      kbMode: result.mode,
      kbId: result.id,
      kbType: result.type,
    };

    if (result.updatedAt) {
      attrs.kbUpdatedAt = result.updatedAt;
    }

    if (result.mode === 'citation') {
      el.set('content', result.content);
      attrs.kbStyle = 'citation';
    } else if (result.mode === 'entity') {
      el.set('content', result.content);
      attrs.kbStyle = 'entity';
    } else if (result.mode === 'dataset') {
      el.set('content', `[Chart: ${result.content}]`);
      el.set('type', 'image');
      el.set('height', 30);
      attrs.kbStyle = 'dataset-chart';
    }

    el.set('attrs', attrs);
    elements.push([el]);
  });
}

/**
 * Render a slide element with KB-specific styling.
 * Returns additional CSS classes and attributes for the DOM element.
 */
export function applyKbStyling(
  div: HTMLElement,
  attrs: Record<string, unknown> | undefined,
): void {
  if (!attrs?.kbRef) return;

  div.classList.add('slide-kb-element');
  div.dataset.kbId = String(attrs.kbId || '');
  div.dataset.kbMode = String(attrs.kbMode || '');

  const style = attrs.kbStyle as string;
  if (style === 'citation') {
    div.classList.add('slide-kb-citation');
  } else if (style === 'entity') {
    div.classList.add('slide-kb-entity');
  } else if (style === 'dataset-chart') {
    div.classList.add('slide-kb-dataset');
  }
}

/**
 * Check if a KB reference has been updated since it was inserted.
 * Attaches a "source updated" indicator to stale elements.
 */
export async function checkKbSourceUpdates(
  viewport: HTMLElement,
): Promise<void> {
  const kbElements = Array.from(viewport.querySelectorAll<HTMLElement>('.slide-kb-element'));

  for (const el of kbElements) {
    const kbId = el.dataset.kbId;
    if (!kbId) continue;

    // Remove existing indicator
    el.querySelector('.kb-stale-indicator')?.remove();

    try {
      const res = await apiFetch(`/api/references/${encodeURIComponent(kbId)}`);
      if (!res.ok) continue;

      const ref = await res.json();
      const insertedAt = el.dataset.kbUpdatedAt;
      if (insertedAt && ref.updatedAt && ref.updatedAt > insertedAt) {
        const indicator = document.createElement('span');
        indicator.className = 'kb-stale-indicator';
        indicator.title = 'Source has been updated since insertion';
        indicator.textContent = 'Updated';
        el.appendChild(indicator);
      }
    } catch {
      // Silently skip - reference may have been deleted
    }
  }
}
