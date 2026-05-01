/** Contract: contracts/forms/rules.md */

/**
 * Form Builder — client entry point for /form-builder/:id.
 *
 * State is a local FormDefinition object auto-saved with debounce.
 * Questions are managed by form-builder-question.ts,
 * sidebar by form-builder-sidebar.ts.
 */

import type { FormDefinition, Question, QuestionType } from '../contract.ts';
import { fetchForm, createForm, updateForm } from './form-builder-api.ts';
import { createQuestionCard, newQuestion } from './form-builder-question.ts';
import { buildSidebar } from './form-builder-sidebar.ts';

const SAVE_DELAY_MS = 800;

let formDef: FormDefinition | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let isSaving = false;

let titleInput: HTMLInputElement;
let questionList: HTMLElement;
let saveStatus: HTMLElement;
let shareLinkBtn: HTMLElement;

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, SAVE_DELAY_MS);
}

async function doSave() {
  if (!formDef || isSaving) return;
  isSaving = true;
  setSaveStatus('saving');
  try {
    formDef = await updateForm(formDef.id, {
      title: formDef.title, description: formDef.description,
      questions: formDef.questions, anonymous: formDef.anonymous,
      single_response: formDef.single_response, close_at: formDef.close_at,
    });
    setSaveStatus('saved');
  } catch {
    setSaveStatus('error');
  } finally {
    isSaving = false;
  }
}

function setSaveStatus(state: 'saving' | 'saved' | 'error') {
  if (!saveStatus) return;
  saveStatus.className = `form-builder-save-status ${state}`;
  saveStatus.textContent = { saving: 'Saving…', saved: 'Saved', error: 'Save failed' }[state] ?? '';
}

// ---------------------------------------------------------------------------
// Question management
// ---------------------------------------------------------------------------

function makeCardCallbacks(q: Question) {
  return {
    onChange: (updated: Question) => {
      if (!formDef) return;
      formDef = { ...formDef, questions: formDef.questions.map((qq) => qq.id === updated.id ? updated : qq) };
      scheduleSave();
      const el = questionList.querySelector(`[data-id="${updated.id}"]`);
      if (el) el.replaceWith(createQuestionCard(updated, makeCardCallbacks(updated)));
    },
    onDelete: (id: string) => {
      if (!formDef) return;
      formDef = { ...formDef, questions: formDef.questions.filter((qq) => qq.id !== id) };
      renderQuestions();
      scheduleSave();
    },
  };
}

function renderQuestions() {
  if (!questionList || !formDef) return;
  questionList.innerHTML = '';
  for (const q of formDef.questions) {
    questionList.appendChild(createQuestionCard(q, makeCardCallbacks(q)));
  }
}

function addQuestion(type: QuestionType) {
  if (!formDef) return;
  const q: Question = newQuestion(type);
  formDef = { ...formDef, questions: [...formDef.questions, q] };
  renderQuestions();
  scheduleSave();
  questionList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function buildToolbar(): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'form-builder-toolbar';

  titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'form-builder-title-input';
  titleInput.placeholder = 'Untitled Form';
  titleInput.addEventListener('input', () => {
    if (formDef) { formDef = { ...formDef, title: titleInput.value }; scheduleSave(); }
  });

  saveStatus = document.createElement('span');
  saveStatus.className = 'form-builder-save-status';

  const actions = document.createElement('div');
  actions.className = 'form-builder-toolbar-actions';

  shareLinkBtn = document.createElement('span');
  shareLinkBtn.className = 'btn btn-ghost';
  shareLinkBtn.style.cursor = 'pointer';
  shareLinkBtn.textContent = 'Copy link';
  shareLinkBtn.addEventListener('click', () => {
    if (!formDef) return;
    const url = `${location.origin}/f/${encodeURIComponent(formDef.id)}`;
    navigator.clipboard.writeText(url).then(() => {
      shareLinkBtn.textContent = 'Copied!';
      setTimeout(() => { shareLinkBtn.textContent = 'Copy link'; }, 2000);
    });
  });

  const previewBtn = document.createElement('a');
  previewBtn.className = 'btn btn-secondary';
  previewBtn.textContent = 'Preview';
  previewBtn.rel = 'noopener noreferrer';
  previewBtn.target = '_blank';
  (bar as HTMLElement & { _previewBtn?: HTMLAnchorElement })._previewBtn = previewBtn;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-ghost';
  closeBtn.textContent = 'Close form';
  closeBtn.addEventListener('click', async () => {
    if (!formDef || !confirm('Close this form? Respondents will no longer be able to submit.')) return;
    await updateForm(formDef.id, { closed: true });
    alert('Form closed.');
  });

  actions.append(shareLinkBtn, previewBtn, closeBtn);
  bar.append(titleInput, saveStatus, actions);
  return bar;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  const app = document.getElementById('form-builder-app');
  if (!app) return;

  const urlId = location.pathname.split('/').pop() || new URL(location.href).searchParams.get('id');

  const builder = document.createElement('div');
  builder.className = 'form-builder';

  const toolbar = buildToolbar();
  builder.appendChild(toolbar);

  questionList = document.createElement('div');
  questionList.className = 'form-builder-canvas';

  const sidebar = buildSidebar({
    onAddQuestion: addQuestion,
    getForm: () => formDef,
    onSettingChange: (key, value) => {
      if (formDef) { formDef = { ...formDef, [key]: value }; scheduleSave(); }
    },
  });

  builder.append(questionList, sidebar);
  app.appendChild(builder);

  try {
    formDef = (urlId && urlId !== 'new')
      ? await fetchForm(urlId)
      : await createForm('Untitled Form');

    if (urlId === 'new' || !urlId) {
      history.replaceState(null, '', `/form-builder/${formDef.id}`);
    }

    titleInput.value = formDef.title;
    document.title = `${formDef.title} — OpenDesk Forms`;

    const previewBtn = (toolbar as HTMLElement & { _previewBtn?: HTMLAnchorElement })._previewBtn;
    if (previewBtn) previewBtn.href = `/f/${encodeURIComponent(formDef.id)}`;

    renderQuestions();
    setSaveStatus('saved');
  } catch (err) {
    console.error('[form-builder] Init failed:', err);
    app.innerHTML = '<div class="form-error">Failed to load form. Please try again.</div>';
  }
}

document.addEventListener('DOMContentLoaded', init);
