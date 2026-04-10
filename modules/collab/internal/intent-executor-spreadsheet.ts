/** Contract: contracts/collab/rules.md */
import * as Y from 'yjs';

export function applySpreadsheetIntent(ydoc: Y.Doc, action: Record<string, unknown>): number {
  const sheetsMap = ydoc.getMap<Y.Array<Y.Map<unknown>>>('spreadsheet');

  const type = action.type as string;
  const sheetIndex = action.sheet as number | undefined;

  let sheets = sheetsMap.get('sheets') as Y.Array<Y.Map<unknown>> | undefined;
  if (!sheets) {
    sheets = new Y.Array();
    sheetsMap.set('sheets', sheets);
  }

  if (type === 'insert_sheet') {
    const newSheet = new Y.Map<unknown>();
    newSheet.set('name', action.name as string);
    newSheet.set('rows', new Y.Array());
    newSheet.set('columns', new Y.Array());
    const after = action.afterSheet as number | null;
    const insertIdx = after === null ? 0 : after + 1;
    sheets.insert(insertIdx, [newSheet]);
    return 1;
  }

  if (type === 'delete_sheet' && sheetIndex !== undefined) {
    sheets.delete(sheetIndex, 1);
    return 1;
  }

  if (type === 'rename_sheet' && sheetIndex !== undefined) {
    const sheet = sheets.get(sheetIndex) as Y.Map<unknown> | undefined;
    if (!sheet) throw new Error(`sheet_not_found:${sheetIndex}`);
    sheet.set('name', action.name as string);
    return 1;
  }

  if (type === 'update_cell' && sheetIndex !== undefined) {
    const sheet = sheets.get(sheetIndex) as Y.Map<unknown> | undefined;
    if (!sheet) throw new Error(`sheet_not_found:${sheetIndex}`);
    const rows = sheet.get('rows') as Y.Array<Y.Array<Y.Map<unknown>>>;
    const rowIndex = action.row as number;
    const colIndex = action.col as number;
    const row = rows.get(rowIndex) as Y.Array<Y.Map<unknown>> | undefined;
    if (!row) throw new Error(`row_not_found:${rowIndex}`);
    const cell = row.get(colIndex) as Y.Map<unknown> | undefined;
    if (!cell) throw new Error(`cell_not_found:${colIndex}`);
    cell.set('value', action.value);
    if (action.formula !== undefined) cell.set('formula', action.formula);
    return 1;
  }

  if (type === 'insert_row' && sheetIndex !== undefined) {
    const sheet = sheets.get(sheetIndex) as Y.Map<unknown> | undefined;
    if (!sheet) throw new Error(`sheet_not_found:${sheetIndex}`);
    const rows = sheet.get('rows') as Y.Array<Y.Array<Y.Map<unknown>>>;
    const newRow = new Y.Array<Y.Map<unknown>>();
    const after = action.afterRow as number | null;
    const insertIdx = after === null ? 0 : after + 1;
    rows.insert(insertIdx, [newRow]);
    return 1;
  }

  if (type === 'delete_row' && sheetIndex !== undefined) {
    const sheet = sheets.get(sheetIndex) as Y.Map<unknown> | undefined;
    if (!sheet) throw new Error(`sheet_not_found:${sheetIndex}`);
    const rows = sheet.get('rows') as Y.Array<Y.Array<Y.Map<unknown>>>;
    rows.delete(action.row as number, 1);
    return 1;
  }

  if (type === 'insert_column' && sheetIndex !== undefined) {
    const sheet = sheets.get(sheetIndex) as Y.Map<unknown> | undefined;
    if (!sheet) throw new Error(`sheet_not_found:${sheetIndex}`);
    const columns = sheet.get('columns') as Y.Array<Y.Map<unknown>>;
    const newCol = new Y.Map<unknown>();
    const after = action.afterCol as number | null;
    const insertIdx = after === null ? 0 : after + 1;
    columns.insert(insertIdx, [newCol]);
    return 1;
  }

  if (type === 'delete_column' && sheetIndex !== undefined) {
    const sheet = sheets.get(sheetIndex) as Y.Map<unknown> | undefined;
    if (!sheet) throw new Error(`sheet_not_found:${sheetIndex}`);
    const columns = sheet.get('columns') as Y.Array<Y.Map<unknown>>;
    columns.delete(action.col as number, 1);
    return 1;
  }

  return 0;
}
