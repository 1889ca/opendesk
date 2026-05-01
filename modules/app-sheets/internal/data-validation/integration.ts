/** Contract: contracts/app-sheets/data-validation.md */
import * as Y from 'yjs';
import type { ValidationRule, CellRange } from './types.ts';
import {
  getValidationRules,
  getRuleForCell,
  addValidationRule,
  removeValidationRule,
  observeValidationRules,
} from './store.ts';
import { validate } from './engine.ts';
import { openValidationDialog } from './dialog.ts';
import {
  applyValidationIndicators,
  cleanupValidation,
} from './renderer.ts';
import type { SheetStore } from '../sheet-store.ts';

export interface ValidationIntegration {
  afterRender: () => void;
  cleanup: () => void;
  getButton: () => HTMLElement;
}

export function createValidationIntegration(opts: {
  ydoc: Y.Doc;
  gridEl: HTMLElement;
  store: SheetStore;
  getActiveSheetId: () => string;
  getSelectedRange: () => CellRange | null;
  getActiveCell: () => { row: number; col: number };
  doRender: () => void;
  rows: number;
  cols: number;
}): ValidationIntegration {
  const { ydoc, gridEl, store, getActiveSheetId, rows, cols } = opts;

  let unobserve: (() => void) | null = null;

  function observe() {
    unobserve?.();
    unobserve = observeValidationRules(ydoc, getActiveSheetId(), opts.doRender);
  }
  observe();

  function afterRender() {
    const sheetId = getActiveSheetId();
    const rules = getValidationRules(ydoc, sheetId);
    if (rules.length === 0) return;

    applyValidationIndicators({
      gridEl,
      ydoc,
      rules,
      rows,
      cols,
      getCellValue: (r, c) => store.getCellValue(sheetId, r, c),
      onCellValueChange: (r, c, value) => {
        const ysheet = store.getSheetData(sheetId);
        const yrow = ysheet.get(r);
        if (!yrow) return;
        ydoc.transact(() => {
          yrow.delete(c, 1);
          yrow.insert(c, [value]);
        });
        opts.doRender();
      },
    });
  }

  function openDialog() {
    const sheetId = getActiveSheetId();
    const range = opts.getSelectedRange() || cellToRange(opts.getActiveCell());
    const existing = getRuleForCell(ydoc, sheetId, range.startRow, range.startCol);

    openValidationDialog(range, existing, {
      onSave(rule) {
        if (existing) {
          removeValidationRule(ydoc, sheetId, existing.id);
        }
        addValidationRule(ydoc, sheetId, rule);
      },
      onRemove() {
        if (existing) {
          removeValidationRule(ydoc, sheetId, existing.id);
        }
      },
      onCancel() {},
    });
  }

  function getButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'format-btn';
    btn.textContent = 'Validate';
    btn.title = 'Data Validation';
    btn.addEventListener('click', openDialog);
    return btn;
  }

  return {
    afterRender,
    cleanup() {
      unobserve?.();
      cleanupValidation();
    },
    getButton,
  };
}

function cellToRange(cell: { row: number; col: number }): CellRange {
  return {
    startRow: cell.row,
    startCol: cell.col,
    endRow: cell.row,
    endCol: cell.col,
  };
}
