/** Contract: contracts/app/rules.md */
/**
 * AI Writing Assistant — API client.
 * Calls POST /api/ai/assist with the selected text and action.
 */
import { apiFetch } from '../shared/api-client.ts';

export type AssistAction = 'improve' | 'summarize' | 'expand' | 'shorten' | 'fix-grammar' | 'continue';

export interface AssistRequest {
  action: AssistAction;
  text: string;
  documentId?: string;
}

export interface AssistResult {
  result: string;
}

export async function callAssist(req: AssistRequest): Promise<AssistResult> {
  const res = await apiFetch('/api/ai/assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `AI assist failed (${res.status})`);
  }
  return res.json() as Promise<AssistResult>;
}
