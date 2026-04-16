/** Contract: contracts/sheets-formula/rules.md */

import { type FormulaResult, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { toNumber, registerFunction } from './functions.ts';

/** Collect numeric values from args, skipping blanks/text/booleans (Excel range semantics) */
function collectNumbers(args: FormulaResult[]): number[] | FormulaResult {
  const nums: number[] = [];
  for (const arg of args) {
    if (isFormulaError(arg)) return arg;
    if (arg === null || arg === '') continue;
    if (typeof arg === 'string') continue;
    if (typeof arg === 'boolean') continue;
    const n = toNumber(arg);
    if (isFormulaError(n)) return n;
    nums.push(n);
  }
  return nums;
}

function fnMEDIAN(args: FormulaResult[]): FormulaResult {
  const nums = collectNumbers(args);
  if (isFormulaError(nums)) return nums as FormulaResult;
  const sorted = (nums as number[]).slice().sort((a, b) => a - b);
  if (sorted.length === 0) return makeError(FormulaErrorType.NUM, 'MEDIAN: no numeric values');
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function fnSTDEV(args: FormulaResult[]): FormulaResult {
  const nums = collectNumbers(args);
  if (isFormulaError(nums)) return nums as FormulaResult;
  const arr = nums as number[];
  if (arr.length < 2) return makeError(FormulaErrorType.DIV0, 'STDEV requires at least 2 values');
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const sumSqDev = arr.reduce((s, v) => s + (v - mean) ** 2, 0);
  return Math.sqrt(sumSqDev / (arr.length - 1));
}

function fnSTDEVP(args: FormulaResult[]): FormulaResult {
  const nums = collectNumbers(args);
  if (isFormulaError(nums)) return nums as FormulaResult;
  const arr = nums as number[];
  if (arr.length === 0) return makeError(FormulaErrorType.DIV0, 'STDEVP requires at least 1 value');
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const sumSqDev = arr.reduce((s, v) => s + (v - mean) ** 2, 0);
  return Math.sqrt(sumSqDev / arr.length);
}

function fnVAR(args: FormulaResult[]): FormulaResult {
  const nums = collectNumbers(args);
  if (isFormulaError(nums)) return nums as FormulaResult;
  const arr = nums as number[];
  if (arr.length < 2) return makeError(FormulaErrorType.DIV0, 'VAR requires at least 2 values');
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);
}

function fnVARP(args: FormulaResult[]): FormulaResult {
  const nums = collectNumbers(args);
  if (isFormulaError(nums)) return nums as FormulaResult;
  const arr = nums as number[];
  if (arr.length === 0) return makeError(FormulaErrorType.DIV0, 'VARP requires at least 1 value');
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
}

function fnLARGE(args: FormulaResult[]): FormulaResult {
  if (args.length < 2) return makeError(FormulaErrorType.VALUE, 'LARGE requires at least 2 arguments');
  const k = toNumber(args[args.length - 1]);
  if (isFormulaError(k)) return k;
  const nums = collectNumbers(args.slice(0, -1));
  if (isFormulaError(nums)) return nums as FormulaResult;
  const sorted = (nums as number[]).slice().sort((a, b) => b - a);
  const idx = Math.floor(k) - 1;
  if (idx < 0 || idx >= sorted.length) return makeError(FormulaErrorType.NUM, 'LARGE: k out of range');
  return sorted[idx];
}

function fnSMALL(args: FormulaResult[]): FormulaResult {
  if (args.length < 2) return makeError(FormulaErrorType.VALUE, 'SMALL requires at least 2 arguments');
  const k = toNumber(args[args.length - 1]);
  if (isFormulaError(k)) return k;
  const nums = collectNumbers(args.slice(0, -1));
  if (isFormulaError(nums)) return nums as FormulaResult;
  const sorted = (nums as number[]).slice().sort((a, b) => a - b);
  const idx = Math.floor(k) - 1;
  if (idx < 0 || idx >= sorted.length) return makeError(FormulaErrorType.NUM, 'SMALL: k out of range');
  return sorted[idx];
}

function fnCOUNTA(args: FormulaResult[]): FormulaResult {
  let count = 0;
  for (const arg of args) {
    if (arg !== null && arg !== '') count++;
  }
  return count;
}

function fnCOUNTBLANK(args: FormulaResult[]): FormulaResult {
  let count = 0;
  for (const arg of args) {
    if (arg === null || arg === '') count++;
  }
  return count;
}

function fnMODE(args: FormulaResult[]): FormulaResult {
  const nums = collectNumbers(args);
  if (isFormulaError(nums)) return nums as FormulaResult;
  const arr = nums as number[];
  if (arr.length === 0) return makeError(FormulaErrorType.NA, 'MODE: no numeric values');
  const freq = new Map<number, number>();
  for (const v of arr) freq.set(v, (freq.get(v) || 0) + 1);
  let maxFreq = 0;
  let mode = arr[0];
  for (const [val, count] of freq) {
    if (count > maxFreq) { maxFreq = count; mode = val; }
  }
  if (maxFreq <= 1) return makeError(FormulaErrorType.NA, 'MODE: no repeated values');
  return mode;
}

function fnPRODUCT(args: FormulaResult[]): FormulaResult {
  let result = 1;
  let hasNumber = false;
  for (const arg of args) {
    if (isFormulaError(arg)) return arg;
    if (arg === null || arg === '' || typeof arg === 'boolean') continue;
    const n = toNumber(arg);
    if (isFormulaError(n)) return n;
    result *= n;
    hasNumber = true;
  }
  return hasNumber ? result : 0;
}

registerFunction('MEDIAN', fnMEDIAN);
registerFunction('STDEV', fnSTDEV);
registerFunction('STDEVP', fnSTDEVP);
registerFunction('VAR', fnVAR);
registerFunction('VARP', fnVARP);
registerFunction('LARGE', fnLARGE);
registerFunction('SMALL', fnSMALL);
registerFunction('COUNTA', fnCOUNTA);
registerFunction('COUNTBLANK', fnCOUNTBLANK);
registerFunction('MODE', fnMODE);
registerFunction('PRODUCT', fnPRODUCT);
