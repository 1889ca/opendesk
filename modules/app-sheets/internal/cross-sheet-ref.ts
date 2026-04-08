/** Contract: contracts/app-sheets/rules.md */

export interface CrossSheetRef {
  sheetName: string;
  cellRef: string;
}

/**
 * Parse a cross-sheet reference like "Sheet2!A1" or "'My Sheet'!B3:C5".
 * Returns null if the reference is not a cross-sheet reference.
 */
export function parseCrossSheetRef(ref: string): CrossSheetRef | null {
  const bangIdx = ref.indexOf('!');
  if (bangIdx === -1) return null;

  let sheetName = ref.substring(0, bangIdx);
  const cellRef = ref.substring(bangIdx + 1);

  if (!cellRef) return null;

  // Handle quoted sheet names: 'Sheet Name'!A1
  if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
    sheetName = sheetName.slice(1, -1).replace(/''/g, "'");
  }

  if (!sheetName) return null;

  return { sheetName, cellRef };
}

/** Quote a sheet name for use in formulas if it contains spaces or special chars. */
export function quoteSheetName(name: string): string {
  if (/^[A-Za-z_]\w*$/.test(name)) return name;
  return "'" + name.replace(/'/g, "''") + "'";
}

/**
 * Parse a cell reference string (e.g., "A1", "$B$3") into row/col indices.
 * Returns null if invalid.
 */
export function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^\$?([A-Z]+)\$?(\d+)$/i);
  if (!match) return null;

  const colStr = match[1].toUpperCase();
  const rowNum = parseInt(match[2], 10);
  if (rowNum < 1) return null;

  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  col -= 1; // zero-indexed

  return { row: rowNum - 1, col };
}

/**
 * Parse a range reference like "A1:C3" into start/end coordinates.
 * Returns null if invalid.
 */
export function parseRangeRef(
  ref: string,
): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
  const parts = ref.split(':');
  if (parts.length !== 2) return null;

  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return null;

  return {
    startRow: Math.min(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endRow: Math.max(start.row, end.row),
    endCol: Math.max(start.col, end.col),
  };
}
