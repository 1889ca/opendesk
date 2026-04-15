/** Contract: contracts/app/rules.md */
/**
 * Builds the drawing canvas toolbar DOM: tool buttons, color pickers, width slider.
 */

import { TOOL_DEFS, type DrawingTool } from './drawing-tools.ts';

export interface ToolbarState {
  activeTool: DrawingTool;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
}

export interface DrawingToolbar {
  el: HTMLElement;
  state: ToolbarState;
  deleteSelected: () => void;
  clearAll: () => void;
  setDeleteHandler: (fn: () => void) => void;
  setClearHandler: (fn: () => void) => void;
}

/** Build and return the toolbar element and its current state reference. */
export function buildDrawingToolbar(): DrawingToolbar {
  const state: ToolbarState = {
    activeTool: 'rect',
    strokeColor: '#1a1a1a',
    fillColor: 'none',
    strokeWidth: 2,
  };

  let onDelete: () => void = () => {};
  let onClear: () => void = () => {};

  const toolbar = document.createElement('div');
  toolbar.className = 'drawing-toolbar';

  // ── Tool buttons ────────────────────────────────────────────────────
  const toolGroup = document.createElement('div');
  toolGroup.className = 'drawing-toolbar-group';
  const toolBtns: Map<DrawingTool, HTMLButtonElement> = new Map();

  function setTool(id: DrawingTool): void {
    state.activeTool = id;
    toolBtns.forEach((btn, key) => {
      btn.classList.toggle('is-active', key === id);
    });
  }

  for (const { id, label, title } of TOOL_DEFS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.title = title;
    btn.className = 'drawing-tool-btn';
    btn.addEventListener('click', () => setTool(id));
    toolBtns.set(id, btn);
    toolGroup.appendChild(btn);
  }
  setTool('rect');

  // ── Stroke color ────────────────────────────────────────────────────
  const strokeGroup = document.createElement('div');
  strokeGroup.className = 'drawing-toolbar-group';
  const strokeLabel = document.createElement('label');
  strokeLabel.className = 'drawing-color-label';
  strokeLabel.textContent = 'Stroke';
  const strokePicker = document.createElement('input');
  strokePicker.type = 'color';
  strokePicker.value = state.strokeColor;
  strokePicker.title = 'Stroke colour';
  strokePicker.addEventListener('input', () => { state.strokeColor = strokePicker.value; });
  strokeLabel.appendChild(strokePicker);
  strokeGroup.appendChild(strokeLabel);

  // ── Fill color ──────────────────────────────────────────────────────
  const fillGroup = document.createElement('div');
  fillGroup.className = 'drawing-toolbar-group';
  const fillLabel = document.createElement('label');
  fillLabel.className = 'drawing-color-label';
  fillLabel.textContent = 'Fill';
  const fillPicker = document.createElement('input');
  fillPicker.type = 'color';
  fillPicker.value = '#ffffff';
  fillPicker.title = 'Fill colour';
  fillPicker.disabled = true;
  const noFillCheck = document.createElement('input');
  noFillCheck.type = 'checkbox';
  noFillCheck.checked = true;
  noFillCheck.title = 'No fill';
  const noFillLabel = document.createElement('label');
  noFillLabel.className = 'drawing-nofill-label';
  noFillLabel.textContent = 'None';
  noFillLabel.prepend(noFillCheck);
  noFillCheck.addEventListener('change', () => {
    state.fillColor = noFillCheck.checked ? 'none' : fillPicker.value;
    fillPicker.disabled = noFillCheck.checked;
  });
  fillPicker.addEventListener('input', () => {
    if (!noFillCheck.checked) state.fillColor = fillPicker.value;
  });
  fillLabel.appendChild(fillPicker);
  fillGroup.appendChild(fillLabel);
  fillGroup.appendChild(noFillLabel);

  // ── Stroke width ────────────────────────────────────────────────────
  const widthGroup = document.createElement('div');
  widthGroup.className = 'drawing-toolbar-group';
  const widthLabel = document.createElement('label');
  widthLabel.className = 'drawing-width-label';
  widthLabel.textContent = 'Width';
  const widthInput = document.createElement('input');
  widthInput.type = 'range';
  widthInput.min = '1';
  widthInput.max = '10';
  widthInput.step = '0.5';
  widthInput.value = String(state.strokeWidth);
  widthInput.title = 'Stroke width';
  widthInput.addEventListener('input', () => { state.strokeWidth = Number(widthInput.value); });
  widthLabel.appendChild(widthInput);
  widthGroup.appendChild(widthLabel);

  // ── Delete / Clear ──────────────────────────────────────────────────
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.textContent = '✕';
  deleteBtn.title = 'Delete selected shape';
  deleteBtn.className = 'drawing-tool-btn drawing-delete-btn';
  deleteBtn.addEventListener('click', () => onDelete());

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Clear';
  clearBtn.title = 'Clear all shapes';
  clearBtn.className = 'drawing-tool-btn';
  clearBtn.addEventListener('click', () => onClear());

  toolbar.appendChild(toolGroup);
  toolbar.appendChild(strokeGroup);
  toolbar.appendChild(fillGroup);
  toolbar.appendChild(widthGroup);
  toolbar.appendChild(deleteBtn);
  toolbar.appendChild(clearBtn);

  return {
    el: toolbar,
    state,
    deleteSelected: () => onDelete(),
    clearAll: () => onClear(),
    setDeleteHandler: (fn) => { onDelete = fn; },
    setClearHandler: (fn) => { onClear = fn; },
  };
}
