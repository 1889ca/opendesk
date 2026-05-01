/** Contract: contracts/forms/rules.md */

// Use Web Crypto API — this module is bundled for the browser, not Node.js
import type { Question, QuestionType } from '../contract.ts';

// ---------------------------------------------------------------------------
// Question card DOM builder
// ---------------------------------------------------------------------------

export interface QuestionCardCallbacks {
  onChange: (q: Question) => void;
  onDelete: (id: string) => void;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  short_text: 'Short text',
  long_text: 'Long text',
  single_choice: 'Single choice',
  multi_choice: 'Multi choice',
  scale: 'Scale',
  date: 'Date',
  file_upload: 'File upload',
  email: 'Email',
  number: 'Number',
};

export function createQuestionCard(q: Question, cbs: QuestionCardCallbacks): HTMLElement {
  const card = document.createElement('div');
  card.className = 'form-question-card';
  card.dataset.id = q.id;

  // ── Header ──
  const header = document.createElement('div');
  header.className = 'form-question-card-header';

  const dragHandle = document.createElement('span');
  dragHandle.className = 'form-question-drag-handle';
  dragHandle.textContent = '⠿';
  dragHandle.setAttribute('aria-hidden', 'true');

  const badge = document.createElement('span');
  badge.className = 'form-question-type-badge';
  badge.textContent = TYPE_LABELS[q.type] ?? q.type;

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.className = 'form-question-label-input';
  labelInput.placeholder = 'Question label';
  labelInput.value = q.label;
  labelInput.addEventListener('input', () => {
    cbs.onChange({ ...q, label: labelInput.value });
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'form-question-delete-btn';
  deleteBtn.type = 'button';
  deleteBtn.setAttribute('aria-label', 'Delete question');
  deleteBtn.textContent = '✕';
  deleteBtn.addEventListener('click', () => cbs.onDelete(q.id));

  header.appendChild(dragHandle);
  header.appendChild(badge);
  header.appendChild(labelInput);
  header.appendChild(deleteBtn);
  card.appendChild(header);

  // ── Description ──
  const descInput = document.createElement('textarea');
  descInput.className = 'form-question-description-input';
  descInput.placeholder = 'Description (optional)';
  descInput.rows = 1;
  descInput.value = q.description ?? '';
  descInput.addEventListener('input', () => {
    cbs.onChange({ ...q, description: descInput.value || undefined });
  });
  card.appendChild(descInput);

  // ── Type-specific fields ──
  if (q.type === 'single_choice' || q.type === 'multi_choice') {
    card.appendChild(buildChoicesEditor(q, cbs));
  } else if (q.type === 'scale') {
    card.appendChild(buildScaleEditor(q, cbs));
  }

  // ── Footer: required toggle ──
  const footer = document.createElement('div');
  footer.className = 'form-question-footer';

  const reqLabel = document.createElement('label');
  reqLabel.className = 'form-required-toggle';

  const reqCheck = document.createElement('input');
  reqCheck.type = 'checkbox';
  reqCheck.checked = q.required;
  reqCheck.addEventListener('change', () => {
    cbs.onChange({ ...q, required: reqCheck.checked });
  });

  reqLabel.appendChild(reqCheck);
  reqLabel.appendChild(document.createTextNode(' Required'));
  footer.appendChild(reqLabel);
  card.appendChild(footer);

  return card;
}

function buildChoicesEditor(q: Question, cbs: QuestionCardCallbacks): HTMLElement {
  const choices = [...(q.choices ?? ['Option 1'])];

  const container = document.createElement('div');
  container.className = 'form-question-choices';

  function renderChoices() {
    container.innerHTML = '';
    choices.forEach((choice, idx) => {
      const row = document.createElement('div');
      row.className = 'form-choice-row';

      const bullet = document.createElement('span');
      bullet.className = 'form-choice-bullet';

      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'form-choice-input';
      inp.value = choice;
      inp.addEventListener('input', () => {
        choices[idx] = inp.value;
        cbs.onChange({ ...q, choices: [...choices] });
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'form-choice-remove-btn';
      removeBtn.setAttribute('aria-label', 'Remove choice');
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        choices.splice(idx, 1);
        cbs.onChange({ ...q, choices: [...choices] });
        renderChoices();
      });

      row.appendChild(bullet);
      row.appendChild(inp);
      row.appendChild(removeBtn);
      container.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'form-add-choice-btn';
    addBtn.textContent = '+ Add option';
    addBtn.addEventListener('click', () => {
      choices.push(`Option ${choices.length + 1}`);
      cbs.onChange({ ...q, choices: [...choices] });
      renderChoices();
    });
    container.appendChild(addBtn);
  }

  renderChoices();
  return container;
}

function buildScaleEditor(q: Question, cbs: QuestionCardCallbacks): HTMLElement {
  const wrapper = document.createElement('div');

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '0.5rem';
  row.style.alignItems = 'center';
  row.style.fontSize = '0.8125rem';

  const minLabel = document.createElement('label');
  minLabel.textContent = 'Min: ';

  const minInp = document.createElement('input');
  minInp.type = 'number';
  minInp.value = String(q.min ?? 1);
  minInp.style.width = '4rem';
  minInp.addEventListener('change', () => {
    cbs.onChange({ ...q, min: Number(minInp.value) });
  });

  const maxLabel = document.createElement('label');
  maxLabel.textContent = ' Max: ';
  maxLabel.style.marginLeft = '0.75rem';

  const maxInp = document.createElement('input');
  maxInp.type = 'number';
  maxInp.value = String(q.max ?? 5);
  maxInp.style.width = '4rem';
  maxInp.addEventListener('change', () => {
    cbs.onChange({ ...q, max: Number(maxInp.value) });
  });

  minLabel.appendChild(minInp);
  maxLabel.appendChild(maxInp);
  row.appendChild(minLabel);
  row.appendChild(maxLabel);
  wrapper.appendChild(row);

  return wrapper;
}

// ---------------------------------------------------------------------------
// New question factory
// ---------------------------------------------------------------------------

export function newQuestion(type: QuestionType): Question {
  const base = {
    id: globalThis.crypto.randomUUID(),
    type,
    label: TYPE_LABELS[type],
    required: false,
  };

  if (type === 'single_choice' || type === 'multi_choice') {
    return { ...base, choices: ['Option 1', 'Option 2'] };
  }
  if (type === 'scale') {
    return { ...base, min: 1, max: 5 };
  }
  return base;
}
