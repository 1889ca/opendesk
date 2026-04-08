/** Contract: contracts/app/rules.md */
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { getUserIdentity, getDocumentId } from './shared/identity.ts';
import { setupTitleSync } from './shared/title-sync.ts';
import { createInteractionController, type InteractionController } from './slides/element-interaction.ts';
import type { SlideElement } from './slides/types.ts';
import { renderElement } from './slides/element-renderer.ts';
import { createInsertToolbar, type InsertAction } from './slides/insert-toolbar.ts';
import { insertElement, updateTableCell } from './slides/yjs-element-insert.ts';
import { applyFieldUpdate } from './slides/yjs-mutations.ts';
import { createTextElement, createImageElement, createShapeElement, createTableElement } from './slides/element-factory.ts';
import { openSlideImagePicker, setupSlideDragDrop } from './slides/slide-image-upload.ts';
import { parseSlideElements } from './slides/parse-elements.ts';
import { initLayoutAndTheme } from './slides/layout-theme-init.ts';

function init() {
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

  renderSlideList();
  renderActiveSlide();

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

  // Insert toolbar
  function handleInsertAction(action: InsertAction) {
    const yElements = getActiveYElements();
    if (action.type === 'text') {
      insertElement(ydoc, yElements, createTextElement());
    } else if (action.type === 'image') {
      openSlideImagePicker(documentId, (url) => {
        insertElement(ydoc, yElements, createImageElement(url));
      });
    } else if (action.type === 'shape') {
      insertElement(ydoc, yElements, createShapeElement(action.shapeType));
    } else if (action.type === 'table') {
      insertElement(ydoc, yElements, createTableElement(action.rows, action.cols));
    }
  }

  const insertToolbar = createInsertToolbar(handleInsertAction);
  if (toolbarRight) toolbarRight.insertBefore(insertToolbar, toolbarRight.firstChild);

  setupSlideDragDrop(viewportEl, documentId, (url) => {
    insertElement(ydoc, getActiveYElements(), createImageElement(url));
  });

  // Layout picker + theme picker
  initLayoutAndTheme({
    ydoc, yslides, viewportEl, toolbarRight, addSlideBtn,
    onSlideAdded(index) {
      activeSlideIndex = index;
      renderSlideList();
      renderActiveSlide();
    },
  });

  yslides.observeDeep(() => { renderSlideList(); renderActiveSlide(); });

  // Presence
  function updateUsers() {
    if (!usersEl || !provider.awareness) return;
    const states = provider.awareness.getStates();
    const names: string[] = [];
    states.forEach((state: { user?: { name?: string } }) => {
      if (state.user?.name) names.push(state.user.name);
    });
    usersEl.textContent = names.join(', ') || '-';
  }
  provider.awareness?.setLocalStateField('user', user);
  provider.awareness?.on('change', updateUsers);
  updateUsers();

  Object.assign(window, { ydoc, provider, yslides });
}

document.addEventListener('DOMContentLoaded', init);
