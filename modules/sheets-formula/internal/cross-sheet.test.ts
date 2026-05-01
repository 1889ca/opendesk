/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { parse } from './parser.ts';
import { evaluate, expandRange } from './evaluator.ts';
import { extractDependencies, detectCircular } from './circular-detect.ts';
import { isFormulaError, FormulaErrorType } from './types.ts';
import type { CellGrid, FormulaResult } from './types.ts';
import type { MultiSheetGrid } from './cross-sheet-types.ts';
import type { CrossSheetCellRef, CrossSheetRangeRef } from './cross-sheet-types.ts';

// ---------------------------------------------------------------------------
// Test fixtures — no mock data; all values are deterministic constants
// ---------------------------------------------------------------------------

function makeGrid(entries: [string, FormulaResult][]): CellGrid {
  return new Map(entries);
}

function makeMultiSheet(sheets: Record<string, [string, FormulaResult][]>): MultiSheetGrid {
  const ms = new Map<string, ReadonlyMap<string, FormulaResult>>();
  for (const [name, cells] of Object.entries(sheets)) {
    ms.set(name, makeGrid(cells));
  }
  return ms;
}

// ---------------------------------------------------------------------------
// Tokenizer / Parser
// ---------------------------------------------------------------------------

describe('cross-sheet tokenizer', () => {
  it('tokenizes an unquoted sheet prefix', () => {
    const ast = parse('=Sheet2!A1');
    expect(isFormulaError(ast)).toBe(false);
    expect((ast as CrossSheetCellRef).type).toBe('cross_sheet_cell_ref');
  });

  it('tokenizes a quoted sheet prefix with spaces', () => {
    const ast = parse("='My Sheet'!B3");
    expect(isFormulaError(ast)).toBe(false);
    const node = ast as CrossSheetCellRef;
    expect(node.type).toBe('cross_sheet_cell_ref');
    expect(node.sheet).toBe('My Sheet');
    expect(node.ref.col).toBe('B');
    expect(node.ref.row).toBe(3);
  });

  it('tokenizes escaped single quotes in sheet name', () => {
    const ast = parse("='Bob''s Sheet'!C5");
    expect(isFormulaError(ast)).toBe(false);
    const node = ast as CrossSheetCellRef;
    expect(node.sheet).toBe("Bob's Sheet");
    expect(node.ref.col).toBe('C');
    expect(node.ref.row).toBe(5);
  });

  it('tokenizes a cross-sheet range reference', () => {
    const ast = parse('=Sheet2!A1:B3');
    expect(isFormulaError(ast)).toBe(false);
    const node = ast as CrossSheetRangeRef;
    expect(node.type).toBe('cross_sheet_range_ref');
    expect(node.sheet).toBe('Sheet2');
    expect(node.start.col).toBe('A');
    expect(node.start.row).toBe(1);
    expect(node.end.col).toBe('B');
    expect(node.end.row).toBe(3);
  });

  it('parses cross-sheet ref inside a function call', () => {
    const ast = parse('=SUM(Sheet2!A1:A3)');
    expect(isFormulaError(ast)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Evaluator — single-cell cross-sheet references
// ---------------------------------------------------------------------------

describe('cross-sheet single-cell evaluation', () => {
  const activeGrid = makeGrid([['A1', 10]]);
  const multiSheet = makeMultiSheet({
    Sheet1: [['A1', 10]],
    Sheet2: [['A1', 42], ['B3', 99]],
  });

  it('resolves a cross-sheet cell reference', () => {
    const result = evaluate(parse('=Sheet2!A1') as never, activeGrid, 'A1', multiSheet);
    expect(result).toBe(42);
  });

  it('resolves a quoted cross-sheet cell reference', () => {
    const ms = makeMultiSheet({
      Sheet1: [['A1', 1]],
      'My Sheet': [['C2', 77]],
    });
    const result = evaluate(parse("='My Sheet'!C2") as never, activeGrid, 'A1', ms);
    expect(result).toBe(77);
  });

  it('returns null for an empty cell in an existing sheet', () => {
    const result = evaluate(parse('=Sheet2!Z99') as never, activeGrid, 'A1', multiSheet);
    expect(result).toBeNull();
  });

  it('returns #REF! for a missing sheet', () => {
    const result = evaluate(parse('=NoSuchSheet!A1') as never, activeGrid, 'A1', multiSheet);
    expect(isFormulaError(result)).toBe(true);
    expect((result as { error: string }).error).toBe(FormulaErrorType.REF);
  });

  it('returns #REF! when no multiSheet context provided', () => {
    const result = evaluate(parse('=Sheet2!A1') as never, activeGrid, 'A1');
    expect(isFormulaError(result)).toBe(true);
    expect((result as { error: string }).error).toBe(FormulaErrorType.REF);
  });

  it('cross-sheet ref can participate in arithmetic', () => {
    const result = evaluate(parse('=Sheet2!A1+Sheet2!B3') as never, activeGrid, 'A1', multiSheet);
    expect(result).toBe(141); // 42 + 99
  });
});

// ---------------------------------------------------------------------------
// Evaluator — cross-sheet range inside SUM
// ---------------------------------------------------------------------------

describe('cross-sheet range in functions', () => {
  const activeGrid = makeGrid([]);
  const multiSheet = makeMultiSheet({
    Sheet1: [],
    Data: [['A1', 10], ['A2', 20], ['A3', 30]],
  });

  it('SUM over a cross-sheet range', () => {
    const result = evaluate(parse('=SUM(Data!A1:A3)') as never, activeGrid, 'Z1', multiSheet);
    expect(result).toBe(60);
  });

  it('returns #REF! when sheet in range is missing', () => {
    const result = evaluate(parse('=SUM(Ghost!A1:A3)') as never, activeGrid, 'Z1', multiSheet);
    expect(isFormulaError(result)).toBe(true);
    expect((result as { error: string }).error).toBe(FormulaErrorType.REF);
  });
});

// ---------------------------------------------------------------------------
// Dependency extraction — cross-sheet
// ---------------------------------------------------------------------------

describe('extractDependencies with cross-sheet refs', () => {
  it('extracts cross-sheet single-cell dependency', () => {
    const deps = extractDependencies('=Sheet2!A1');
    expect(deps.has('Sheet2!A1')).toBe(true);
  });

  it('extracts cross-sheet range dependencies', () => {
    const deps = extractDependencies('=SUM(Data!A1:A3)');
    expect(deps.has('Data!A1')).toBe(true);
    expect(deps.has('Data!A2')).toBe(true);
    expect(deps.has('Data!A3')).toBe(true);
  });

  it('extracts mixed same-sheet and cross-sheet deps', () => {
    const deps = extractDependencies('=A1+Sheet2!B2');
    expect(deps.has('A1')).toBe(true);
    expect(deps.has('Sheet2!B2')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Circular reference detection — cross-sheet
// ---------------------------------------------------------------------------

describe('detectCircular across sheets', () => {
  it('detects a direct circular reference on the same sheet', () => {
    const formulas = new Map([
      ['A1', '=B1'],
      ['B1', '=A1'],
    ]);
    const circular = detectCircular(formulas);
    expect(circular.has('A1')).toBe(true);
    expect(circular.has('B1')).toBe(true);
  });

  it('does not flag non-circular cross-sheet references', () => {
    // Sheet1!A1 depends on Sheet2!A1, but Sheet2!A1 has no back-reference
    const formulas = new Map([
      ['A1', '=Sheet2!A1+1'],
    ]);
    const circular = detectCircular(formulas);
    expect(circular.size).toBe(0);
  });
});
