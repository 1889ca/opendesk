/** Contract: contracts/workflow/rules.md */

const LAYOUT_HTML = `
<div class="wf-editor">
  <aside class="wf-sidebar-left">
    <div class="wf-list-container"></div>
    <div class="wf-palette-container"></div>
  </aside>
  <main class="wf-main">
    <div class="wf-toolbar">
      <input class="wf-name-input" placeholder="Workflow name" />
      <input class="wf-docid-input" placeholder="Document ID" />
      <button class="wf-save-btn">Save</button>
      <button class="wf-toggle-btn">Toggle Active</button>
      <button class="wf-exec-btn">Execution Log</button>
    </div>
    <div class="wf-canvas-container"></div>
    <div class="wf-exec-container"></div>
  </main>
  <aside class="wf-sidebar-right">
    <div class="wf-props-container"></div>
  </aside>
</div>
`;

export type EditorElements = {
  listEl: HTMLElement;
  paletteEl: HTMLElement;
  canvasEl: HTMLElement;
  propsEl: HTMLElement;
  execEl: HTMLElement;
  nameInput: HTMLInputElement;
  docIdInput: HTMLInputElement;
  saveBtn: HTMLButtonElement;
  toggleBtn: HTMLButtonElement;
  execBtn: HTMLButtonElement;
};

export function createEditorLayout(root: HTMLElement): EditorElements {
  root.innerHTML = LAYOUT_HTML;
  return {
    listEl: root.querySelector('.wf-list-container') as HTMLElement,
    paletteEl: root.querySelector('.wf-palette-container') as HTMLElement,
    canvasEl: root.querySelector('.wf-canvas-container') as HTMLElement,
    propsEl: root.querySelector('.wf-props-container') as HTMLElement,
    execEl: root.querySelector('.wf-exec-container') as HTMLElement,
    nameInput: root.querySelector('.wf-name-input') as HTMLInputElement,
    docIdInput: root.querySelector('.wf-docid-input') as HTMLInputElement,
    saveBtn: root.querySelector('.wf-save-btn') as HTMLButtonElement,
    toggleBtn: root.querySelector('.wf-toggle-btn') as HTMLButtonElement,
    execBtn: root.querySelector('.wf-exec-btn') as HTMLButtonElement,
  };
}
