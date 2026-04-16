/** Contract: contracts/sheets-formula/rules.md */

import { type FormulaResult, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { toNumber, registerFunction } from './functions.ts';

function fnINT(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'INT requires 1 argument');
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  return Math.floor(n);
}

function fnMOD(args: FormulaResult[]): FormulaResult {
  if (args.length !== 2) return makeError(FormulaErrorType.VALUE, 'MOD requires 2 arguments');
  const num = toNumber(args[0]);
  if (isFormulaError(num)) return num;
  const divisor = toNumber(args[1]);
  if (isFormulaError(divisor)) return divisor;
  if (divisor === 0) return makeError(FormulaErrorType.DIV0, 'MOD: divisor cannot be 0');
  // Excel MOD: result has same sign as divisor
  return num - divisor * Math.floor(num / divisor);
}

function fnPOWER(args: FormulaResult[]): FormulaResult {
  if (args.length !== 2) return makeError(FormulaErrorType.VALUE, 'POWER requires 2 arguments');
  const base = toNumber(args[0]);
  if (isFormulaError(base)) return base;
  const exp = toNumber(args[1]);
  if (isFormulaError(exp)) return exp;
  const result = Math.pow(base, exp);
  if (!isFinite(result)) return makeError(FormulaErrorType.NUM, 'POWER: result is not finite');
  return result;
}

function fnSQRT(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'SQRT requires 1 argument');
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  if (n < 0) return makeError(FormulaErrorType.NUM, 'SQRT: argument must be >= 0');
  return Math.sqrt(n);
}

function fnLOG(args: FormulaResult[]): FormulaResult {
  if (args.length < 1 || args.length > 2) return makeError(FormulaErrorType.VALUE, 'LOG requires 1 or 2 arguments');
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  if (n <= 0) return makeError(FormulaErrorType.NUM, 'LOG: argument must be > 0');
  const base = args.length === 2 ? toNumber(args[1]) : 10;
  if (isFormulaError(base)) return base;
  if (base <= 0 || base === 1) return makeError(FormulaErrorType.NUM, 'LOG: base must be > 0 and != 1');
  return Math.log(n) / Math.log(base);
}

function fnLN(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'LN requires 1 argument');
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  if (n <= 0) return makeError(FormulaErrorType.NUM, 'LN: argument must be > 0');
  return Math.log(n);
}

function fnEXP(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'EXP requires 1 argument');
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  return Math.exp(n);
}

function fnPI(args: FormulaResult[]): FormulaResult {
  if (args.length !== 0) return makeError(FormulaErrorType.VALUE, 'PI takes no arguments');
  return Math.PI;
}

function fnRAND(_args: FormulaResult[]): FormulaResult {
  return Math.random();
}

function fnRANDBETWEEN(args: FormulaResult[]): FormulaResult {
  if (args.length !== 2) return makeError(FormulaErrorType.VALUE, 'RANDBETWEEN requires 2 arguments');
  const bottom = toNumber(args[0]);
  if (isFormulaError(bottom)) return bottom;
  const top = toNumber(args[1]);
  if (isFormulaError(top)) return top;
  const lo = Math.ceil(bottom);
  const hi = Math.floor(top);
  if (lo > hi) return makeError(FormulaErrorType.NUM, 'RANDBETWEEN: bottom must be <= top');
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function fnSIGN(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'SIGN requires 1 argument');
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  return Math.sign(n);
}

function fnLOG10(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'LOG10 requires 1 argument');
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  if (n <= 0) return makeError(FormulaErrorType.NUM, 'LOG10: argument must be > 0');
  return Math.log10(n);
}

registerFunction('INT', fnINT);
registerFunction('MOD', fnMOD);
registerFunction('POWER', fnPOWER);
registerFunction('SQRT', fnSQRT);
registerFunction('LOG', fnLOG);
registerFunction('LN', fnLN);
registerFunction('EXP', fnEXP);
registerFunction('PI', fnPI);
registerFunction('RAND', fnRAND);
registerFunction('RANDBETWEEN', fnRANDBETWEEN);
registerFunction('SIGN', fnSIGN);
registerFunction('LOG10', fnLOG10);
