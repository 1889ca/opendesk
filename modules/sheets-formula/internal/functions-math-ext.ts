/** Contract: contracts/sheets-formula/rules.md */

import { type FormulaResult, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { toNumber, registerFunction } from './functions.ts';

function requireNum(args: FormulaResult[], name: string, count: number): number[] | FormulaResult {
  if (args.length !== count) {
    return makeError(FormulaErrorType.VALUE, `${name} requires ${count} argument(s)`);
  }
  const nums: number[] = [];
  for (const arg of args) {
    const n = toNumber(arg);
    if (isFormulaError(n)) return n;
    nums.push(n);
  }
  return nums;
}

function fnPOWER(args: FormulaResult[]): FormulaResult {
  const r = requireNum(args, 'POWER', 2);
  if (!Array.isArray(r)) return r;
  const result = Math.pow(r[0], r[1]);
  if (!isFinite(result)) return makeError(FormulaErrorType.NUM, 'POWER: result is not finite');
  return result;
}

function fnSQRT(args: FormulaResult[]): FormulaResult {
  const r = requireNum(args, 'SQRT', 1);
  if (!Array.isArray(r)) return r;
  if (r[0] < 0) return makeError(FormulaErrorType.NUM, 'SQRT of negative number');
  return Math.sqrt(r[0]);
}

function fnLOG(args: FormulaResult[]): FormulaResult {
  if (args.length < 1 || args.length > 2) {
    return makeError(FormulaErrorType.VALUE, 'LOG requires 1 or 2 arguments');
  }
  const num = toNumber(args[0]);
  if (isFormulaError(num)) return num;
  if (num <= 0) return makeError(FormulaErrorType.NUM, 'LOG of non-positive number');
  const base = args.length === 2 ? toNumber(args[1]) : 10;
  if (isFormulaError(base)) return base;
  if (base <= 0 || base === 1) return makeError(FormulaErrorType.NUM, 'LOG base must be positive and not 1');
  return Math.log(num) / Math.log(base);
}

function fnLN(args: FormulaResult[]): FormulaResult {
  const r = requireNum(args, 'LN', 1);
  if (!Array.isArray(r)) return r;
  if (r[0] <= 0) return makeError(FormulaErrorType.NUM, 'LN of non-positive number');
  return Math.log(r[0]);
}

function fnEXP(args: FormulaResult[]): FormulaResult {
  const r = requireNum(args, 'EXP', 1);
  if (!Array.isArray(r)) return r;
  return Math.exp(r[0]);
}

function fnMOD(args: FormulaResult[]): FormulaResult {
  const r = requireNum(args, 'MOD', 2);
  if (!Array.isArray(r)) return r;
  if (r[1] === 0) return makeError(FormulaErrorType.DIV0, 'MOD: divisor is 0');
  // Excel MOD: result has same sign as divisor
  return r[0] - r[1] * Math.floor(r[0] / r[1]);
}

function fnINT(args: FormulaResult[]): FormulaResult {
  const r = requireNum(args, 'INT', 1);
  if (!Array.isArray(r)) return r;
  return Math.floor(r[0]);
}

function fnSIGN(args: FormulaResult[]): FormulaResult {
  const r = requireNum(args, 'SIGN', 1);
  if (!Array.isArray(r)) return r;
  return Math.sign(r[0]);
}

function fnPI(_args: FormulaResult[]): FormulaResult {
  return Math.PI;
}

function fnRAND(_args: FormulaResult[]): FormulaResult {
  return Math.random();
}

function fnRANDBETWEEN(args: FormulaResult[]): FormulaResult {
  const r = requireNum(args, 'RANDBETWEEN', 2);
  if (!Array.isArray(r)) return r;
  const lo = Math.ceil(r[0]);
  const hi = Math.floor(r[1]);
  if (lo > hi) return makeError(FormulaErrorType.NUM, 'RANDBETWEEN: bottom > top');
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function fnEVEN(args: FormulaResult[]): FormulaResult {
  const r = requireNum(args, 'EVEN', 1);
  if (!Array.isArray(r)) return r;
  const val = r[0];
  const rounded = val >= 0 ? Math.ceil(val) : Math.floor(val);
  return rounded % 2 === 0 ? rounded : rounded + Math.sign(val || 1);
}

function fnODD(args: FormulaResult[]): FormulaResult {
  const r = requireNum(args, 'ODD', 1);
  if (!Array.isArray(r)) return r;
  const val = r[0];
  const rounded = val >= 0 ? Math.ceil(val) : Math.floor(val);
  if (rounded === 0) return 1;
  return Math.abs(rounded) % 2 === 1 ? rounded : rounded + Math.sign(val);
}

function fnLOG10(args: FormulaResult[]): FormulaResult {
  const r = requireNum(args, 'LOG10', 1);
  if (!Array.isArray(r)) return r;
  if (r[0] <= 0) return makeError(FormulaErrorType.NUM, 'LOG10: argument must be > 0');
  return Math.log10(r[0]);
}

registerFunction('POWER', fnPOWER);
registerFunction('SQRT', fnSQRT);
registerFunction('LOG', fnLOG);
registerFunction('LN', fnLN);
registerFunction('EXP', fnEXP);
registerFunction('MOD', fnMOD);
registerFunction('INT', fnINT);
registerFunction('SIGN', fnSIGN);
registerFunction('PI', fnPI);
registerFunction('RAND', fnRAND);
registerFunction('RANDBETWEEN', fnRANDBETWEEN);
registerFunction('EVEN', fnEVEN);
registerFunction('ODD', fnODD);
registerFunction('LOG10', fnLOG10);
