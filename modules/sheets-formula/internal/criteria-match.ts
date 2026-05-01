/** Contract: contracts/sheets-formula/rules.md */

import { type ASTNode, type CellGrid, type CellAddress, type FormulaResult, type RangeRef, type FormulaError, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { expandRange } from './evaluator.ts';

type EvalFn = (node: ASTNode, grid: CellGrid, cellRef: CellAddress) => FormulaResult;

export type Predicate = (val: FormulaResult) => boolean;
export type CriterionPair = { keys: string[]; test: Predicate };

export function resolveCell(grid: CellGrid, key: string): FormulaResult {
  return grid.get(key) ?? null;
}

/** Parse a criteria value into a predicate matching Excel's *IFS semantics. */
export function parseCriteria(criteria: FormulaResult): Predicate {
  if (isFormulaError(criteria)) return () => false;

  if (typeof criteria === 'string') {
    const ops: [string, (a: number, b: number) => boolean][] = [
      ['>=', (a, b) => a >= b],
      ['<=', (a, b) => a <= b],
      ['<>', (a, b) => a !== b],
      ['>', (a, b) => a > b],
      ['<', (a, b) => a < b],
      ['=', (a, b) => a === b],
    ];
    for (const [op, cmp] of ops) {
      if (criteria.startsWith(op)) {
        const rhs = criteria.slice(op.length);
        const rhsNum = Number(rhs);
        if (rhs !== '' && !isNaN(rhsNum)) {
          return (val) => typeof val === 'number' && cmp(val, rhsNum);
        }
        if (op === '<>') return (val) => String(val ?? '').toLowerCase() !== rhs.toLowerCase();
        if (op === '=') return (val) => String(val ?? '').toLowerCase() === rhs.toLowerCase();
        return () => false;
      }
    }
    // Wildcard matching (* and ? with escape)
    const pattern = criteria.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    const re = new RegExp(`^${pattern}$`, 'i');
    return (val) => typeof val === 'string' && re.test(val);
  }

  return (val) => val === criteria;
}

/** Resolve a (range, criteria) arg pair into keys + predicate. */
export function resolveCriterionPair(
  rangeArg: ASTNode, criteriaArg: ASTNode,
  grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn
): CriterionPair | FormulaError {
  if (rangeArg.type !== 'range_ref') {
    return makeError(FormulaErrorType.VALUE, 'criterion_range must be a range');
  }
  const criteria = evalNode(criteriaArg, grid, cellRef);
  if (isFormulaError(criteria)) return criteria;
  return { keys: expandRange(rangeArg as RangeRef), test: parseCriteria(criteria) };
}

/** Collect repeating (range, criteria) pairs starting at startIdx. */
export function collectPairs(
  args: ASTNode[], startIdx: number,
  grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn
): CriterionPair[] | FormulaError {
  const pairs: CriterionPair[] = [];
  for (let i = startIdx; i < args.length; i += 2) {
    const p = resolveCriterionPair(args[i], args[i + 1], grid, cellRef, evalNode);
    if (isFormulaError(p)) return p;
    pairs.push(p);
  }
  return pairs;
}

/** Compute the indices where every criterion holds. All pair ranges must be equal length. */
export function matchingIndices(pairs: CriterionPair[], grid: CellGrid): number[] | FormulaError {
  if (pairs.length === 0) return [];
  const len = pairs[0].keys.length;
  for (const p of pairs) {
    if (p.keys.length !== len) {
      return makeError(FormulaErrorType.VALUE, 'criterion ranges must be the same size');
    }
  }
  const out: number[] = [];
  outer: for (let i = 0; i < len; i++) {
    for (const p of pairs) {
      if (!p.test(resolveCell(grid, p.keys[i]))) continue outer;
    }
    out.push(i);
  }
  return out;
}
