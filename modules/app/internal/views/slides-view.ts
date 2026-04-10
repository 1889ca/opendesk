/** Contract: contracts/app/shell.md */

/**
 * Slides view: SPA adapter that builds the presentation editor DOM structure
 * and initialises the collaborative slide editor for a given document ID.
 */

import { initSlides, type SlidesCleanup } from '../../../app-slides/internal/presentation-editor.ts';
import { mountAppToolbar } from '../shared/app-toolbar.ts';

let cleanup: SlidesCleanup | null = null;

export function mount(container: HTMLElement, params: Record<string, string>): void {
  const documentId = params.id;
  if (!documentId) return;

  // Build toolbar
  const toolbarEl = document.createElement('header');
  toolbarEl.id = 'app-toolbar';
  toolbarEl.className = 'toolbar';
  container.appendChild(toolbarEl);

  const refs = mountAppToolbar();

  // Build slide editor layout
  const layout = document.createElement('div');
  layout.className = 'slide-editor-layout';

  const slideListEl = document.createElement('div');
  slideListEl.id = 'slide-list';
  slideListEl.className = 'slide-list';

  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'slide-canvas-wrapper';

  const slideCanvasEl = document.createElement('div');
  slideCanvasEl.id = 'slide-canvas';
  slideCanvasEl.className = 'slide-canvas';

  const viewportEl = document.createElement('div');
  viewportEl.id = 'slide-viewport';
  viewportEl.className = 'slide-viewport';

  slideCanvasEl.appendChild(viewportEl);
  canvasWrapper.appendChild(slideCanvasEl);
  layout.appendChild(slideListEl);
  layout.appendChild(canvasWrapper);
  container.appendChild(layout);

  cleanup = initSlides(documentId, {
    slideListEl,
    viewportEl,
    canvasEl: slideCanvasEl,
    statusEl: refs.statusEl,
    usersEl: refs.usersEl,
    addSlideBtn: null,
    toolbarRight: refs.toolbarRightEl,
  });
}

export function unmount(): void {
  cleanup?.destroy();
  cleanup = null;
}
