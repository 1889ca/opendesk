/** Contract: contracts/convert/rules.md */

/**
 * CSV parser and exporter for spreadsheet data.
 * Handles RFC 4180-compliant CSV parsing and generation.
 * No Collabora dependency — runs entirely in-process.
 */

export type CellGrid = string[][];

/**
 * Parse a CSV string into a 2D array of cell values.
 * Handles quoted fields, embedded commas, and newlines within quotes.
 */
export function parseCsv(input: string): CellGrid {
  const rows: CellGrid = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < input.length && input[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        cell += ch;
        i++;
      }
    } else if (ch === '"') {
      inQuotes = true;
      i++;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
      i++;
    } else if (ch === '\n' || (ch === '\r' && input[i + 1] === '\n')) {
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
      i += ch === '\r' ? 2 : 1;
    } else if (ch === '\r') {
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
      i++;
    } else {
      cell += ch;
      i++;
    }
  }

  // Push last cell/row if input doesn't end with newline
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

/**
 * Convert a 2D cell grid to CSV string.
 * Quotes fields that contain commas, quotes, or newlines.
 */
export function gridToCsv(grid: CellGrid): string {
  return grid.map((row) =>
    row.map((cell) => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');
}

/**
 * Normalize a parsed grid so all rows have the same column count.
 * Pads short rows with empty strings.
 */
export function normalizeGrid(grid: CellGrid): CellGrid {
  const maxCols = grid.reduce((max, row) => Math.max(max, row.length), 0);
  return grid.map((row) => {
    if (row.length < maxCols) {
      return [...row, ...Array(maxCols - row.length).fill('')];
    }
    return row;
  });
}
