/** Contract: contracts/events/rules.md */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerType, getOwner } from './schema-registry.ts';

const mockQuery = vi.fn();
const mockPool = { query: mockQuery } as unknown as import('pg').Pool;

describe('schema-registry', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('registerType', () => {
    it('inserts a new event type', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // SELECT check
        .mockResolvedValueOnce({ rowCount: 1 }); // INSERT

      await registerType(mockPool, 'DocumentUpdated', 'collab');

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery.mock.calls[1][1]).toEqual(['DocumentUpdated', 'collab']);
    });

    it('allows re-registration by same owner', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ owner_module: 'collab' }],
      });

      await registerType(mockPool, 'DocumentUpdated', 'collab');
      // Should not throw, should not INSERT
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('rejects registration by different owner', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ owner_module: 'collab' }],
      });

      await expect(
        registerType(mockPool, 'DocumentUpdated', 'sharing'),
      ).rejects.toThrow(/already registered by module 'collab'/);
    });
  });

  describe('getOwner', () => {
    it('returns owner for registered type', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ owner_module: 'collab' }],
      });

      const owner = await getOwner(mockPool, 'DocumentUpdated');
      expect(owner).toBe('collab');
    });

    it('returns null for unregistered type', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const owner = await getOwner(mockPool, 'DocumentUpdated');
      expect(owner).toBeNull();
    });
  });
});
