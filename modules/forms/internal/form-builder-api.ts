/** Contract: contracts/forms/rules.md */

import type { FormDefinition, Question } from '../contract.ts';

const BASE = '/api/forms';

export async function fetchForm(id: string): Promise<FormDefinition> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to load form: ${res.statusText}`);
  return res.json() as Promise<FormDefinition>;
}

export async function createForm(title: string): Promise<FormDefinition> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title, questions: [], anonymous: false, single_response: false }),
  });
  if (!res.ok) throw new Error(`Failed to create form: ${res.statusText}`);
  return res.json() as Promise<FormDefinition>;
}

export interface FormPatch {
  title?: string;
  description?: string;
  questions?: Question[];
  anonymous?: boolean;
  single_response?: boolean;
  close_at?: string | null;
  closed?: boolean;
}

export async function updateForm(id: string, patch: FormPatch): Promise<FormDefinition> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update form: ${res.statusText}`);
  return res.json() as Promise<FormDefinition>;
}

export async function deleteForm(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to delete form: ${res.statusText}`);
}
