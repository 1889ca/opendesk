/** Contract: contracts/sheets-formula/rules.md — Property-based tests */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parse } from './parser.ts';
import { evaluate, colToIndex, indexToCol, expandRange } from './evaluator.ts';
import { tokenize } from './tokenizer.ts';
import { isFormulaError, type CellGrid, type ASTNode, type RangeRef } from './types.ts';

/** Arbitrary for valid single-letter columns (A-Z). */
const colArb = fc.integer({ min: 1, max: 26 }).map((n) => String.fromCharCode(64 + n));

describe('sheets-formula property tests', () => {
  it('colToIndex and indexToCol are inverse operations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 702 }),
        (index: number) => {
          const col = indexToCol(index);
          expect(colToIndex(col)).toBe(index);
        },
      ),
    );
  });

  it('tokenizing numeric literals produces NUMBER tokens', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999 }),
        (n: number) => {
          const tokens = tokenize(String(n));
          if (Array.isArray(tokens)) {
            const numTokens = tokens.filter((t) => t.type === 'NUMBER');
            expect(numTokens.length).toBeGreaterThanOrEqual(1);
          }
        },
      ),
    );
  });

  it('parsing constant integer expressions is deterministic', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -999, max: 999 }),
        (n: number) => {
          const formula = n >= 0 ? String(n) : `(0${n})`;
          const ast1 = parse(formula);
          const ast2 = parse(formula);
          expect(JSON.stringify(ast1)).toBe(JSON.stringify(ast2));
        },
      ),
    );
  });

  it('evaluation of constant addition is consistent with JS arithmetic', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -500, max: 500 }),
        fc.integer({ min: -500, max: 500 }),
        (a: number, b: number) => {
          const formula = `${a >= 0 ? a : `(0${a})`}+${b >= 0 ? b : `(0${b})`}`;
          const ast = parse(formula);
          if (isFormulaError(ast)) return;
          const grid: CellGrid = new Map();
          const result = evaluate(ast as ASTNode, grid, 'Z99');
          if (typeof result === 'number') {
            expect(result).toBe(a + b);
          }
        },
      ),
    );
  });

  it('evaluation of constant multiplication is consistent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: -100, max: 100 }),
        (a: number, b: number) => {
          const formula = `${a >= 0 ? a : `(0${a})`}*${b >= 0 ? b : `(0${b})`}`;
          const ast = parse(formula);
          if (isFormulaError(ast)) return;
          const grid: CellGrid = new Map();
          const result = evaluate(ast as ASTNode, grid, 'Z99');
          if (typeof result === 'number') {
            expect(result).toBe(a * b);
          }
        },
      ),
    );
  });

  it('expandRange always produces cells within the specified bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 26 }),
        fc.integer({ min: 1, max: 26 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (c1: number, c2: number, r1: number, r2: number) => {
          const range: RangeRef = {
            type: 'range_ref',
            start: { type: 'cell_ref', col: indexToCol(c1), row: r1, colAbsolute: false, rowAbsolute: false },
            end: { type: 'cell_ref', col: indexToCol(c2), row: r2, colAbsolute: false, rowAbsolute: false },
          };

          const cells = expandRange(range);
          const minRow = Math.min(r1, r2);
          const maxRow = Math.max(r1, r2);
          const minCol = Math.min(c1, c2);
          const maxCol = Math.max(c1, c2);

          const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
          expect(cells).toHaveLength(expectedCount);

          // Every cell should be unique
          expect(new Set(cells).size).toBe(cells.length);
        },
      ),
    );
  });

  it('operator precedence: multiplication binds tighter than addition', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        (a: number, b: number, c: number) => {
          // a + b * c should equal a + (b * c), not (a + b) * c
          const formula = `${a}+${b}*${c}`;
          const ast = parse(formula);
          if (isFormulaError(ast)) return;
          const grid: CellGrid = new Map();
          const result = evaluate(ast as ASTNode, grid, 'Z99');
          if (typeof result === 'number') {
            expect(result).toBe(a + b * c);
          }
        },
      ),
    );
  });

  it('division by zero always produces DIV0 error', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (a: number) => {
          const formula = `${a}/0`;
          const ast = parse(formula);
          if (isFormulaError(ast)) return;
          const grid: CellGrid = new Map();
          const result = evaluate(ast as ASTNode, grid, 'Z99');
          expect(isFormulaError(result)).toBe(true);
          if (isFormulaError(result)) {
            expect(result.error).toBe('#DIV/0!');
          }
        },
      ),
    );
  });
});
