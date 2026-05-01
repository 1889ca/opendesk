/** Contract: contracts/forms/rules.md */

import type { FormDefinition, Question } from '../contract.ts';

export interface ValidationError {
  questionId: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

/**
 * Validate a response's answers against the current FormDefinition.
 *
 * Enforces:
 *  - Required fields must be present and non-empty
 *  - Choice answers must be one of the declared options
 *  - Scale answers must be within [min, max]
 *  - Regex validation uses only RE2-safe patterns (no lookaheads/lookbehinds)
 */
export function validateResponse(
  definition: FormDefinition,
  answers: Record<string, unknown>,
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const q of definition.questions) {
    const answer = answers[q.id];
    const isEmpty = answer === undefined || answer === null || answer === '';

    if (q.required && isEmpty) {
      errors.push({ questionId: q.id, message: `Question "${q.label}" is required.` });
      continue;
    }

    if (isEmpty) continue; // Optional and empty — skip further checks

    const err = validateAnswer(q, answer);
    if (err) errors.push({ questionId: q.id, message: err });
  }

  return { ok: errors.length === 0, errors };
}

function validateAnswer(q: Question, answer: unknown): string | null {
  switch (q.type) {
    case 'short_text':
    case 'long_text':
    case 'email':
      return validateText(q, answer);

    case 'number':
      return validateNumber(q, answer);

    case 'scale':
      return validateScale(q, answer);

    case 'single_choice':
      return validateSingleChoice(q, answer);

    case 'multi_choice':
      return validateMultiChoice(q, answer);

    case 'date':
      return validateDate(answer);

    case 'file_upload':
      // file_upload answers are S3 object references (strings) — presence is
      // validated by the route handler; here we just check it's a string.
      return typeof answer === 'string' ? null : 'Expected an S3 object key string.';

    default:
      return null;
  }
}

function validateText(q: Question, answer: unknown): string | null {
  if (typeof answer !== 'string') return 'Expected a text answer.';

  if (q.min !== undefined && answer.length < q.min) {
    return `Answer must be at least ${q.min} characters.`;
  }
  if (q.max !== undefined && answer.length > q.max) {
    return `Answer must be at most ${q.max} characters.`;
  }
  if (q.regex) {
    // RE2-safe: reject patterns with lookaheads/lookbehinds/backreferences
    if (/\(\?[<=!]|\(\?<[!=]|\\[1-9]/.test(q.regex)) {
      return 'Invalid regex pattern (advanced features not permitted).';
    }
    try {
      const re = new RegExp(q.regex);
      if (!re.test(answer)) return 'Answer does not match the required pattern.';
    } catch {
      return 'Invalid regex pattern.';
    }
  }
  return null;
}

function validateNumber(q: Question, answer: unknown): string | null {
  const n = Number(answer);
  if (Number.isNaN(n)) return 'Expected a numeric answer.';
  if (q.min !== undefined && n < q.min) return `Value must be at least ${q.min}.`;
  if (q.max !== undefined && n > q.max) return `Value must be at most ${q.max}.`;
  return null;
}

function validateScale(q: Question, answer: unknown): string | null {
  const n = Number(answer);
  if (Number.isNaN(n) || !Number.isInteger(n)) return 'Expected an integer scale value.';
  const min = q.min ?? 1;
  const max = q.max ?? 5;
  if (n < min || n > max) return `Scale value must be between ${min} and ${max}.`;
  return null;
}

function validateSingleChoice(q: Question, answer: unknown): string | null {
  if (typeof answer !== 'string') return 'Expected a single choice answer.';
  if (q.choices && !q.choices.includes(answer)) {
    return `"${answer}" is not a valid choice.`;
  }
  return null;
}

function validateMultiChoice(q: Question, answer: unknown): string | null {
  if (!Array.isArray(answer)) return 'Expected an array of choices.';
  if (q.choices) {
    for (const a of answer) {
      if (typeof a !== 'string' || !q.choices.includes(a)) {
        return `"${a}" is not a valid choice.`;
      }
    }
  }
  return null;
}

function validateDate(answer: unknown): string | null {
  if (typeof answer !== 'string') return 'Expected a date string.';
  const d = Date.parse(answer);
  if (Number.isNaN(d)) return 'Invalid date format.';
  return null;
}
