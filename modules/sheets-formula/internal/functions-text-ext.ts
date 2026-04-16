/** Contract: contracts/sheets-formula/rules.md */

import { type FormulaResult, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { toString, toNumber, registerFunction } from './functions.ts';

function fnSUBSTITUTE(args: FormulaResult[]): FormulaResult {
  if (args.length < 3 || args.length > 4) {
    return makeError(FormulaErrorType.VALUE, 'SUBSTITUTE requires 3 or 4 arguments');
  }
  const text = toString(args[0]);
  if (isFormulaError(text)) return text;
  const oldText = toString(args[1]);
  if (isFormulaError(oldText)) return oldText;
  const newText = toString(args[2]);
  if (isFormulaError(newText)) return newText;

  if (args.length === 4) {
    const instance = toNumber(args[3]);
    if (isFormulaError(instance)) return instance;
    const n = Math.floor(instance);
    if (n < 1) return makeError(FormulaErrorType.VALUE, 'SUBSTITUTE: instance must be >= 1');
    let count = 0;
    let pos = 0;
    while (pos < text.length) {
      const idx = text.indexOf(oldText, pos);
      if (idx === -1) break;
      count++;
      if (count === n) return text.slice(0, idx) + newText + text.slice(idx + oldText.length);
      pos = idx + 1;
    }
    return text;
  }
  return text.split(oldText).join(newText);
}

function fnFIND(args: FormulaResult[]): FormulaResult {
  if (args.length < 2 || args.length > 3) {
    return makeError(FormulaErrorType.VALUE, 'FIND requires 2 or 3 arguments');
  }
  const findText = toString(args[0]);
  if (isFormulaError(findText)) return findText;
  const withinText = toString(args[1]);
  if (isFormulaError(withinText)) return withinText;
  const startNum = args.length === 3 ? toNumber(args[2]) : 1;
  if (isFormulaError(startNum)) return startNum;
  if (startNum < 1) return makeError(FormulaErrorType.VALUE, 'FIND: start_num must be >= 1');

  const idx = withinText.indexOf(findText, startNum - 1);
  if (idx === -1) return makeError(FormulaErrorType.VALUE, 'FIND: text not found');
  return idx + 1;
}

function fnSEARCH(args: FormulaResult[]): FormulaResult {
  if (args.length < 2 || args.length > 3) {
    return makeError(FormulaErrorType.VALUE, 'SEARCH requires 2 or 3 arguments');
  }
  const findText = toString(args[0]);
  if (isFormulaError(findText)) return findText;
  const withinText = toString(args[1]);
  if (isFormulaError(withinText)) return withinText;
  const startNum = args.length === 3 ? toNumber(args[2]) : 1;
  if (isFormulaError(startNum)) return startNum;
  if (startNum < 1) return makeError(FormulaErrorType.VALUE, 'SEARCH: start_num must be >= 1');

  // SEARCH is case-insensitive and supports * and ? wildcards
  const pattern = findText
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  const re = new RegExp(pattern, 'i');
  const sub = withinText.slice(startNum - 1);
  const match = re.exec(sub);
  if (!match) return makeError(FormulaErrorType.VALUE, 'SEARCH: text not found');
  return match.index + startNum;
}

function fnEXACT(args: FormulaResult[]): FormulaResult {
  if (args.length !== 2) return makeError(FormulaErrorType.VALUE, 'EXACT requires 2 arguments');
  const a = toString(args[0]);
  if (isFormulaError(a)) return a;
  const b = toString(args[1]);
  if (isFormulaError(b)) return b;
  return a === b;
}

function fnREPT(args: FormulaResult[]): FormulaResult {
  if (args.length !== 2) return makeError(FormulaErrorType.VALUE, 'REPT requires 2 arguments');
  const text = toString(args[0]);
  if (isFormulaError(text)) return text;
  const times = toNumber(args[1]);
  if (isFormulaError(times)) return times;
  if (times < 0) return makeError(FormulaErrorType.VALUE, 'REPT: times must be >= 0');
  return text.repeat(Math.floor(times));
}

function fnPROPER(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'PROPER requires 1 argument');
  const s = toString(args[0]);
  if (isFormulaError(s)) return s;
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function fnVALUE(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'VALUE requires 1 argument');
  const s = toString(args[0]);
  if (isFormulaError(s)) return s;
  const cleaned = s.replace(/[$,%]/g, '');
  const n = Number(cleaned);
  if (isNaN(n)) return makeError(FormulaErrorType.VALUE, `VALUE: cannot convert "${s}" to number`);
  return n;
}

function fnCHAR(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'CHAR requires 1 argument');
  const n = toNumber(args[0]);
  if (isFormulaError(n)) return n;
  const code = Math.floor(n);
  if (code < 1 || code > 65535) return makeError(FormulaErrorType.VALUE, 'CHAR: code must be 1-65535');
  return String.fromCharCode(code);
}

function fnCODE(args: FormulaResult[]): FormulaResult {
  if (args.length !== 1) return makeError(FormulaErrorType.VALUE, 'CODE requires 1 argument');
  const s = toString(args[0]);
  if (isFormulaError(s)) return s;
  if (s.length === 0) return makeError(FormulaErrorType.VALUE, 'CODE: empty string');
  return s.charCodeAt(0);
}

function fnREPLACE(args: FormulaResult[]): FormulaResult {
  if (args.length !== 4) return makeError(FormulaErrorType.VALUE, 'REPLACE requires 4 arguments');
  const oldText = toString(args[0]);
  if (isFormulaError(oldText)) return oldText;
  const startNum = toNumber(args[1]);
  if (isFormulaError(startNum)) return startNum;
  const numChars = toNumber(args[2]);
  if (isFormulaError(numChars)) return numChars;
  const newText = toString(args[3]);
  if (isFormulaError(newText)) return newText;
  const start = Math.floor(startNum) - 1;
  return oldText.slice(0, start) + newText + oldText.slice(start + Math.floor(numChars));
}

function fnTEXTJOIN(args: FormulaResult[]): FormulaResult {
  if (args.length < 3) return makeError(FormulaErrorType.VALUE, 'TEXTJOIN requires at least 3 arguments');
  const delimiter = toString(args[0]);
  if (isFormulaError(delimiter)) return delimiter;
  const ignoreEmpty = args[1] === true || args[1] === 1;
  const parts: string[] = [];
  for (let i = 2; i < args.length; i++) {
    const s = toString(args[i]);
    if (isFormulaError(s)) return s;
    if (ignoreEmpty && s === '') continue;
    parts.push(s);
  }
  return parts.join(delimiter);
}

registerFunction('SUBSTITUTE', fnSUBSTITUTE);
registerFunction('FIND', fnFIND);
registerFunction('SEARCH', fnSEARCH);
registerFunction('EXACT', fnEXACT);
registerFunction('REPT', fnREPT);
registerFunction('PROPER', fnPROPER);
registerFunction('VALUE', fnVALUE);
registerFunction('CHAR', fnCHAR);
registerFunction('CODE', fnCODE);
registerFunction('REPLACE', fnREPLACE);
registerFunction('TEXTJOIN', fnTEXTJOIN);
