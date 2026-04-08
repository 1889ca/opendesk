/** Contract: contracts/sheets-formula/rules.md */

import { type FormulaResult, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { toString, toNumber, registerFunction } from './functions.ts';

function fnLEN(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'LEN requires 1 argument');
  const s = toString(args[0]);
  if (isFormulaError(s)) return s;
  return s.length;
}

function fnLEFT(args: FormulaResult[]): FormulaResult {
  if (args.length < 1 || args.length > 2) {
    return makeError(FormulaErrorType.VALUE, 'LEFT requires 1 or 2 arguments');
  }
  const s = toString(args[0]);
  if (isFormulaError(s)) return s;
  const count = args.length === 2 ? toNumber(args[1]) : 1;
  if (isFormulaError(count)) return count;
  if (count < 0) return makeError(FormulaErrorType.VALUE, 'LEFT count must be >= 0');
  return s.slice(0, count);
}

function fnRIGHT(args: FormulaResult[]): FormulaResult {
  if (args.length < 1 || args.length > 2) {
    return makeError(FormulaErrorType.VALUE, 'RIGHT requires 1 or 2 arguments');
  }
  const s = toString(args[0]);
  if (isFormulaError(s)) return s;
  const count = args.length === 2 ? toNumber(args[1]) : 1;
  if (isFormulaError(count)) return count;
  if (count < 0) return makeError(FormulaErrorType.VALUE, 'RIGHT count must be >= 0');
  if (count >= s.length) return s;
  return s.slice(s.length - count);
}

function fnMID(args: FormulaResult[]): FormulaResult {
  if (args.length !== 3) return makeError(FormulaErrorType.VALUE, 'MID requires 3 arguments');
  const s = toString(args[0]);
  if (isFormulaError(s)) return s;
  const startPos = toNumber(args[1]);
  if (isFormulaError(startPos)) return startPos;
  const count = toNumber(args[2]);
  if (isFormulaError(count)) return count;
  if (startPos < 1) return makeError(FormulaErrorType.VALUE, 'MID start must be >= 1');
  if (count < 0) return makeError(FormulaErrorType.VALUE, 'MID count must be >= 0');
  return s.slice(startPos - 1, startPos - 1 + count);
}

function fnTRIM(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'TRIM requires 1 argument');
  const s = toString(args[0]);
  if (isFormulaError(s)) return s;
  return s.trim().replace(/\s+/g, ' ');
}

function fnUPPER(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'UPPER requires 1 argument');
  const s = toString(args[0]);
  if (isFormulaError(s)) return s;
  return s.toUpperCase();
}

function fnLOWER(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'LOWER requires 1 argument');
  const s = toString(args[0]);
  if (isFormulaError(s)) return s;
  return s.toLowerCase();
}

function fnVLOOKUP(args: FormulaResult[]): FormulaResult {
  if (args.length < 3 || args.length > 4) {
    return makeError(FormulaErrorType.VALUE, 'VLOOKUP requires 3 or 4 arguments');
  }
  // VLOOKUP is special-cased in evaluator because it needs range access.
  // This is a fallback for pre-resolved args (should not normally be called).
  return makeError(FormulaErrorType.VALUE, 'VLOOKUP requires range argument (handled by evaluator)');
}

// Register text functions
registerFunction('LEN', fnLEN);
registerFunction('LEFT', fnLEFT);
registerFunction('RIGHT', fnRIGHT);
registerFunction('MID', fnMID);
registerFunction('TRIM', fnTRIM);
registerFunction('UPPER', fnUPPER);
registerFunction('LOWER', fnLOWER);
registerFunction('VLOOKUP', fnVLOOKUP);
