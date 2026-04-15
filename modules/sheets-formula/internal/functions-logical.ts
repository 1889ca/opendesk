/** Contract: contracts/sheets-formula/rules.md */

import { type FormulaResult, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { registerFunction } from './functions.ts';

/** Excel-style truthiness: 0/false/null/"" are falsy; errors bubble up. */
function toBool(val: FormulaResult): boolean | import('./types.ts').FormulaError {
  if (isFormulaError(val)) return val;
  if (val === null || val === '') return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  // Strings that look like "TRUE" / "FALSE"
  const upper = String(val).toUpperCase();
  if (upper === 'TRUE') return true;
  if (upper === 'FALSE') return false;
  return makeError(FormulaErrorType.VALUE, `Cannot convert "${val}" to boolean`);
}

/** AND(...): TRUE iff every argument is truthy. Ignores empty args; errors propagate. */
function fnAND(args: FormulaResult[]): FormulaResult {
  if (args.length === 0) return makeError(FormulaErrorType.VALUE, 'AND requires at least 1 argument');
  let seen = 0;
  for (const arg of args) {
    if (arg === null || arg === '') continue; // Excel skips empties
    const b = toBool(arg);
    if (isFormulaError(b)) return b;
    if (!b) return false;
    seen++;
  }
  if (seen === 0) return makeError(FormulaErrorType.VALUE, 'AND requires at least 1 non-empty argument');
  return true;
}

/** OR(...): TRUE iff any argument is truthy. */
function fnOR(args: FormulaResult[]): FormulaResult {
  if (args.length === 0) return makeError(FormulaErrorType.VALUE, 'OR requires at least 1 argument');
  let seen = 0;
  for (const arg of args) {
    if (arg === null || arg === '') continue;
    const b = toBool(arg);
    if (isFormulaError(b)) return b;
    if (b) return true;
    seen++;
  }
  if (seen === 0) return makeError(FormulaErrorType.VALUE, 'OR requires at least 1 non-empty argument');
  return false;
}

/** NOT(x): logical negation. */
function fnNOT(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'NOT requires exactly 1 argument');
  const b = toBool(args[0]);
  if (isFormulaError(b)) return b;
  return !b;
}

/** XOR(...): TRUE iff an odd number of arguments are truthy. */
function fnXOR(args: FormulaResult[]): FormulaResult {
  if (args.length === 0) return makeError(FormulaErrorType.VALUE, 'XOR requires at least 1 argument');
  let trueCount = 0;
  let seen = 0;
  for (const arg of args) {
    if (arg === null || arg === '') continue;
    const b = toBool(arg);
    if (isFormulaError(b)) return b;
    if (b) trueCount++;
    seen++;
  }
  if (seen === 0) return makeError(FormulaErrorType.VALUE, 'XOR requires at least 1 non-empty argument');
  return trueCount % 2 === 1;
}

/**
 * IFERROR(value, fallback): returns fallback if value is any error; otherwise value.
 * Note: args are pre-evaluated by the dispatcher; errors flow in as FormulaError
 * values inside the args array rather than aborting argument resolution, so this
 * works without special-casing in the evaluator.
 */
function fnIFERROR(args: FormulaResult[]): FormulaResult {
  if (args.length !== 2) return makeError(FormulaErrorType.VALUE, 'IFERROR requires 2 arguments');
  return isFormulaError(args[0]) ? args[1] : args[0];
}

/** IFNA(value, fallback): like IFERROR but only intercepts #N/A. */
function fnIFNA(args: FormulaResult[]): FormulaResult {
  if (args.length !== 2) return makeError(FormulaErrorType.VALUE, 'IFNA requires 2 arguments');
  if (isFormulaError(args[0]) && args[0].error === FormulaErrorType.NA) return args[1];
  return args[0];
}

/**
 * IFS(cond1, val1, cond2, val2, ...): returns the first value whose cond is truthy.
 * Excel returns #N/A if no conditions match.
 */
function fnIFS(args: FormulaResult[]): FormulaResult {
  if (args.length < 2 || args.length % 2 !== 0) {
    return makeError(FormulaErrorType.VALUE, 'IFS requires an even number of arguments (>=2)');
  }
  for (let i = 0; i < args.length; i += 2) {
    const b = toBool(args[i]);
    if (isFormulaError(b)) return b;
    if (b) return args[i + 1];
  }
  return makeError(FormulaErrorType.NA, 'IFS: no condition matched');
}

/**
 * SWITCH(expr, match1, val1, match2, val2, ..., [default]):
 * compare expr against each match, return the paired value on exact equality;
 * if an odd trailing argument remains it is the default.
 */
function fnSWITCH(args: FormulaResult[]): FormulaResult {
  if (args.length < 3) return makeError(FormulaErrorType.VALUE, 'SWITCH requires at least 3 arguments');
  const expr = args[0];
  if (isFormulaError(expr)) return expr;
  const pairEnd = args.length - ((args.length - 1) % 2 === 1 ? 1 : 0);
  for (let i = 1; i < pairEnd; i += 2) {
    const match = args[i];
    if (isFormulaError(match)) continue;
    if (match === expr) return args[i + 1];
    if (typeof match === 'string' && typeof expr === 'string' &&
      match.toLowerCase() === expr.toLowerCase()) return args[i + 1];
  }
  // Trailing default if argument count is even (expr + pairs + default)
  if ((args.length - 1) % 2 === 1) return args[args.length - 1];
  return makeError(FormulaErrorType.NA, 'SWITCH: no match and no default');
}

/** TRUE() / FALSE(): no-argument boolean literals. */
function fnTRUE(args: FormulaResult[]): FormulaResult {
  if (args.length !== 0) return makeError(FormulaErrorType.VALUE, 'TRUE takes no arguments');
  return true;
}
function fnFALSE(args: FormulaResult[]): FormulaResult {
  if (args.length !== 0) return makeError(FormulaErrorType.VALUE, 'FALSE takes no arguments');
  return false;
}

/** ISERROR / ISNA / ISNUMBER / ISTEXT / ISBLANK / ISLOGICAL — type predicates. */
function fnISERROR(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'ISERROR requires 1 argument');
  return isFormulaError(args[0]);
}
function fnISNA(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'ISNA requires 1 argument');
  return isFormulaError(args[0]) && args[0].error === FormulaErrorType.NA;
}
function fnISNUMBER(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'ISNUMBER requires 1 argument');
  return typeof args[0] === 'number';
}
function fnISTEXT(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'ISTEXT requires 1 argument');
  return typeof args[0] === 'string';
}
function fnISBLANK(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'ISBLANK requires 1 argument');
  return args[0] === null;
}
function fnISLOGICAL(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'ISLOGICAL requires 1 argument');
  return typeof args[0] === 'boolean';
}

registerFunction('AND', fnAND);
registerFunction('OR', fnOR);
registerFunction('NOT', fnNOT);
registerFunction('XOR', fnXOR);
registerFunction('IFERROR', fnIFERROR);
registerFunction('IFNA', fnIFNA);
registerFunction('IFS', fnIFS);
registerFunction('SWITCH', fnSWITCH);
registerFunction('TRUE', fnTRUE);
registerFunction('FALSE', fnFALSE);
registerFunction('ISERROR', fnISERROR);
registerFunction('ISNA', fnISNA);
registerFunction('ISNUMBER', fnISNUMBER);
registerFunction('ISTEXT', fnISTEXT);
registerFunction('ISBLANK', fnISBLANK);
registerFunction('ISLOGICAL', fnISLOGICAL);
