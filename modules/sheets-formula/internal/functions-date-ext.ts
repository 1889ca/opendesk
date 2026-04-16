/** Contract: contracts/sheets-formula/rules.md */

import { type FormulaResult, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { toNumber, registerFunction } from './functions.ts';

const EXCEL_EPOCH = new Date(1899, 11, 30).getTime();
const MS_PER_DAY = 86400000;

/** Convert Excel serial date number to JS Date */
function serialToDate(serial: number): Date {
  return new Date(EXCEL_EPOCH + serial * MS_PER_DAY);
}

/** Convert JS Date to Excel serial date number */
function dateToSerial(date: Date): number {
  return Math.floor((date.getTime() - EXCEL_EPOCH) / MS_PER_DAY);
}

function fnYEAR(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'YEAR requires 1 argument');
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  return serialToDate(n).getFullYear();
}

function fnMONTH(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'MONTH requires 1 argument');
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  return serialToDate(n).getMonth() + 1;
}

function fnDAY(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'DAY requires 1 argument');
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  return serialToDate(n).getDate();
}

function fnHOUR(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'HOUR requires 1 argument');
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  const fractional = n - Math.floor(n);
  const totalMinutes = Math.round(fractional * 24 * 60);
  return Math.floor(totalMinutes / 60) % 24;
}

function fnMINUTE(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'MINUTE requires 1 argument');
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  const fractional = n - Math.floor(n);
  const totalMinutes = Math.round(fractional * 24 * 60);
  return totalMinutes % 60;
}

function fnSECOND(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'SECOND requires 1 argument');
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  const fractional = n - Math.floor(n);
  const totalSeconds = Math.round(fractional * 24 * 60 * 60);
  return totalSeconds % 60;
}

function fnWEEKDAY(args: FormulaResult[]): FormulaResult {
  if (args.length < 1 || args.length > 2) {
    return makeError(FormulaErrorType.VALUE, 'WEEKDAY requires 1 or 2 arguments');
  }
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  const returnType = args.length === 2 ? toNumber(args[1]) : 1;
  if (isFormulaError(returnType)) return returnType;

  const d = serialToDate(n);
  const jsDay = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  switch (Math.floor(returnType)) {
    case 1: return jsDay + 1;          // 1=Sun, 7=Sat (Excel default)
    case 2: return jsDay === 0 ? 7 : jsDay; // 1=Mon, 7=Sun
    case 3: return jsDay === 0 ? 6 : jsDay - 1; // 0=Mon, 6=Sun
    default: return makeError(FormulaErrorType.NUM, 'WEEKDAY: return_type must be 1, 2, or 3');
  }
}

function fnEOMONTH(args: FormulaResult[]): FormulaResult {
  if (args.length !== 2) return makeError(FormulaErrorType.VALUE, 'EOMONTH requires 2 arguments');
  const startDate = toNumber(args[0]);
  if (isFormulaError(startDate)) return startDate;
  const months = toNumber(args[1]);
  if (isFormulaError(months)) return months;

  const d = serialToDate(startDate);
  // Move to the target month, then get last day of that month
  const target = new Date(d.getFullYear(), d.getMonth() + Math.floor(months) + 1, 0);
  return dateToSerial(target);
}

function fnEDATE(args: FormulaResult[]): FormulaResult {
  if (args.length !== 2) return makeError(FormulaErrorType.VALUE, 'EDATE requires 2 arguments');
  const startDate = toNumber(args[0]);
  if (isFormulaError(startDate)) return startDate;
  const months = toNumber(args[1]);
  if (isFormulaError(months)) return months;

  const d = serialToDate(startDate);
  const target = new Date(d.getFullYear(), d.getMonth() + Math.floor(months), d.getDate());
  return dateToSerial(target);
}

function fnTIME(args: FormulaResult[]): FormulaResult {
  if (args.length !== 3) return makeError(FormulaErrorType.VALUE, 'TIME requires 3 arguments');
  const hour = toNumber(args[0]);
  if (isFormulaError(hour)) return hour;
  const minute = toNumber(args[1]);
  if (isFormulaError(minute)) return minute;
  const second = toNumber(args[2]);
  if (isFormulaError(second)) return second;
  return (Math.floor(hour) * 3600 + Math.floor(minute) * 60 + Math.floor(second)) / 86400;
}

registerFunction('YEAR', fnYEAR);
registerFunction('MONTH', fnMONTH);
registerFunction('DAY', fnDAY);
registerFunction('HOUR', fnHOUR);
registerFunction('MINUTE', fnMINUTE);
registerFunction('SECOND', fnSECOND);
registerFunction('WEEKDAY', fnWEEKDAY);
registerFunction('EOMONTH', fnEOMONTH);
registerFunction('EDATE', fnEDATE);
registerFunction('TIME', fnTIME);
