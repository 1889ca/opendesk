/** Contract: contracts/app-slides/rules.md */
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { getUserIdentity, getDocumentId, setupTitleSync, mountAppToolbar } from '@opendesk/app';
import { createInteractionController, type InteractionController } from './element-interaction.ts';
import type { SlideElement } from './types.ts';
import { renderElement } from './element-renderer.ts';
import { createInsertToolbar, type InsertAction } from './insert-toolbar.ts';
import { insertElement, updateTableCell } from './yjs-element-insert.ts';
import { applyFieldUpdate } from './yjs-mutations.ts';
import { createTextElement, createImageElement, createShapeElement, createTableElement } from './element-factory.ts';
import { openSlideImagePicker, setupSlideDragDrop } from './slide-image-upload.ts';
import { parseSlideElements } from './parse-elements.ts';
import { initLayoutAndTheme } from './layout-theme-init.ts';
import { createSpeakerNotes } from './speaker-notes.ts';
import { launchPresenterMode } from './presenter-mode.ts';
import { initToolbarExtras } from './toolbar-extras.ts';

function init() {
  mountAppToolbar();
  const slideListEl = document.getElementById('slide-list')!;
  const viewportEl = document.getElementById('slide-viewport')!;
  const statusEl = document.getElementById('status');
  const usersEl = document.getElementById('users');
  const addSlideBtn = document.getElementById('add-slide-btn');
  const toolbarRight = document.querySelector('.toolbar-right');
  if (!slideListEl || !viewportEl) return;

  const documentId = getDocumentId();
  setupTitleSync(documentId, 'OpenDesk Presentation');
  const user = getUserIdentity();
  const ydoc = new Y.Doc();

  const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/collab`;
  const provider = new HocuspocusProvider({
    url: wsUrl,
    name: documentId,
    document: ydoc,
    onConnect() { if (statusEl) { statusEl.textContent = 'Connected'; statusEl.className = 'status connected'; } },
    onDisconnect() { if (statusEl) { statusEl.textContent = 'Disconnected'; statusEl.className = 'status disconnected'; } },
  });

  const yslides = ydoc.getArray<Y.Map<unknown>>('slides');
  let activeSlideIndex = 0;

  function ensureSlides() {
    if (yslides.length > 0) return;
    ydoc.transact(() => {
      const slide = new Y.Map<unknown>();
      slide.set('layout', 'blank');
      const elements = new Y.Array<Y.Map<unknown>>();
      const titleEl = new Y.Map<unknown>();
      const defaults: Record<string, unknown> = {
        id: crypto.randomUUID(), type: 'text', x: 10, y: 10, width: 80, height: 20,
        rotation: 0, content: '<p>Click to add title</p>',
        fontSize: 36, fontColor: '#000000', textAlign: 'center',
      };
      for (const [k, v] of Object.entries(defaults)) titleEl.set(k, v);
      elements.insert(0, [titleEl]);
      slide.set('elements', elements);
      yslides.insert(0, [slide]);
    });
  }

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
    const yElements = getActiveYElements();
    ydoc.transact(() => {
      for (let i = 0; i < yElements.length; i++) {
        const yel = yElements.get(i);
        if (yel.get('id') === elementId) {
          yel.set('content', content);
          break;
        }
      }
    });
  }

  function handleStyleUpdate(elementId: string, field: string, value: unknown) {
    applyFieldUpdate(ydoc, { yElements: getActiveYElements() }, elementId, field, value);
  }

  function handleCellUpdate(elementId: string, row: number, col: number, value: string) {
    updateTableCell(ydoc, getActiveYElements(), elementId, row, col, value);
  }

  function renderSlideList() {
    ensureSlides();
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
    const elements = getSlideElements(activeSlideIndex);
    for (const el of elements) {
      const result = renderElement(el, handleContentUpdate, handleStyleUpdate, handleCellUpdate);
      viewportEl.appendChild(result.dom);
    }
  }

  // Speaker notes panel — below viewport
  const canvasEl = document.getElementById('slide-canvas');
  const notesPanel = createSpeakerNotes({ ydoc, yslides });
  canvasEl?.appendChild(notesPanel.element);

  renderSlideList();
  renderActiveSlide();
  notesPanel.update(activeSlideIndex);

  // Interaction controller
  let interactionCtrl: InteractionController | null = null;
  function initInteraction() {
    if (interactionCtrl) interactionCtrl.destroy();
    interactionCtrl = createInteractionController({
      ydoc,
      viewport: viewportEl,
      getActiveSlideElements() {
        return { yElements: getActiveYElements(), elements: getSlideElements(activeSlideIndex) };
      },
      onStyleUpdate: handleStyleUpdate,
    });
  }
  initInteraction();
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
  // Layout picker + theme picker
  initLayoutAndTheme({
    ydoc, yslides, viewportEl, toolbarRight, addSlideBtn,
    onSlideAdded(index) {
      activeSlideIndex = index;
      renderSlideList();
      renderActiveSlide();
    },
  });

  // Present button
  const presentBtn = Object.assign(document.createElement('button'), { className: 'slide-present-btn', textContent: 'Present' });
  presentBtn.addEventListener('click', () => launchPresenterMode({ yslides, getSlideElements, totalSlides: () => yslides.length }, activeSlideIndex));
  if (toolbarRight) toolbarRight.appendChild(presentBtn);

  // Transition picker + slide sorter (drag-reorder, duplicate, delete)
  const extras = initToolbarExtras({
    ydoc, yslides, toolbarRight, slideListEl,
    getActiveIndex: () => activeSlideIndex,
    setActiveIndex(i) { activeSlideIndex = i; },
    onChanged() { renderSlideList(); renderActiveSlide(); notesPanel.update(activeSlideIndex); },
  });

  yslides.observeDeep(() => { renderSlideList(); renderActiveSlide(); notesPanel.update(activeSlideIndex); extras.updateTransitionPicker(); });

  // Presence
  provider.awareness?.setLocalStateField('user', user);
  const showUsers = () => {
    if (!usersEl || !provider.awareness) return;
    const n: string[] = [];
    provider.awareness.getStates().forEach((s: { user?: { name?: string } }) => { if (s.user?.name) n.push(s.user.name); });
    usersEl.textContent = n.join(', ') || '-';
  };
  provider.awareness?.on('change', showUsers);
  showUsers();
}

document.addEventListener('DOMContentLoaded', init);
