/** Contract: contracts/app-sheets/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { insertRow, deleteRow, insertColumn, deleteColumn } from './col-row-ops.ts';
import { getFormatMap } from './format/store.ts';

const SHEET_ID = 'test-sheet';

/** Build a ydoc with a sheet containing `rows` × `cols` cells filled with their "r,c" address. */
function makeSheet(rows: number, cols: number): Y.Doc {
  const ydoc = new Y.Doc();
  const ysheet = ydoc.getArray<Y.Array<string>>(SHEET_ID);
  ydoc.transact(() => {
    for (let r = 0; r < rows; r++) {
      const yrow = new Y.Array<string>();
      yrow.insert(0, Array.from({ length: cols }, (_, c) => `${r},${c}`));
      ysheet.insert(ysheet.length, [yrow]);
    }
  });
  return ydoc;
}

/** Read cell value from a ydoc sheet. */
function cell(ydoc: Y.Doc, row: number, col: number): string {
  const ysheet = ydoc.getArray<Y.Array<string>>(SHEET_ID);
  return ysheet.get(row).get(col);
}

/** Get the number of rows in the sheet. */
function rowCount(ydoc: Y.Doc): number {
  return ydoc.getArray<Y.Array<string>>(SHEET_ID).length;
}

/** Get the number of columns in row 0. */
function colCount(ydoc: Y.Doc): number {
  const ysheet = ydoc.getArray<Y.Array<string>>(SHEET_ID);
  if (ysheet.length === 0) return 0;
  return ysheet.get(0).length;
}

// -------------------------------------------------------------------
describe('insertRow', () => {
  it('increases row count by 1', () => {
    const ydoc = makeSheet(3, 4);
    insertRow(ydoc, SHEET_ID, 1);
    expect(rowCount(ydoc)).toBe(4);
  });

  it('inserts a blank row at the given index', () => {
    const ydoc = makeSheet(3, 3);
    insertRow(ydoc, SHEET_ID, 1);
    // New row at index 1 should be all empty strings
    for (let c = 0; c < 3; c++) {
      expect(cell(ydoc, 1, c)).toBe('');
    }
  });

  it('preserves rows above the insertion point', () => {
    const ydoc = makeSheet(3, 3);
    insertRow(ydoc, SHEET_ID, 1);
    expect(cell(ydoc, 0, 0)).toBe('0,0');
  });

  it('shifts rows below the insertion point down', () => {
    const ydoc = makeSheet(3, 3);
    // Row 1 originally has value "1,0"
    insertRow(ydoc, SHEET_ID, 1);
    // Old row 1 should now be at row 2
    expect(cell(ydoc, 2, 0)).toBe('1,0');
  });

  it('inserts at the beginning (index 0)', () => {
    const ydoc = makeSheet(2, 2);
    insertRow(ydoc, SHEET_ID, 0);
    expect(rowCount(ydoc)).toBe(3);
    expect(cell(ydoc, 0, 0)).toBe('');
    expect(cell(ydoc, 1, 0)).toBe('0,0');
  });

  it('inserts at the end', () => {
    const ydoc = makeSheet(2, 2);
    insertRow(ydoc, SHEET_ID, 2);
    expect(rowCount(ydoc)).toBe(3);
    expect(cell(ydoc, 2, 0)).toBe('');
  });

  it('shifts format keys down when a row is inserted', () => {
    const ydoc = makeSheet(3, 3);
    const fmtMap = getFormatMap(ydoc);
    ydoc.transact(() => fmtMap.set('2:1', '{"bold":true}'));
    insertRow(ydoc, SHEET_ID, 1);
    expect(fmtMap.has('3:1')).toBe(true);
    expect(fmtMap.has('2:1')).toBe(false);
  });
});

