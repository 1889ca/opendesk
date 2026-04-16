/** Contract: contracts/sheets-formula/rules.md */

import { type FormulaResult, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { toNumber, registerFunction } from './functions.ts';

function fnAND(args: FormulaResult[]): FormulaResult {
  if (args.length === 0) return makeError(FormulaErrorType.VALUE, 'AND requires at least 1 argument');
  for (const arg of args) {
    if (isFormulaError(arg)) return arg;
    const n = toNumber(arg);
    if (isFormulaError(n)) return n;
    if (!arg && arg !== 0) return false;
    if (arg === 0 || arg === false) return false;
  }
  return true;
}

function fnOR(args: FormulaResult[]): FormulaResult {
  if (args.length === 0) return makeError(FormulaErrorType.VALUE, 'OR requires at least 1 argument');
  for (const arg of args) {
    if (isFormulaError(arg)) return arg;
    if (arg === true) return true;
    if (typeof arg === 'number' && arg !== 0) return true;
  }
  return false;
}

function fnNOT(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'NOT requires 1 argument');
  if (isFormulaError(args[0])) return args[0];
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  return n === 0;
}

function fnIFERROR(args: FormulaResult[]): FormulaResult {
  if (args.length !== 2) return makeError(FormulaErrorType.VALUE, 'IFERROR requires 2 arguments');
  return isFormulaError(args[0]) ? args[1] : args[0];
}

function fnIFNA(args: FormulaResult[]): FormulaResult {
  if (args.length !== 2) return makeError(FormulaErrorType.VALUE, 'IFNA requires 2 arguments');
  if (isFormulaError(args[0]) && args[0].error === FormulaErrorType.NA) return args[1];
  return args[0];
}

function fnISBLANK(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'ISBLANK requires 1 argument');
  return args[0] === null || args[0] === '';
}

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

function fnXOR(args: FormulaResult[]): FormulaResult {
  if (args.length === 0) return makeError(FormulaErrorType.VALUE, 'XOR requires at least 1 argument');
  let trueCount = 0;
  for (const arg of args) {
    if (isFormulaError(arg)) return arg;
    if (arg === true || (typeof arg === 'number' && arg !== 0)) trueCount++;
  }
  return trueCount % 2 === 1;
}

registerFunction('AND', fnAND);
registerFunction('OR', fnOR);
registerFunction('NOT', fnNOT);
registerFunction('IFERROR', fnIFERROR);
registerFunction('IFNA', fnIFNA);
registerFunction('ISBLANK', fnISBLANK);
registerFunction('ISERROR', fnISERROR);
registerFunction('ISNA', fnISNA);
registerFunction('ISNUMBER', fnISNUMBER);
registerFunction('ISTEXT', fnISTEXT);
registerFunction('XOR', fnXOR);
