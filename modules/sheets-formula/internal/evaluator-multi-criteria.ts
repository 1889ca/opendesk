/** Contract: contracts/sheets-formula/rules.md */

import { type ASTNode, type CellGrid, type CellAddress, type FormulaResult, type RangeRef, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { expandRange } from './evaluator.ts';
import { resolveCell, resolveCriterionPair, collectPairs, matchingIndices } from './criteria-match.ts';

type EvalFn = (node: ASTNode, grid: CellGrid, cellRef: CellAddress) => FormulaResult;

/** COUNTIFS(range1, criteria1, [range2, criteria2, ...]) */
export function evaluateCOUNTIFS(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn
): FormulaResult {
  if (args.length < 2 || args.length % 2 !== 0) {
    return makeError(FormulaErrorType.VALUE, 'COUNTIFS requires pairs of (range, criteria)');
  }
  const pairs = collectPairs(args, 0, grid, cellRef, evalNode);
  if (isFormulaError(pairs)) return pairs;
  const indices = matchingIndices(pairs, grid);
  if (isFormulaError(indices)) return indices;
  return indices.length;
}

/** SUMIFS(sum_range, range1, criteria1, [range2, criteria2, ...]) */
export function evaluateSUMIFS(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn
): FormulaResult {
  if (args.length < 3 || args.length % 2 !== 1) {
    return makeError(FormulaErrorType.VALUE, 'SUMIFS requires sum_range + pairs of (range, criteria)');
  }
  if (args[0].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'SUMIFS sum_range must be a range');
  const sumKeys = expandRange(args[0] as RangeRef);
  const pairs = collectPairs(args, 1, grid, cellRef, evalNode);
  if (isFormulaError(pairs)) return pairs;
  if (pairs[0] && pairs[0].keys.length !== sumKeys.length) {
    return makeError(FormulaErrorType.VALUE, 'SUMIFS sum_range must match criterion ranges');
  }
  const indices = matchingIndices(pairs, grid);
  if (isFormulaError(indices)) return indices;
  let total = 0;
  for (const i of indices) {
    const v = resolveCell(grid, sumKeys[i]);
    if (typeof v === 'number') total += v;
  }
  return total;
}

/** AVERAGEIF(range, criteria, [average_range]) */
export function evaluateAVERAGEIF(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn
): FormulaResult {
  if (args.length < 2 || args.length > 3) {
    return makeError(FormulaErrorType.VALUE, 'AVERAGEIF requires 2 or 3 arguments');
  }
  const p = resolveCriterionPair(args[0], args[1], grid, cellRef, evalNode);
  if (isFormulaError(p)) return p;
  let avgKeys = p.keys;
  if (args.length === 3) {
    if (args[2].type !== 'range_ref') {
      return makeError(FormulaErrorType.VALUE, 'AVERAGEIF average_range must be a range');
    }
    avgKeys = expandRange(args[2] as RangeRef);
  }
  let total = 0;
  let count = 0;
  for (let i = 0; i < p.keys.length; i++) {
    if (p.test(resolveCell(grid, p.keys[i]))) {
      const v = resolveCell(grid, avgKeys[i] ?? p.keys[i]);
      if (typeof v === 'number') { total += v; count++; }
    }
  }
  if (count === 0) return makeError(FormulaErrorType.DIV0, 'AVERAGEIF: no matching numbers');
  return total / count;
}

/** AVERAGEIFS(average_range, range1, criteria1, ...) */
export function evaluateAVERAGEIFS(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn
): FormulaResult {
  if (args.length < 3 || args.length % 2 !== 1) {
    return makeError(FormulaErrorType.VALUE, 'AVERAGEIFS requires avg_range + pairs of (range, criteria)');
  }
  if (args[0].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'AVERAGEIFS avg_range must be a range');
  const avgKeys = expandRange(args[0] as RangeRef);
  const pairs = collectPairs(args, 1, grid, cellRef, evalNode);
  if (isFormulaError(pairs)) return pairs;
  if (pairs[0] && pairs[0].keys.length !== avgKeys.length) {
    return makeError(FormulaErrorType.VALUE, 'AVERAGEIFS avg_range must match criterion ranges');
  }
  const indices = matchingIndices(pairs, grid);
  if (isFormulaError(indices)) return indices;
  let total = 0;
  let count = 0;
  for (const i of indices) {
    const v = resolveCell(grid, avgKeys[i]);
    if (typeof v === 'number') { total += v; count++; }
  }
  if (count === 0) return makeError(FormulaErrorType.DIV0, 'AVERAGEIFS: no matching numbers');
  return total / count;
}

function minMaxIfs(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn,
  mode: 'min' | 'max', name: string
): FormulaResult {
  if (args.length < 3 || args.length % 2 !== 1) {
    return makeError(FormulaErrorType.VALUE, `${name} requires target_range + pairs of (range, criteria)`);
  }
  if (args[0].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, `${name} target_range must be a range`);
  const targetKeys = expandRange(args[0] as RangeRef);
  const pairs = collectPairs(args, 1, grid, cellRef, evalNode);
  if (isFormulaError(pairs)) return pairs;
  if (pairs[0] && pairs[0].keys.length !== targetKeys.length) {
    return makeError(FormulaErrorType.VALUE, `${name} target_range must match criterion ranges`);
  }
  const indices = matchingIndices(pairs, grid);
  if (isFormulaError(indices)) return indices;
  let best: number | null = null;
  for (const i of indices) {
    const v = resolveCell(grid, targetKeys[i]);
    if (typeof v !== 'number') continue;
    if (best === null) best = v;
    else if (mode === 'min' && v < best) best = v;
    else if (mode === 'max' && v > best) best = v;
  }
  return best ?? 0;
}

export function evaluateMAXIFS(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn
): FormulaResult { return minMaxIfs(args, grid, cellRef, evalNode, 'max', 'MAXIFS'); }

export function evaluateMINIFS(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn
): FormulaResult { return minMaxIfs(args, grid, cellRef, evalNode, 'min', 'MINIFS'); }
