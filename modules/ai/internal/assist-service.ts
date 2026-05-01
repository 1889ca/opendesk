/** Contract: contracts/ai/rules.md */
import type { OllamaClient } from './ollama-client.ts';
import type { AssistRequest, AssistResult } from '../contract.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('ai:assist');

const SYSTEM_PROMPT = `You are a writing assistant integrated into OpenDesk, a sovereign office suite. You help users improve their documents. Respond ONLY with the transformed text — no explanations, no preamble, no quotes around the result. Output only the written content itself.`;

function buildActionInstruction(action: AssistRequest['action'], text: string): string {
  switch (action) {
    case 'improve':
      return `Improve the writing quality of the following text. Make it clearer, more concise, and more professional:\n\n${text}`;
    case 'summarize':
      return `Summarize the following text in a concise paragraph:\n\n${text}`;
    case 'expand':
      return `Expand the following text with more detail and explanation, keeping the same tone:\n\n${text}`;
    case 'shorten':
      return `Make the following text shorter while preserving its key meaning:\n\n${text}`;
    case 'fix-grammar':
      return `Fix any grammar, spelling, and punctuation errors in the following text. Return the corrected text only:\n\n${text}`;
    case 'continue':
      return `Continue writing from where the following text leaves off, matching the tone and style:\n\n${text}`;
  }
}

/**
 * Prepend scoped context to the prompt so the model understands what
 * surrounding material the user is working within before acting on text.
 */
function buildPrompt(req: AssistRequest): string {
  const action = buildActionInstruction(req.action, req.text);
  if (!req.context?.content) return action;
  return `Context (${req.context.label}):\n${req.context.content}\n\n---\n\n${action}`;
}

export function createAssistService(ollama: OllamaClient) {
  async function assist(req: AssistRequest): Promise<AssistResult> {
    const prompt = buildPrompt(req);
    log.info('ai assist', {
      action: req.action,
      textLength: req.text.length,
      contextType: req.context?.type ?? 'none',
    });
    try {
      const result = await ollama.chat(SYSTEM_PROMPT, prompt);
      return { result };
    } catch (err) {
      log.error('assist failed', { action: req.action, error: String(err) });
      throw err;
    }
  }

  return { assist };
}

export type AssistService = ReturnType<typeof createAssistService>;
