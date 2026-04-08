/** Contract: contracts/workflow/rules.md */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAction } from './action-runner.ts';
import type { DomainEvent } from '../../events/contract.ts';

const mockEvent: DomainEvent = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  type: 'DocumentUpdated',
  aggregateId: 'doc-123',
  actorId: 'user-1',
  actorType: 'human',
  occurredAt: '2026-04-07T12:00:00.000Z',
};

describe('runAction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('webhook', () => {
    it('sends POST with correct body and headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal('fetch', mockFetch);

      await runAction('webhook', { url: 'https://example.com/hook', headers: { 'X-Token': 'abc' } }, mockEvent);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://example.com/hook');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({
        eventId: mockEvent.id,
        type: mockEvent.type,
        aggregateId: mockEvent.aggregateId,
        actorId: mockEvent.actorId,
        occurredAt: mockEvent.occurredAt,
      });
      expect(opts.headers['X-Token']).toBe('abc');
      expect(opts.headers['Content-Type']).toBe('application/json');
    });

    it('throws on non-2xx response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' }));

      await expect(
        runAction('webhook', { url: 'https://example.com/hook' }, mockEvent),
      ).rejects.toThrow('Webhook returned 500');
    });
  });

  describe('notify', () => {
    it('logs the notification message', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction('notify', { message: 'Hello world' }, mockEvent);
      expect(spy).toHaveBeenCalledWith(
        '[workflow:notify] Hello world eventId=550e8400-e29b-41d4-a716-446655440000',
      );
    });
  });

  describe('export', () => {
    it('does not throw (placeholder)', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await expect(runAction('export', { format: 'pdf' }, mockEvent)).resolves.toBeUndefined();
      spy.mockRestore();
    });
  });
});
