/** Contract: contracts/sheets-formula/rules.md */

import type { FormulaResult } from './types.ts';

/** Evaluate a comparison operator between two formula results using Excel semantics. */
export function evaluateComparison(op: string, left: FormulaResult, right: FormulaResult): FormulaResult {
  const l = left === null ? 0 : left;
  const r = right === null ? 0 : right;

  if (typeof l === 'string' && typeof r === 'string') {
    const cmp = l.localeCompare(r);
    switch (op) {
      case '=': return cmp === 0; case '<>': return cmp !== 0;
      case '<': return cmp < 0;   case '>': return cmp > 0;
      case '<=': return cmp <= 0; case '>=': return cmp >= 0;
    }
  }

  const ln = typeof l === 'number' ? l : Number(l);
  const rn = typeof r === 'number' ? r : Number(r);
  if (isNaN(ln) || isNaN(rn)) return op === '<>' ? true : false;

  switch (op) {
    case '=': return ln === rn; case '<>': return ln !== rn;
    case '<': return ln < rn;   case '>': return ln > rn;
    case '<=': return ln <= rn; case '>=': return ln >= rn;
    default: return false;
  }
}
