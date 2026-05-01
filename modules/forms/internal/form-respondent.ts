/** Contract: contracts/forms/rules.md */

/**
 * Form Respondent — client entry point for /f/:formId.
 *
 * Loads the form definition, renders questions, validates client-side
 * (as UX courtesy — server enforces required/validation too), and POSTs
 * the response. No framework, pure DOM.
 *
 * Field renderers are in form-respondent-fields.ts.
 */

import type { FormDefinition, Question } from '../contract.ts';
import { buildInputElement } from './form-respondent-fields.ts';

type Answers = Record<string, unknown>;
type FieldErrors = Record<string, string>;

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function loadForm(id: string): Promise<FormDefinition | null> {
  const res = await fetch(`/api/forms/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<FormDefinition>;
}

async function submitResponse(
  formId: string,
  answers: Answers,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/forms/${encodeURIComponent(formId)}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  if (res.status === 410) return { ok: false, error: 'This form is closed.' };
  if (res.status === 401) return { ok: false, error: 'Sign in to submit this form.' };
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    return { ok: false, error: body.error ?? 'Submission failed. Please try again.' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Render question card
// ---------------------------------------------------------------------------

function renderQuestion(
  q: Question, errors: FieldErrors, answers: Answers, container: HTMLElement,
): void {
  const card = document.createElement('div');
  card.className = 'form-question-card';
  card.dataset.questionId = q.id;

  const labelEl = document.createElement('div');
  labelEl.className = 'form-question-label';
  labelEl.textContent = q.label;
  if (q.required) {
    const star = document.createElement('span');
    star.className = 'form-question-required-star';
    star.textContent = ' *';
    star.setAttribute('aria-label', 'required');
    labelEl.appendChild(star);
  }
  card.appendChild(labelEl);

  if (q.description) {
    const desc = document.createElement('p');
    desc.className = 'form-question-description';
    desc.textContent = q.description;
    card.appendChild(desc);
  }

  card.appendChild(buildInputElement(q, answers, (v) => { answers[q.id] = v; }));

  if (errors[q.id]) {
    const err = document.createElement('div');
    err.className = 'form-field-error';
    err.textContent = errors[q.id];
    card.appendChild(err);
  }

  container.appendChild(card);
}

// ---------------------------------------------------------------------------
// Render whole form
// ---------------------------------------------------------------------------

function renderForm(form: FormDefinition, container: HTMLElement): void {
  container.innerHTML = '';
  const outer = document.createElement('div');
  outer.className = 'form-respondent-outer';

  const header = document.createElement('div');
  header.className = 'form-header-card';
  const title = document.createElement('h1');
  title.className = 'form-header-title';
  title.textContent = form.title;
  header.appendChild(title);
  if (form.description) {
    const desc = document.createElement('p');
    desc.className = 'form-header-description';
    desc.textContent = form.description;
    header.appendChild(desc);
  }
  outer.appendChild(header);

  const answers: Answers = {};
  const errors: FieldErrors = {};

  const questionContainer = document.createElement('div');
  questionContainer.id = 'form-questions';
  for (const q of form.questions) {
    renderQuestion(q, errors, answers, questionContainer);
  }
  outer.appendChild(questionContainer);

  // Submit area
  const submitArea = document.createElement('div');
  submitArea.className = 'form-submit-area';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'form-submit-btn';
  submitBtn.textContent = 'Submit';

  const submitError = document.createElement('div');
  submitError.className = 'form-submit-error';
  submitError.hidden = true;

  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';
    submitError.hidden = true;
    const result = await submitResponse(form.id, answers);
    if (result.ok) {
      renderSuccess(container);
    } else {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
      submitError.textContent = result.error ?? 'Submission failed.';
      submitError.hidden = false;
    }
  });

  submitArea.append(submitBtn, submitError);
  outer.appendChild(submitArea);

  const footer = document.createElement('div');
  footer.className = 'form-respondent-footer';
  footer.textContent = 'Powered by ';
  const link = document.createElement('a');
  link.href = '/';
  link.textContent = 'OpenDesk';
  footer.appendChild(link);
  outer.appendChild(footer);

  container.appendChild(outer);
}

function renderSuccess(container: HTMLElement): void {
  container.innerHTML = '';
  const outer = document.createElement('div');
  outer.className = 'form-respondent-outer';
  const card = document.createElement('div');
  card.className = 'form-success-card';
  const icon = document.createElement('span');
  icon.className = 'form-success-icon';
  icon.textContent = '✓';
  const h = document.createElement('h2');
  h.className = 'form-success-title';
  h.textContent = 'Response submitted';
  const msg = document.createElement('p');
  msg.className = 'form-success-message';
  msg.textContent = 'Thank you! Your response has been recorded.';
  card.append(icon, h, msg);
  outer.appendChild(card);
  container.appendChild(outer);
}

function renderClosed(container: HTMLElement): void {
  container.innerHTML = '';
  const outer = document.createElement('div');
  outer.className = 'form-respondent-outer';
  const card = document.createElement('div');
  card.className = 'form-closed-card';
  const icon = document.createElement('span');
  icon.className = 'form-closed-icon';
  icon.textContent = '🔒';
  const h = document.createElement('h2');
  h.className = 'form-closed-title';
  h.textContent = 'This form is closed';
  const msg = document.createElement('p');
  msg.className = 'form-closed-message';
  msg.textContent = 'This form is no longer accepting responses.';
  card.append(icon, h, msg);
  outer.appendChild(card);
  container.appendChild(outer);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  const container = document.getElementById('form-respondent-root');
  if (!container) return;

  const segments = location.pathname.split('/').filter(Boolean);
  const fIdx = segments.indexOf('f');
  const formId = fIdx >= 0 ? segments[fIdx + 1] : segments[segments.length - 1];

  if (!formId) {
    container.innerHTML = '<div class="form-error">Form not found.</div>';
    return;
  }

  container.innerHTML = '<div class="form-loading">Loading form…</div>';

  try {
    const form = await loadForm(formId);
    if (!form) {
      container.innerHTML = '<div class="form-error">Form not found.</div>';
      return;
    }
    document.title = `${form.title} — OpenDesk Forms`;
    const isClosed = form.close_at !== null && new Date(form.close_at).getTime() <= Date.now();
    if (isClosed) { renderClosed(container); return; }
    renderForm(form, container);
  } catch (err) {
    console.error('[form-respondent] Init failed:', err);
    container.innerHTML = '<div class="form-error">Failed to load form. Please try again.</div>';
  }
}

document.addEventListener('DOMContentLoaded', init);
