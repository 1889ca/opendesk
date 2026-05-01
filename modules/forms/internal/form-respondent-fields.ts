/** Contract: contracts/forms/rules.md */

import type { Question } from '../contract.ts';

type Answers = Record<string, unknown>;

/**
 * Build an input element for a given question type.
 * Calls onChange whenever the user's answer changes.
 */
export function buildInputElement(
  q: Question,
  answers: Answers,
  onChange: (v: unknown) => void,
): HTMLElement {
  const current = answers[q.id];

  switch (q.type) {
    case 'short_text':
    case 'email': {
      const inp = document.createElement('input');
      inp.type = q.type === 'email' ? 'email' : 'text';
      inp.className = `form-input-short form-input-${q.type}`;
      inp.id = `q_${q.id}`;
      inp.value = (current as string) ?? '';
      if (q.max) inp.maxLength = q.max;
      inp.addEventListener('input', () => onChange(inp.value));
      return inp;
    }
    case 'long_text': {
      const ta = document.createElement('textarea');
      ta.className = 'form-input-long';
      ta.id = `q_${q.id}`;
      ta.value = (current as string) ?? '';
      if (q.max) ta.maxLength = q.max;
      ta.addEventListener('input', () => onChange(ta.value));
      return ta;
    }
    case 'number': {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'form-input-number';
      inp.value = current !== undefined ? String(current) : '';
      if (q.min !== undefined) inp.min = String(q.min);
      if (q.max !== undefined) inp.max = String(q.max);
      inp.addEventListener('input', () => onChange(inp.value === '' ? '' : Number(inp.value)));
      return inp;
    }
    case 'date': {
      const inp = document.createElement('input');
      inp.type = 'date';
      inp.className = 'form-input-date';
      inp.value = (current as string) ?? '';
      inp.addEventListener('change', () => onChange(inp.value));
      return inp;
    }
    case 'single_choice': {
      return buildSingleChoice(q, current as string, onChange);
    }
    case 'multi_choice': {
      return buildMultiChoice(q, current as string[], onChange);
    }
    case 'scale': {
      return buildScale(q, current as number | undefined, onChange);
    }
    case 'file_upload': {
      return buildFileUpload(q, onChange);
    }
    default: {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'form-input-short';
      inp.addEventListener('input', () => onChange((inp as HTMLInputElement).value));
      return inp;
    }
  }
}

function buildSingleChoice(q: Question, current: string, onChange: (v: unknown) => void): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'form-choice-list';
  list.setAttribute('role', 'radiogroup');
  (q.choices ?? []).forEach((choice, i) => {
    const li = document.createElement('li');
    li.className = 'form-choice-option';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `q_${q.id}`;
    radio.id = `q_${q.id}_${i}`;
    radio.value = choice;
    radio.checked = current === choice;
    radio.addEventListener('change', () => onChange(radio.value));
    const lbl = document.createElement('label');
    lbl.htmlFor = radio.id;
    lbl.textContent = choice;
    li.append(radio, lbl);
    list.appendChild(li);
  });
  return list;
}

function buildMultiChoice(q: Question, current: string[], onChange: (v: unknown) => void): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'form-choice-list';
  const selected: string[] = Array.isArray(current) ? [...current] : [];
  (q.choices ?? []).forEach((choice, i) => {
    const li = document.createElement('li');
    li.className = 'form-choice-option';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = `q_${q.id}_${i}`;
    cb.value = choice;
    cb.checked = selected.includes(choice);
    cb.addEventListener('change', () => {
      if (cb.checked) { if (!selected.includes(choice)) selected.push(choice); }
      else { const idx = selected.indexOf(choice); if (idx >= 0) selected.splice(idx, 1); }
      onChange([...selected]);
    });
    const lbl = document.createElement('label');
    lbl.htmlFor = cb.id;
    lbl.textContent = choice;
    li.append(cb, lbl);
    list.appendChild(li);
  });
  return list;
}

function buildScale(q: Question, current: number | undefined, onChange: (v: unknown) => void): HTMLElement {
  const min = q.min ?? 1;
  const max = q.max ?? 5;
  const wrapper = document.createElement('div');
  const row = document.createElement('div');
  row.className = 'form-scale-row';
  for (let i = min; i <= max; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'form-scale-btn' + (current === i ? ' selected' : '');
    btn.textContent = String(i);
    const captured = i;
    btn.addEventListener('click', () => {
      onChange(captured);
      row.querySelectorAll('.form-scale-btn').forEach((b, idx) => {
        b.classList.toggle('selected', (min + idx) === captured);
      });
    });
    row.appendChild(btn);
  }
  const labels = document.createElement('div');
  labels.className = 'form-scale-labels';
  const l = document.createElement('span');
  l.textContent = String(min);
  const r = document.createElement('span');
  r.textContent = String(max);
  labels.append(l, r);
  wrapper.append(row, labels);
  return wrapper;
}

function buildFileUpload(q: Question, onChange: (v: unknown) => void): HTMLElement {
  const wrapper = document.createElement('div');
  const area = document.createElement('div');
  area.className = 'form-file-upload-area';
  area.setAttribute('role', 'button');
  area.setAttribute('tabindex', '0');
  const text = document.createElement('p');
  text.className = 'form-file-upload-text';
  text.textContent = 'Click to choose a file or drag it here';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.style.display = 'none';
  fileInput.id = `q_${q.id}_file`;
  const filename = document.createElement('p');
  filename.className = 'form-file-upload-filename';
  area.append(text, filename, fileInput);
  area.addEventListener('click', () => fileInput.click());
  area.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    filename.textContent = `Uploading ${file.name}…`;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/files', { method: 'POST', body: fd });
      if (!res.ok) { filename.textContent = 'Upload failed. Try again.'; return; }
      const data = await res.json() as { key?: string; url?: string };
      onChange(data.key ?? data.url ?? file.name);
      filename.textContent = `Attached: ${file.name}`;
    } catch { filename.textContent = 'Upload failed. Try again.'; }
  });
  wrapper.appendChild(area);
  return wrapper;
}
