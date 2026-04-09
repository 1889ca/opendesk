/** Contract: contracts/http/rules.md */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { httpFetch, HttpFetchError } from './fetch.ts';

describe('HttpFetchError', () => {
  it('stores error code and message', () => {
    const err = new HttpFetchError('TIMEOUT', 'timed out');
    expect(err.code).toBe('TIMEOUT');
    expect(err.message).toBe('timed out');
    expect(err.name).toBe('HttpFetchError');
    expect(err).toBeInstanceOf(Error);
  });

  it('stores a cause when provided', () => {
    const cause = new Error('original');
    const err = new HttpFetchError('NETWORK_ERROR', 'failed', { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('httpFetch', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns Response on successful fetch', async () => {
    const fakeResponse = new Response('ok', { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse);

    const res = await httpFetch('https://example.com/api');
    expect(res).toBe(fakeResponse);
    expect(res.ok).toBe(true);
  });

  it('does not throw on non-2xx responses', async () => {
    const fakeResponse = new Response('not found', { status: 404 });
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse);

    const res = await httpFetch('https://example.com/missing');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  it('passes method and headers to native fetch', async () => {
    const fakeResponse = new Response('created', { status: 201 });
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse);

    await httpFetch('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"key":"val"}',
    });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe('https://example.com/api');
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('strips timeoutMs from the init passed to native fetch', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));

    await httpFetch('https://example.com/api', { timeoutMs: 5000 });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1]).not.toHaveProperty('timeoutMs');
    expect(callArgs[1].signal).toBeDefined();
  });

  it('throws HttpFetchError with NETWORK_ERROR on non-abort failures', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(httpFetch('https://bad.example.com'))
      .rejects.toThrow(HttpFetchError);

    try {
      await httpFetch('https://bad.example.com');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpFetchError);
      expect((err as HttpFetchError).code).toBe('NETWORK_ERROR');
      expect((err as HttpFetchError).message).toContain('bad.example.com');
    }
  });

  it('re-throws caller-initiated AbortError as-is', async () => {
    const controller = new AbortController();
    controller.abort();

    globalThis.fetch = vi.fn().mockRejectedValue(
      new DOMException('Aborted', 'AbortError'),
    );

    // When the timeout signal is NOT aborted but the caller's signal is,
    // it should re-throw the abort error, not wrap it
    await expect(
      httpFetch('https://example.com/api', { signal: controller.signal, timeoutMs: 60000 }),
    ).rejects.toThrow(DOMException);
  });

  it('includes the URL in NETWORK_ERROR messages', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    try {
      await httpFetch('https://dead.host:9999/path');
    } catch (err) {
      expect((err as HttpFetchError).message).toContain('dead.host:9999/path');
      expect((err as HttpFetchError).message).toContain('ECONNREFUSED');
    }
  });
});
