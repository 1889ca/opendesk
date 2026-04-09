/** Contract: contracts/app-slides/rules.md */

import * as Y from 'yjs';
import { createLayoutPicker } from './layout-picker.ts';
import { createLayoutElements, type LayoutType } from './layouts.ts';
import { createThemePicker } from './theme-picker.ts';
import { applyTheme, getThemeById, themeToRecord, recordToTheme, type SlideTheme } from './themes.ts';

interface LayoutThemeContext {
  ydoc: Y.Doc;
  yslides: Y.Array<Y.Map<unknown>>;
  viewportEl: HTMLElement;
  toolbarRight: Element | null;
  addSlideBtn: HTMLElement | null;
  onSlideAdded: (index: number) => void;
}

/** Wire up layout picker, theme picker, and theme sync with Yjs. */
export function initLayoutAndTheme(ctx: LayoutThemeContext): { destroy: () => void } {
  const { ydoc, yslides, viewportEl, toolbarRight, addSlideBtn, onSlideAdded } = ctx;

  // Layout picker — replaces the "Add Slide" button
  function addSlideWithLayout(layout: LayoutType) {
    ydoc.transact(() => {
      const slide = new Y.Map<unknown>();
      slide.set('layout', layout);
      const elements = new Y.Array<Y.Map<unknown>>();
      for (const elDef of createLayoutElements(layout)) {
        const yel = new Y.Map<unknown>();
        yel.set('id', crypto.randomUUID());
        for (const [k, v] of Object.entries(elDef)) yel.set(k, v);
        elements.push([yel]);
      }
      slide.set('elements', elements);
      yslides.insert(yslides.length, [slide]);
    });
    onSlideAdded(yslides.length - 1);
  }

  const layoutPicker = createLayoutPicker(addSlideWithLayout);
  if (addSlideBtn) addSlideBtn.replaceWith(layoutPicker.element);

  // Theme system — stored in Yjs Y.Map, applied via CSS custom properties
  const ytheme = ydoc.getMap<string>('theme');

  function getCurrentTheme(): SlideTheme {
    const id = ytheme.get('id');
    return id ? getThemeById(String(id)) : getThemeById('default');
  }

  const themePicker = createThemePicker(getCurrentTheme().id, (theme) => {
    ydoc.transact(() => {
      for (const [k, v] of Object.entries(themeToRecord(theme))) ytheme.set(k, v);
    });
  });

  if (toolbarRight) toolbarRight.appendChild(themePicker.element);

  ytheme.observe(() => {
    const theme = ytheme.size > 0
      ? recordToTheme(Object.fromEntries(ytheme.entries()))
      : getThemeById('default');
    applyTheme(viewportEl, theme);
    themePicker.setActive(theme.id);
  });

  applyTheme(viewportEl, getCurrentTheme());

  return {
    destroy() {
      layoutPicker.destroy();
      themePicker.destroy();
    },
  };
}
