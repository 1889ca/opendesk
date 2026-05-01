/** Contract: contracts/app-slides/rules.md */
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { getUserIdentity, getDocumentId, setupTitleSync, mountAppToolbar } from '@opendesk/app';
import { createInteractionController, type InteractionController } from './element-interaction.ts';
import type { SlideElement, SlidesElements, SlidesCleanup } from './types.ts';
import { renderElement } from './element-renderer.ts';
import { createInsertToolbar, type InsertAction } from './insert-toolbar.ts';
import { insertElement, updateTableCell } from './yjs-element-insert.ts';
import { applyFieldUpdate } from './yjs-mutations.ts';
import { createTextElement, createImageElement, createShapeElement, createTableElement, ensureDefaultSlide } from './element-factory.ts';
import { openSlideImagePicker, setupSlideDragDrop } from './slide-image-upload.ts';
import { parseSlideElements } from './parse-elements.ts';
import { initLayoutAndTheme } from './layout-theme-init.ts';
import { createSpeakerNotes } from './speaker-notes.ts';
import { launchPresenterMode } from './presenter-mode.ts';
import { initToolbarExtras } from './toolbar-extras.ts';
import { initAnimations } from './animation-init.ts';
import { pruneAnimationsForMissingElements } from './animation-yjs.ts';
import { sanitizeRichTextHtml } from './sanitize-rich-text.ts';

/**
 * Initialise the presentation editor with a given document ID and DOM elements.
 * Returns a cleanup function to destroy collab resources on unmount.
 */
