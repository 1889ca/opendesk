/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';

export interface SheetMeta {
  id: string;
  name: string;
}

const DEFAULT_COLS = 26;
const DEFAULT_ROWS = 50;

/** Manages the multi-sheet Yjs data model for spreadsheets. */
export class SheetStore {
  private ydoc: Y.Doc;
  private registry: Y.Map<string>;
  private orderArray: Y.Array<string>;
  private nextIdCounter = 0;

  constructor(ydoc: Y.Doc) {
    this.ydoc = ydoc;
    this.registry = ydoc.getMap<string>('sheet-registry');
    this.orderArray = ydoc.getArray<string>('sheet-order');
    this.migrate();
  }

  /** Migrate legacy single-sheet documents to multi-sheet model. */
  private migrate(): void {
    if (this.orderArray.length > 0) {
      this.syncNextId();
      return;
    }
    const legacySheet = this.ydoc.getArray<Y.Array<string>>('sheet-0');
    if (legacySheet.length > 0) {
      this.ydoc.transact(() => {
        this.registry.set('sheet-0', 'Sheet 1');
        this.orderArray.insert(0, ['sheet-0']);
      });
      this.nextIdCounter = 1;
      return;
    }
    this.ydoc.transact(() => {
      this.createEmptyGrid('sheet-0');
      this.registry.set('sheet-0', 'Sheet 1');
      this.orderArray.insert(0, ['sheet-0']);
    });
    this.nextIdCounter = 1;
  }

  private syncNextId(): void {
    let max = -1;
    for (const id of this.orderArray.toArray()) {
      const num = parseInt(id.replace('sheet-', ''), 10);
      if (!isNaN(num) && num > max) max = num;
    }
    this.nextIdCounter = max + 1;
  }

  private createEmptyGrid(sheetId: string): void {
    const ysheet = this.ydoc.getArray<Y.Array<string>>(sheetId);
    if (ysheet.length > 0) return;
    for (let r = 0; r < DEFAULT_ROWS; r++) {
      const row = new Y.Array<string>();
      const cells: string[] = new Array(DEFAULT_COLS).fill('');
      row.insert(0, cells);
      ysheet.insert(ysheet.length, [row]);
    }
  }

  /** Get ordered list of sheets. */
  getSheets(): SheetMeta[] {
    return this.orderArray.toArray().map((id) => ({
      id,
      name: this.registry.get(id) || id,
    }));
  }

  /** Get Yjs array for a sheet's grid data. */
  getSheetData(sheetId: string): Y.Array<Y.Array<string>> {
    return this.ydoc.getArray<Y.Array<string>>(sheetId);
  }

  /** Add a new sheet. Returns the new sheet's metadata. */
  addSheet(name?: string): SheetMeta {
    const id = `sheet-${this.nextIdCounter++}`;
    const sheetName = name || `Sheet ${this.orderArray.length + 1}`;
    this.ydoc.transact(() => {
      this.createEmptyGrid(id);
      this.registry.set(id, sheetName);
      this.orderArray.insert(this.orderArray.length, [id]);
    });
    return { id, name: sheetName };
  }

  /** Rename a sheet. */
  renameSheet(sheetId: string, newName: string): void {
    if (!this.registry.has(sheetId)) return;
    this.ydoc.transact(() => {
      this.registry.set(sheetId, newName);
    });
  }

  /** Delete a sheet. Prevents deleting the last sheet. */
  deleteSheet(sheetId: string): boolean {
    if (this.orderArray.length <= 1) return false;
    const idx = this.orderArray.toArray().indexOf(sheetId);
    if (idx === -1) return false;
    this.ydoc.transact(() => {
      this.orderArray.delete(idx, 1);
      this.registry.delete(sheetId);
    });
    return true;
  }

  /** Duplicate a sheet. Returns new sheet metadata. */
  duplicateSheet(sheetId: string): SheetMeta | null {
    const sourceName = this.registry.get(sheetId);
    if (!sourceName) return null;
    const newId = `sheet-${this.nextIdCounter++}`;
    const newName = `${sourceName} (Copy)`;
    const sourceData = this.getSheetData(sheetId);
    this.ydoc.transact(() => {
      const newSheet = this.ydoc.getArray<Y.Array<string>>(newId);
      for (let r = 0; r < sourceData.length; r++) {
        const srcRow = sourceData.get(r);
        const newRow = new Y.Array<string>();
        newRow.insert(0, srcRow.toArray());
        newSheet.insert(newSheet.length, [newRow]);
      }
      this.registry.set(newId, newName);
      const idx = this.orderArray.toArray().indexOf(sheetId);
      this.orderArray.insert(idx + 1, [newId]);
    });
    return { id: newId, name: newName };
  }

  /** Find sheet ID by display name. */
  findSheetByName(name: string): string | null {
    for (const [id, sheetName] of this.registry.entries()) {
      if (sheetName === name) return id;
    }
    return null;
  }

  /** Get the freeze map for the given sheet (keys: 'rows', 'cols'). */
  private getFreezeMap(sheetId: string): Y.Map<number> {
    return this.ydoc.getMap<number>(`freeze-${sheetId}`);
  }

  /** Get the number of frozen rows for a sheet (0 = none). */
  getFrozenRows(sheetId: string): number {
    return this.getFreezeMap(sheetId).get('rows') ?? 0;
  }

  /** Get the number of frozen columns for a sheet (0 = none). */
  getFrozenCols(sheetId: string): number {
    return this.getFreezeMap(sheetId).get('cols') ?? 0;
  }

  /** Set frozen rows for a sheet. 0 unfreezes. */
  setFrozenRows(sheetId: string, rows: number): void {
    this.ydoc.transact(() => {
      this.getFreezeMap(sheetId).set('rows', rows);
    });
  }

  /** Set frozen cols for a sheet. 0 unfreezes. */
  setFrozenCols(sheetId: string, cols: number): void {
    this.ydoc.transact(() => {
      this.getFreezeMap(sheetId).set('cols', cols);
    });
  }

  /** Get cell value from any sheet (for cross-sheet references). */
  getCellValue(sheetId: string, row: number, col: number): string {
    const data = this.getSheetData(sheetId);
    if (row >= data.length) return '';
    const yrow = data.get(row);
    if (col >= yrow.length) return '';
    return yrow.get(col) || '';
  }

  /** Observe changes to the sheet registry/order. */
  observe(callback: () => void): void {
    this.registry.observe(callback);
    this.orderArray.observe(callback);
  }
}
