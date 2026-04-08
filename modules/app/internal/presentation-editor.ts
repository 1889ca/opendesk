/** Contract: contracts/app/rules.md */
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { getUserIdentity, getDocumentId } from './shared/identity.ts';
import { setupTitleSync } from './shared/title-sync.ts';
import { buildImportExportButtons } from './slides/import-export.ts';
import { buildKbToolbar } from './slides/kb-toolbar.ts';
import { checkKbSourceUpdates } from './slides/kb-elements.ts';
import { renderSlideList, renderActiveSlide } from './slides/slide-renderer.ts';

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
    onConnect() {
      if (statusEl) {
        statusEl.textContent = 'Connected';
        statusEl.className = 'status connected';
      }
    },
    onDisconnect() {
      if (statusEl) {
        statusEl.textContent = 'Disconnected';
        statusEl.className = 'status disconnected';
      }
    },
  });

  const yslides = ydoc.getArray<Y.Map<unknown>>('slides');
  let activeSlideIndex = 0;

  function ensureSlides() {
    if (yslides.length === 0) {
      ydoc.transact(() => {
        const slide = new Y.Map<unknown>();
        slide.set('layout', 'blank');
        const elements = new Y.Array<Y.Map<unknown>>();
        const titleEl = new Y.Map<unknown>();
        titleEl.set('id', crypto.randomUUID());
        titleEl.set('type', 'text');
        titleEl.set('x', 10);
        titleEl.set('y', 10);
        titleEl.set('width', 80);
        titleEl.set('height', 20);
        titleEl.set('content', 'Click to add title');
        elements.insert(0, [titleEl]);
        slide.set('elements', elements);
        yslides.insert(0, [slide]);
      });
    }
  }

  function refresh() {
    ensureSlides();
    renderSlideList(slideListEl, yslides, activeSlideIndex, (i) => {
      activeSlideIndex = i;
      refresh();
    });
    renderActiveSlide(viewportEl, yslides, activeSlideIndex);
  }

  refresh();

  // Import/Export and KB toolbar buttons
  const toolbarRight = document.querySelector('.toolbar-right');
  if (toolbarRight) {
    const ioButtons = buildImportExportButtons(ydoc, yslides, () => {
      activeSlideIndex = 0;
      refresh();
    });
    toolbarRight.insertBefore(ioButtons, toolbarRight.firstChild);

    const kbToolbar = buildKbToolbar({
      ydoc,
      yslides,
      getActiveSlideIndex: () => activeSlideIndex,
      onInsert: () => {
        renderActiveSlide(viewportEl, yslides, activeSlideIndex);
        checkKbSourceUpdates(viewportEl);
      },
    });
    toolbarRight.insertBefore(kbToolbar, ioButtons.nextSibling);
  }

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
      refresh();
    });
  }

  // Re-render on remote changes
  yslides.observeDeep(() => refresh());

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
