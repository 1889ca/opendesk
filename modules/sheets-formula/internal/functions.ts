/** Contract: contracts/sheets-formula/rules.md */

import { type FormulaError, type FormulaResult, type CellValue, FormulaErrorType, makeError, isFormulaError } from './types.ts';

export type FormulaFunction = (args: FormulaResult[]) => FormulaResult;

/** Coerce a value to number (Excel semantics: true=1, false=0, null=0, string->parse) */
export function toNumber(val: FormulaResult): number | FormulaError {
  if (isFormulaError(val)) return val;
  if (val === null) return 0;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'number') return val;
  const n = Number(val);
  if (isNaN(n)) return makeError(FormulaErrorType.VALUE, `Cannot convert "${val}" to number`);
  return n;
}

/** Coerce a value to string (Excel semantics) */
export function toString(val: FormulaResult): string | FormulaError {
  if (isFormulaError(val)) return val;
  if (val === null) return '';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  return String(val);
}

/** Flatten args: if an arg is an array (from range expansion), flatten it */
function collectNumbers(args: FormulaResult[]): number[] | FormulaError {
  const nums: number[] = [];
  for (const arg of args) {
    if (isFormulaError(arg)) return arg;
    if (arg === null || arg === '') continue; // skip empty
    if (typeof arg === 'string') continue;    // SUM ignores non-numeric strings in ranges
    if (typeof arg === 'boolean') continue;   // SUM ignores booleans in ranges
    const n = toNumber(arg);
    if (isFormulaError(n)) return n;
    nums.push(n);
  }
  return nums;
}

function fnSUM(args: FormulaResult[]): FormulaResult {
  const nums = collectNumbers(args);
  if (isFormulaError(nums)) return nums;
  return nums.reduce((a, b) => a + b, 0);
}

function fnAVERAGE(args: FormulaResult[]): FormulaResult {
  const nums = collectNumbers(args);
  if (isFormulaError(nums)) return nums;
  if (nums.length === 0) return makeError(FormulaErrorType.DIV0, 'AVERAGE of empty set');
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function fnCOUNT(args: FormulaResult[]): FormulaResult {
  let count = 0;
  for (const arg of args) {
    if (isFormulaError(arg)) continue;
    if (typeof arg === 'number') count++;
  }
  return count;
}

function fnMIN(args: FormulaResult[]): FormulaResult {
  const nums = collectNumbers(args);
  if (isFormulaError(nums)) return nums;
  if (nums.length === 0) return 0;
  return Math.min(...nums);
}

function fnMAX(args: FormulaResult[]): FormulaResult {
  const nums = collectNumbers(args);
  if (isFormulaError(nums)) return nums;
  if (nums.length === 0) return 0;
  return Math.max(...nums);
}

function fnIF(args: FormulaResult[]): FormulaResult {
  if (args.length < 2 || args.length > 3) {
    return makeError(FormulaErrorType.VALUE, 'IF requires 2 or 3 arguments');
  }
  const cond = args[0];
  if (isFormulaError(cond)) return cond;
  const truthy = cond !== 0 && cond !== false && cond !== null && cond !== '';
  if (truthy) return args[1];
  return args.length === 3 ? args[2] : false;
}

function fnROUND(args: FormulaResult[]): FormulaResult {
  if (args.length !== 2) return makeError(FormulaErrorType.VALUE, 'ROUND requires 2 arguments');
  const num = toNumber(args[0]);
  if (isFormulaError(num)) return num;
  const digits = toNumber(args[1]);
  if (isFormulaError(digits)) return digits;
  const factor = Math.pow(10, digits);
  return Math.round(num * factor) / factor;
}

function fnABS(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'ABS requires 1 argument');
  const num = toNumber(args[0]);
  if (isFormulaError(num)) return num;
  return Math.abs(num);
}

function fnCONCATENATE(args: FormulaResult[]): FormulaResult {
  const parts: string[] = [];
  for (const arg of args) {
    const s = toString(arg);
    if (isFormulaError(s)) return s;
    parts.push(s);
  }
  return parts.join('');
}

function fnNOW(_args: FormulaResult[]): FormulaResult {
  // Returns Excel serial date number for current datetime
  const now = new Date();
  return excelSerialDate(now);
}

function fnTODAY(_args: FormulaResult[]): FormulaResult {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(excelSerialDate(today));
}

function excelSerialDate(date: Date): number {
  // Excel epoch is January 1, 1900 (with the Lotus 1-2-3 leap year bug)
  const excelEpoch = new Date(1899, 11, 30);
  const msPerDay = 86400000;
  return (date.getTime() - excelEpoch.getTime()) / msPerDay;
}

// --- Function registry ---

const registry = new Map<string, FormulaFunction>();

export function registerFunction(name: string, fn: FormulaFunction): void {
  registry.set(name.toUpperCase(), fn);
}

export function getFunction(name: string): FormulaFunction | undefined {
  return registry.get(name.toUpperCase());
}

// Register built-in math/logic functions
registerFunction('SUM', fnSUM);
registerFunction('AVERAGE', fnAVERAGE);
registerFunction('COUNT', fnCOUNT);
registerFunction('MIN', fnMIN);
registerFunction('MAX', fnMAX);
registerFunction('IF', fnIF);
registerFunction('ROUND', fnROUND);
registerFunction('ABS', fnABS);
registerFunction('CONCATENATE', fnCONCATENATE);
registerFunction('NOW', fnNOW);
registerFunction('TODAY', fnTODAY);