export function initSlides(documentId: string, els: SlidesElements): SlidesCleanup {
  const { slideListEl, viewportEl, canvasEl, statusEl, usersEl, addSlideBtn, toolbarRight } = els;

  setupTitleSync(documentId, 'OpenDesk Presentation');
  const user = getUserIdentity();
  const ydoc = new Y.Doc();

  const provider = new HocuspocusProvider({
    url: `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/collab`,
    name: documentId, document: ydoc,
    onConnect() { if (statusEl) { statusEl.textContent = 'Connected'; statusEl.className = 'status connected'; } },
    onDisconnect() { if (statusEl) { statusEl.textContent = 'Disconnected'; statusEl.className = 'status disconnected'; } },
  });

  const yslides = ydoc.getArray<Y.Map<unknown>>('slides');
  let activeSlideIndex = 0;

  function getActiveYElements(): Y.Array<Y.Map<unknown>> {
    const slide = yslides.get(activeSlideIndex);
    return (slide?.get('elements') as Y.Array<Y.Map<unknown>>) || new Y.Array<Y.Map<unknown>>();
  }

  function getSlideElements(slideIndex: number): SlideElement[] {
    const slide = yslides.get(slideIndex);
    if (!slide) return [];
    const elements = slide.get('elements') as Y.Array<Y.Map<unknown>> | undefined;
    if (!elements) return [];
    return parseSlideElements(elements);
  }

  function handleContentUpdate(elementId: string, content: string) {
    const safeContent = sanitizeRichTextHtml(content); // invariant 12
    const yElements = getActiveYElements();
    ydoc.transact(() => {
      for (let i = 0; i < yElements.length; i++) {
        const yel = yElements.get(i);
        if (yel.get('id') === elementId) { yel.set('content', safeContent); break; }
      }
    });
  }

  function handleStyleUpdate(elementId: string, field: string, value: unknown) {
    applyFieldUpdate(ydoc, { yElements: getActiveYElements() }, elementId, field, value);
  }

  function handleCellUpdate(elementId: string, row: number, col: number, value: string) {
    updateTableCell(ydoc, getActiveYElements(), elementId, row, col, value);
  }

  const notesPanel = createSpeakerNotes({ ydoc, yslides });
  if (canvasEl) canvasEl.appendChild(notesPanel.element);

  function renderSlideList() {
    ensureDefaultSlide(ydoc, yslides);
    slideListEl.innerHTML = '';
    for (let i = 0; i < yslides.length; i++) {
      const thumb = document.createElement('div');
      thumb.className = 'slide-thumb' + (i === activeSlideIndex ? ' active' : '');
      const num = document.createElement('span');
      num.className = 'slide-thumb-number';
      num.textContent = String(i + 1);
      thumb.appendChild(num);
      thumb.addEventListener('click', () => {
        activeSlideIndex = i;
        renderSlideList();
        renderActiveSlide();
        notesPanel.update(i);
      });
      slideListEl.appendChild(thumb);
    }
  }

  function renderActiveSlide() {
    viewportEl.innerHTML = '';
    for (const el of getSlideElements(activeSlideIndex)) {
      const result = renderElement(el, handleContentUpdate, handleStyleUpdate, handleCellUpdate);
      viewportEl.appendChild(result.dom);
    }
  }

  renderSlideList(); renderActiveSlide(); notesPanel.update(activeSlideIndex);

  let interactionCtrl: InteractionController | null = createInteractionController({
    ydoc, viewport: viewportEl,
    getActiveSlideElements() {
      return { yElements: getActiveYElements(), elements: getSlideElements(activeSlideIndex) };
    },
    onStyleUpdate: handleStyleUpdate,
  });

  const insertToolbar = createInsertToolbar((action: InsertAction) => {
    const yEls = getActiveYElements();
    const creators: Record<string, () => void> = {
      text: () => insertElement(ydoc, yEls, createTextElement()),
      image: () => openSlideImagePicker(documentId, (url) => insertElement(ydoc, yEls, createImageElement(url))),
      shape: () => insertElement(ydoc, yEls, createShapeElement((action as { shapeType: string }).shapeType as Parameters<typeof createShapeElement>[0])),
      table: () => insertElement(ydoc, yEls, createTableElement((action as { rows: number }).rows, (action as { cols: number }).cols)),
    };
    creators[action.type]?.();
  });
  if (toolbarRight) toolbarRight.insertBefore(insertToolbar, toolbarRight.firstChild);

  setupSlideDragDrop(viewportEl, documentId, (url) => insertElement(ydoc, getActiveYElements(), createImageElement(url)));

  initLayoutAndTheme({
    ydoc, yslides, viewportEl, toolbarRight, addSlideBtn,
    onSlideAdded(index) {
      activeSlideIndex = index;
      renderSlideList();
      renderActiveSlide();
    },
  });

  const animationInit = initAnimations({
    ydoc, yslides, canvasEl, toolbarRight,
    getActiveSlideIndex: () => activeSlideIndex,
    getInteractionController: () => interactionCtrl,
  });

  const presentBtn = Object.assign(document.createElement('button'), { className: 'slide-present-btn', textContent: 'Present' });
  presentBtn.addEventListener('click', () => launchPresenterMode({ yslides, getSlideElements, totalSlides: () => yslides.length }, activeSlideIndex));
  if (toolbarRight) toolbarRight.appendChild(presentBtn);

  const extras = initToolbarExtras({
    ydoc, yslides, toolbarRight, slideListEl,
    getActiveIndex: () => activeSlideIndex,
    setActiveIndex(i) { activeSlideIndex = i; },
    onChanged() { renderSlideList(); renderActiveSlide(); notesPanel.update(activeSlideIndex); },
  });

  yslides.observeDeep(() => {
    renderSlideList(); renderActiveSlide(); notesPanel.update(activeSlideIndex); extras.updateTransitionPicker();
    const slide = yslides.get(activeSlideIndex);
    if (slide) pruneAnimationsForMissingElements(ydoc, slide, new Set(getSlideElements(activeSlideIndex).map((e) => e.id)));
  });

  provider.awareness?.setLocalStateField('user', user);
  const showUsers = () => {
    if (!usersEl || !provider.awareness) return;
    const n: string[] = [];
    provider.awareness.getStates().forEach((s: { user?: { name?: string } }) => { if (s.user?.name) n.push(s.user.name); });
    usersEl.textContent = n.join(', ') || '-';
  };
  provider.awareness?.on('change', showUsers);
  showUsers();

  return {
    destroy() {
      animationInit.destroy();
      interactionCtrl?.destroy();
      interactionCtrl = null;
      provider.destroy();
      ydoc.destroy();
    },
  };
}

/** Page-level entry point: read doc ID from URL, build from existing HTML. */
function init() {
  const refs = mountAppToolbar();
  const slideListEl = document.getElementById('slide-list');
  const viewportEl = document.getElementById('slide-viewport');
  if (!slideListEl || !viewportEl) return;
  initSlides(getDocumentId(), {
    slideListEl,
    viewportEl,
    canvasEl: document.getElementById('slide-canvas'),
    statusEl: refs.statusEl,
    usersEl: refs.usersEl,
    addSlideBtn: document.getElementById('add-slide-btn'),
    toolbarRight: refs.toolbarRightEl,
  });
}

document.addEventListener('DOMContentLoaded', init);
