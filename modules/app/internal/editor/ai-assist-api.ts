/** Contract: contracts/app/rules.md */
/**
 * AI Writing Assistant — API client.
 * Calls POST /api/ai/assist with the selected text, action, and optional scope context.
 */
import { apiFetch } from '../shared/api-client.ts';

export type AssistAction = 'improve' | 'summarize' | 'expand' | 'shorten' | 'fix-grammar' | 'continue';

export type AssistContextType = 'selection' | 'thread' | 'dataset' | 'document';

/** Scope context sent alongside an assist request. Mirrors the backend AssistContext schema. */
export interface AssistContext {
  type: AssistContextType;
  /** Human-readable label shown in the context badge. */
  label: string;
  /** Additional prose context injected before the action text in the LLM prompt. */
  content?: string;
}

export interface AssistRequest {
  action: AssistAction;
  text: string;
  documentId?: string;
  context?: AssistContext;
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
