/** Contract: contracts/sheets-formula/rules.md */

import { type FormulaResult, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { toNumber, registerFunction } from './functions.ts';

function parseTVM(args: FormulaResult[], name: string, minArgs: number, maxArgs: number) {
  if (args.length < minArgs || args.length > maxArgs) {
    return makeError(FormulaErrorType.VALUE, `${name} requires ${minArgs} to ${maxArgs} arguments`);
  }
  const nums: number[] = [];
  for (let i = 0; i < args.length; i++) {
    const n = toNumber(args[i]);
    if (isFormulaError(n)) return n;
    nums.push(n);
  }
  return nums;
}

function fnPMT(args: FormulaResult[]): FormulaResult {
  const r = parseTVM(args, 'PMT', 3, 5);
  if (!Array.isArray(r)) return r;
  const [rate, nper, pv, fv = 0, type = 0] = r;
  if (nper === 0) return makeError(FormulaErrorType.NUM, 'PMT: nper cannot be 0');
  if (rate === 0) return -(pv + fv) / nper;
  const pvif = Math.pow(1 + rate, nper);
  return -(pv * pvif + fv) / ((1 + rate * (type ? 1 : 0)) * ((pvif - 1) / rate));
}

function fnFV(args: FormulaResult[]): FormulaResult {
  const r = parseTVM(args, 'FV', 3, 5);
  if (!Array.isArray(r)) return r;
  const [rate, nper, pmt, pv = 0, type = 0] = r;
  if (rate === 0) return -(pv + pmt * nper);
  const pvif = Math.pow(1 + rate, nper);
  return -(pv * pvif + pmt * (1 + rate * (type ? 1 : 0)) * ((pvif - 1) / rate));
}

function fnPV(args: FormulaResult[]): FormulaResult {
  const r = parseTVM(args, 'PV', 3, 5);
  if (!Array.isArray(r)) return r;
  const [rate, nper, pmt, fv = 0, type = 0] = r;
  if (rate === 0) return -(fv + pmt * nper);
  const pvif = Math.pow(1 + rate, nper);
  return -(fv + pmt * (1 + rate * (type ? 1 : 0)) * ((pvif - 1) / rate)) / pvif;
}

function fnNPER(args: FormulaResult[]): FormulaResult {
  const r = parseTVM(args, 'NPER', 3, 5);
  if (!Array.isArray(r)) return r;
  const [rate, pmt, pv, fv = 0, type = 0] = r;
  if (rate === 0) {
    if (pmt === 0) return makeError(FormulaErrorType.NUM, 'NPER: pmt cannot be 0 when rate is 0');
    return -(pv + fv) / pmt;
  }
  const z = pmt * (1 + rate * (type ? 1 : 0)) / rate;
  const num = -fv + z;
  const denom = pv + z;
  if (denom === 0 || num / denom <= 0) {
    return makeError(FormulaErrorType.NUM, 'NPER: invalid arguments');
  }
  return Math.log(num / denom) / Math.log(1 + rate);
}

function fnNPV(args: FormulaResult[]): FormulaResult {
  if (args.length < 2) return makeError(FormulaErrorType.VALUE, 'NPV requires at least 2 arguments');
  const rate = toNumber(args[0]);
  if (isFormulaError(rate)) return rate;
  let npv = 0;
  for (let i = 1; i < args.length; i++) {
    if (isFormulaError(args[i])) return args[i];
    if (args[i] === null || args[i] === '') continue;
    const val = toNumber(args[i]);
    if (isFormulaError(val)) return val;
    npv += val / Math.pow(1 + rate, i);
  }
  return npv;
}

function fnIRR(args: FormulaResult[]): FormulaResult {
  if (args.length < 1) return makeError(FormulaErrorType.VALUE, 'IRR requires at least 1 argument');
  const values: number[] = [];
  const lastArg = args[args.length - 1];
  const hasGuess = args.length >= 2 && typeof lastArg === 'number' && Math.abs(lastArg) < 10;
  const cashFlowArgs = hasGuess ? args.slice(0, -1) : args;
  for (const arg of cashFlowArgs) {
    if (isFormulaError(arg)) return arg;
    if (arg === null || arg === '') continue;
    const n = toNumber(arg);
    if (isFormulaError(n)) return n;
    values.push(n);
  }
  if (values.length < 2) return makeError(FormulaErrorType.NUM, 'IRR requires at least 2 cash flows');
  if (!values.some(v => v > 0) || !values.some(v => v < 0)) {
    return makeError(FormulaErrorType.NUM, 'IRR requires both positive and negative cash flows');
  }
  let rate = (hasGuess ? toNumber(lastArg) : 0.1) as number;
  if (isFormulaError(rate)) rate = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0, dnpv = 0;
    for (let i = 0; i < values.length; i++) {
      npv += values[i] / Math.pow(1 + rate, i);
      if (i > 0) dnpv -= i * values[i] / Math.pow(1 + rate, i + 1);
    }
    if (Math.abs(npv) < 1e-10) return rate;
    if (dnpv === 0) return makeError(FormulaErrorType.NUM, 'IRR: failed to converge');
    rate = rate - npv / dnpv;
    if (!isFinite(rate)) return makeError(FormulaErrorType.NUM, 'IRR: failed to converge');
  }
  return makeError(FormulaErrorType.NUM, 'IRR: failed to converge');
}

function rateF(rate: number, nper: number, pmt: number, pv: number, fv: number, type: number): number {
  if (Math.abs(rate) < 1e-10) return pv + pmt * nper + fv;
  const pvif = Math.pow(1 + rate, nper);
  return pv * pvif + pmt * (1 + rate * (type ? 1 : 0)) * ((pvif - 1) / rate) + fv;
}

function fnRATE(args: FormulaResult[]): FormulaResult {
  const r = parseTVM(args, 'RATE', 3, 6);
  if (!Array.isArray(r)) return r;
  const [nper, pmt, pv, fv = 0, type = 0, guess = 0.1] = r;
  let lo = -0.99, hi = 10.0, mid = guess;
  const fLo = rateF(lo, nper, pmt, pv, fv, type);
  const fHi = rateF(hi, nper, pmt, pv, fv, type);
  if (fLo * fHi > 0) return makeError(FormulaErrorType.NUM, 'RATE: no solution in range');
  for (let iter = 0; iter < 200; iter++) {
    const fMid = rateF(mid, nper, pmt, pv, fv, type);
    if (Math.abs(fMid) < 1e-10) return mid;
    if (fMid * rateF(lo, nper, pmt, pv, fv, type) < 0) hi = mid;
    else lo = mid;
    mid = (lo + hi) / 2;
  }
  return mid;
}

registerFunction('PMT', fnPMT);
registerFunction('FV', fnFV);
registerFunction('PV', fnPV);
registerFunction('NPER', fnNPER);
registerFunction('NPV', fnNPV);
registerFunction('IRR', fnIRR);
registerFunction('RATE', fnRATE);
