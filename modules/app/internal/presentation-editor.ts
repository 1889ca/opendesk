/** Contract: contracts/app/rules.md */
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { getUserIdentity, getDocumentId } from './shared/identity.ts';
import { setupTitleSync } from './shared/title-sync.ts';
import { createInteractionController, type InteractionController } from './slides/element-interaction.ts';
import type { SlideElement } from './slides/types.ts';

function generateId(): string {
  return crypto.randomUUID();
}

function init() {
  const slideListEl = document.getElementById('slide-list')!;
  const viewportEl = document.getElementById('slide-viewport')!;
  const statusEl = document.getElementById('status');
  const usersEl = document.getElementById('users');
  const addSlideBtn = document.getElementById('add-slide-btn');
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

  // Yjs shared data: Y.Array of Y.Maps (slides)
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
        id: generateId(), type: 'text', x: 10, y: 10, width: 80, height: 20,
        content: 'Click to add title',
      };
      for (const [k, v] of Object.entries(defaults)) titleEl.set(k, v);
      elements.insert(0, [titleEl]);
      slide.set('elements', elements);
      yslides.insert(0, [slide]);
    });
  }

  function getSlideElements(slideIndex: number): SlideElement[] {
    const slide = yslides.get(slideIndex);
    if (!slide) return [];
    const elements = slide.get('elements') as Y.Array<Y.Map<unknown>> | undefined;
    if (!elements) return [];
    const result: SlideElement[] = [];
    for (let i = 0; i < elements.length; i++) {
      const el = elements.get(i);
      result.push({
        id: el.get('id') as string,
        type: (el.get('type') as 'text' | 'shape' | 'image') || 'text',
        x: (el.get('x') as number) || 0,
        y: (el.get('y') as number) || 0,
        width: (el.get('width') as number) || 50,
        height: (el.get('height') as number) || 20,
        rotation: (el.get('rotation') as number) || 0,
        content: (el.get('content') as string) || '',
      });
    }
    return result;
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
      const div = document.createElement('div');
      div.className = 'slide-element';
      div.dataset.type = el.type;
      div.dataset.elementId = el.id;
      div.style.left = el.x + '%';
      div.style.top = el.y + '%';
      div.style.width = el.width + '%';
      div.style.height = el.height + '%';
      if (el.rotation) {
        div.style.transform = `rotate(${el.rotation}deg)`;
      }
      div.contentEditable = 'true';
      div.textContent = el.content;

      div.addEventListener('blur', () => {
        const slide = yslides.get(activeSlideIndex);
        if (!slide) return;
        const elements = slide.get('elements') as Y.Array<Y.Map<unknown>> | undefined;
        if (!elements) return;
        for (let i = 0; i < elements.length; i++) {
          const yel = elements.get(i);
          if (yel.get('id') === el.id) {
            yel.set('content', div.textContent || '');
            break;
          }
        }
      });

      viewportEl.appendChild(div);
    }
  }

  renderSlideList();
  renderActiveSlide();

  // Initialize slide element interaction (drag, resize, rotate, select)
  let interactionCtrl: InteractionController | null = null;

  function initInteraction() {
    if (interactionCtrl) interactionCtrl.destroy();
    interactionCtrl = createInteractionController({
      ydoc,
      viewport: viewportEl,
      getActiveSlideElements() {
        const slide = yslides.get(activeSlideIndex);
        const yElements = (slide?.get('elements') as Y.Array<Y.Map<unknown>>) ||
          new Y.Array<Y.Map<unknown>>();
        return { yElements, elements: getSlideElements(activeSlideIndex) };
      },
    });
  }

  initInteraction();

  // Add slide button
  if (addSlideBtn) {
    addSlideBtn.addEventListener('click', () => {
      ydoc.transact(() => {
        const slide = new Y.Map<unknown>();
        slide.set('layout', 'blank');
        slide.set('elements', new Y.Array<Y.Map<unknown>>());
        yslides.insert(yslides.length, [slide]);
      });
      activeSlideIndex = yslides.length - 1;
      renderSlideList();
      renderActiveSlide();
    });
  }

  // Re-render on remote changes
  yslides.observeDeep(() => {
    renderSlideList();
    renderActiveSlide();
  });

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