// -------------------------------------------------------------------
describe('deleteRow', () => {
  it('decreases row count by 1', () => {
    const ydoc = makeSheet(4, 3);
    deleteRow(ydoc, SHEET_ID, 1);
    expect(rowCount(ydoc)).toBe(3);
  });

  it('removes the correct row', () => {
    const ydoc = makeSheet(3, 3);
    // Row 1 has "1,0", row 2 has "2,0"
    deleteRow(ydoc, SHEET_ID, 1);
    // What was row 2 should now be row 1
    expect(cell(ydoc, 1, 0)).toBe('2,0');
  });

  it('preserves rows above the deleted row', () => {
    const ydoc = makeSheet(3, 3);
    deleteRow(ydoc, SHEET_ID, 1);
    expect(cell(ydoc, 0, 0)).toBe('0,0');
  });

  it('does nothing when trying to delete the last remaining row', () => {
    const ydoc = makeSheet(1, 3);
    deleteRow(ydoc, SHEET_ID, 0);
    expect(rowCount(ydoc)).toBe(1);
  });

  it('does nothing when row index is out of bounds', () => {
    const ydoc = makeSheet(2, 3);
    deleteRow(ydoc, SHEET_ID, 99);
    expect(rowCount(ydoc)).toBe(2);
  });

  it('removes format keys for the deleted row and shifts others up', () => {
    const ydoc = makeSheet(3, 3);
    const fmtMap = getFormatMap(ydoc);
    ydoc.transact(() => {
      fmtMap.set('1:0', '{"bold":true}');
      fmtMap.set('2:0', '{"italic":true}');
    });
    deleteRow(ydoc, SHEET_ID, 1);
    // Old row 2 shifts up to row 1 — so '1:0' now holds the italic format
    expect(fmtMap.get('1:0')).toBe('{"italic":true}');
    // Original row 2 key should be cleared (replaced or gone)
    expect(fmtMap.has('2:0')).toBe(false);
  });
});

// -------------------------------------------------------------------
describe('insertColumn', () => {
  it('increases column count by 1 in every row', () => {
    const ydoc = makeSheet(3, 4);
    insertColumn(ydoc, SHEET_ID, 1);
    expect(colCount(ydoc)).toBe(5);
  });

  it('inserts blank cell at the given column index', () => {
    const ydoc = makeSheet(2, 3);
    insertColumn(ydoc, SHEET_ID, 1);
    expect(cell(ydoc, 0, 1)).toBe('');
    expect(cell(ydoc, 1, 1)).toBe('');
  });

  it('shifts cells right of insertion point', () => {
    const ydoc = makeSheet(2, 3);
    // cell(0, 1) was "0,1" — should now be at (0, 2)
    insertColumn(ydoc, SHEET_ID, 1);
    expect(cell(ydoc, 0, 2)).toBe('0,1');
  });

  it('preserves cells left of insertion point', () => {
    const ydoc = makeSheet(2, 3);
    insertColumn(ydoc, SHEET_ID, 1);
    expect(cell(ydoc, 0, 0)).toBe('0,0');
  });

  it('shifts format keys right when a column is inserted', () => {
    const ydoc = makeSheet(2, 3);
    const fmtMap = getFormatMap(ydoc);
    ydoc.transact(() => fmtMap.set('0:2', '{"bold":true}'));
    insertColumn(ydoc, SHEET_ID, 1);
    expect(fmtMap.has('0:3')).toBe(true);
    expect(fmtMap.has('0:2')).toBe(false);
  });
});

// -------------------------------------------------------------------
describe('deleteColumn', () => {
  it('decreases column count by 1 in every row', () => {
    const ydoc = makeSheet(3, 4);
    deleteColumn(ydoc, SHEET_ID, 1);
    expect(colCount(ydoc)).toBe(3);
  });

  it('removes the correct column', () => {
    const ydoc = makeSheet(2, 4);
    // After deleting col 1, what was col 2 ("0,2") moves to col 1
    deleteColumn(ydoc, SHEET_ID, 1);
    expect(cell(ydoc, 0, 1)).toBe('0,2');
  });

  it('preserves columns left of the deleted column', () => {
    const ydoc = makeSheet(2, 4);
    deleteColumn(ydoc, SHEET_ID, 2);
    expect(cell(ydoc, 0, 0)).toBe('0,0');
    expect(cell(ydoc, 0, 1)).toBe('0,1');
  });

  it('does nothing if the sheet has only one column', () => {
    const ydoc = makeSheet(2, 1);
    deleteColumn(ydoc, SHEET_ID, 0);
    expect(colCount(ydoc)).toBe(1);
  });

  it('does nothing on an empty sheet', () => {
    const ydoc = new Y.Doc();
    // No rows in the sheet — should not throw
    expect(() => deleteColumn(ydoc, SHEET_ID, 0)).not.toThrow();
  });

  it('removes format keys for the deleted column and shifts others left', () => {
    const ydoc = makeSheet(2, 4);
    const fmtMap = getFormatMap(ydoc);
    ydoc.transact(() => {
      fmtMap.set('0:1', '{"bold":true}');
      fmtMap.set('0:2', '{"italic":true}');
    });
    deleteColumn(ydoc, SHEET_ID, 1);
    // Old col 2 shifts left to col 1 — so '0:1' now holds the italic format
    expect(fmtMap.get('0:1')).toBe('{"italic":true}');
    // Original col 2 key should be cleared
    expect(fmtMap.has('0:2')).toBe(false);
  });
});
