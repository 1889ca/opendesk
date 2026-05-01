/** Contract: contracts/ai/rules.md */
import { describe, it, expect, vi } from 'vitest';
import { createAssistService } from './assist-service.ts';
import type { OllamaClient } from './ollama-client.ts';

function makeOllama(response = 'ok'): OllamaClient {
  return {
    embed: vi.fn(async () => []),
    chat: vi.fn(async () => response),
    ping: vi.fn(async () => true),
    listInstalled: vi.fn(async () => []),
    pull: vi.fn(async function* () {}),
    remove: vi.fn(async () => {}),
  } as unknown as OllamaClient;
}

describe('createAssistService', () => {
  it('passes text through the LLM and returns the result', async () => {
    const ollama = makeOllama('Better text.');
    const service = createAssistService(ollama);

    const result = await service.assist({ action: 'improve', text: 'Draft text.' });

    expect(result.result).toBe('Better text.');
    expect(ollama.chat).toHaveBeenCalledOnce();
  });

  it('prepends context content to the prompt when context is provided', async () => {
    const ollama = makeOllama('Summarized.');
    const service = createAssistService(ollama);

    await service.assist({
      action: 'summarize',
      text: 'The text to summarize.',
      context: { type: 'selection', label: 'Selection', content: 'surrounding paragraph context' },
    });

    const [, prompt] = (ollama.chat as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(prompt).toContain('surrounding paragraph context');
    expect(prompt).toContain('The text to summarize.');
    // Context block comes before the action instruction
    expect(prompt.indexOf('surrounding paragraph context')).toBeLessThan(
      prompt.indexOf('The text to summarize.'),
    );
  });

  it('does not add a context prefix when context has no content', async () => {
    const ollama = makeOllama('Fixed.');
    const service = createAssistService(ollama);

    await service.assist({
      action: 'fix-grammar',
      text: 'Bad grammer here.',
      context: { type: 'selection', label: 'Selection' },
    });

    const [, prompt] = (ollama.chat as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    // No context block header present when content is absent
    expect(prompt).not.toContain('Context (');
    expect(prompt).toContain('Bad grammer here.');
  });

  it('propagates Ollama errors to callers', async () => {
    const ollama = makeOllama();
    (ollama.chat as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Ollama down'));
    const service = createAssistService(ollama);

    await expect(service.assist({ action: 'expand', text: 'Some text.' })).rejects.toThrow('Ollama down');
  });
});
