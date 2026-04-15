/** Contract: contracts/sheets-formula/rules.md */

import { type FormulaResult, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { toNumber, toString, registerFunction } from './functions.ts';

/** INDEX(range, row, [col]) — returns value from range at given 1-based row/col */
function fnINDEX(args: FormulaResult[]): FormulaResult {
  // Range is already expanded to flat array by evaluator; we get values as args[0..n-2],
  // but INDEX needs special evaluator support to know the range shape.
  // This stub handles the case where INDEX is called with pre-flattened args
  // (single-column range, col omitted).
  if (args.length < 2 || args.length > 3) {
    return makeError(FormulaErrorType.VALUE, 'INDEX requires 2 or 3 arguments');
  }
  // Args arrive as: [value_at_pos_0, value_at_pos_1, ..., row_num, (col_num)]
  // We cannot distinguish range values from row/col here — INDEX is special-cased in evaluator.
  return makeError(FormulaErrorType.VALUE, 'INDEX requires range argument (handled by evaluator)');
}

/** MATCH(value, range, [type]) — returns 1-based position of value in range */
function fnMATCH(args: FormulaResult[]): FormulaResult {
  return makeError(FormulaErrorType.VALUE, 'MATCH requires range argument (handled by evaluator)');
}

/** DATE(year, month, day) — returns Excel serial date */
function fnDATE(args: FormulaResult[]): FormulaResult {
  if (args.length !== 3) return makeError(FormulaErrorType.VALUE, 'DATE requires 3 arguments');
  const year = toNumber(args[0]);
  if (isFormulaError(year)) return year;
  const month = toNumber(args[1]);
  if (isFormulaError(month)) return month;
  const day = toNumber(args[2]);
  if (isFormulaError(day)) return day;
  const date = new Date(Math.floor(year), Math.floor(month) - 1, Math.floor(day));
  const excelEpoch = new Date(1899, 11, 30);
  return Math.floor((date.getTime() - excelEpoch.getTime()) / 86400000);
}

/** DATEDIF(start, end, unit) — difference between two dates */
function fnDATEDIF(args: FormulaResult[]): FormulaResult {
  if (args.length !== 3) return makeError(FormulaErrorType.VALUE, 'DATEDIF requires 3 arguments');
  const start = toNumber(args[0]);
  if (isFormulaError(start)) return start;
  const end = toNumber(args[1]);
  if (isFormulaError(end)) return end;
  const unit = toString(args[2]);
  if (isFormulaError(unit)) return unit;

  const excelEpoch = new Date(1899, 11, 30).getTime();
  const msPerDay = 86400000;
  const d1 = new Date(excelEpoch + start * msPerDay);
  const d2 = new Date(excelEpoch + end * msPerDay);

  if (d2 < d1) return makeError(FormulaErrorType.NUM, 'DATEDIF: end must be >= start');

  switch (unit.toUpperCase()) {
    case 'D': return Math.floor((d2.getTime() - d1.getTime()) / msPerDay);
    case 'M': {
      let months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      if (d2.getDate() < d1.getDate()) months--;
      return months;
    }
    case 'Y': {
      let years = d2.getFullYear() - d1.getFullYear();
      const beforeAnniversary = d2.getMonth() < d1.getMonth() ||
        (d2.getMonth() === d1.getMonth() && d2.getDate() < d1.getDate());
      if (beforeAnniversary) years--;
      return years;
    }
    case 'MD': {
      let days = d2.getDate() - d1.getDate();
      if (days < 0) {
        const prevMonth = new Date(d2.getFullYear(), d2.getMonth(), 0);
        days += prevMonth.getDate();
      }
      return days;
    }
    case 'YM': {
      let months = d2.getMonth() - d1.getMonth();
      if (months < 0) months += 12;
      if (d2.getDate() < d1.getDate()) months--;
      if (months < 0) months += 12;
      return months;
    }
    case 'YD': {
      const d1SameYear = new Date(d2.getFullYear(), d1.getMonth(), d1.getDate());
      if (d1SameYear > d2) d1SameYear.setFullYear(d2.getFullYear() - 1);
      return Math.floor((d2.getTime() - d1SameYear.getTime()) / msPerDay);
    }
    default: return makeError(FormulaErrorType.VALUE, `DATEDIF: unknown unit "${unit}"`);
  }
}

/** FLOOR(n, [significance]) — round down to nearest multiple */
function fnFLOOR(args: FormulaResult[]): FormulaResult {
  if (args.length < 1 || args.length > 2) {
    return makeError(FormulaErrorType.VALUE, 'FLOOR requires 1 or 2 arguments');
  }
  const num = toNumber(args[0]);
  if (isFormulaError(num)) return num;
  if (args.length === 1) return Math.floor(num);
  const sig = toNumber(args[1]);
  if (isFormulaError(sig)) return sig;
  if (sig === 0) return makeError(FormulaErrorType.DIV0, 'FLOOR: significance cannot be 0');
  return Math.floor(num / sig) * sig;
}

/** CEILING(n, [significance]) — round up to nearest multiple */
function fnCEILING(args: FormulaResult[]): FormulaResult {
  if (args.length < 1 || args.length > 2) {
    return makeError(FormulaErrorType.VALUE, 'CEILING requires 1 or 2 arguments');
  }
  const num = toNumber(args[0]);
  if (isFormulaError(num)) return num;
  if (args.length === 1) return Math.ceil(num);
  const sig = toNumber(args[1]);
  if (isFormulaError(sig)) return sig;
  if (sig === 0) return makeError(FormulaErrorType.DIV0, 'CEILING: significance cannot be 0');
  return Math.ceil(num / sig) * sig;
}

/** CONCAT(...) — alias for CONCATENATE */
function fnCONCAT(args: FormulaResult[]): FormulaResult {
  const parts: string[] = [];
  for (const arg of args) {
    const s = toString(arg);
    if (isFormulaError(s)) return s;
    parts.push(s);
  }
  return parts.join('');
}

registerFunction('DATE', fnDATE);
registerFunction('DATEDIF', fnDATEDIF);
registerFunction('FLOOR', fnFLOOR);
registerFunction('CEILING', fnCEILING);
registerFunction('CONCAT', fnCONCAT);
// INDEX and MATCH are special-cased in evaluator; register stubs so #NAME? is not thrown
registerFunction('INDEX', fnINDEX);
registerFunction('MATCH', fnMATCH);
