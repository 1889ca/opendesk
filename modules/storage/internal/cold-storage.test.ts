/** Contract: contracts/storage/rules.md */

/**
 * Unit tests for cold-storage.ts.
 *
 * All tests use mock Pool and S3 clients — no database or real S3 required.
 */

import { describe, it, expect, vi, type Mock } from 'vitest';
import {
  createColdStorageAdapter,
  archiveStaleDocuments,
  type ColdStorageAdapter,
} from './cold-storage.ts';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeMockPool(rows: Record<string, unknown>[] = []) {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  };
}

function makeMockS3() {
  return {
    send: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// archiveToCold
// ---------------------------------------------------------------------------

describe('archiveToCold', () => {
  it('uploads snapshot + state_vector to S3 and updates PG row to tier=cold', async () => {
    const snapshot = { documentType: 'text', content: {} };
    const stateVectorBuffer = Buffer.from([1, 2, 3]);

    const pool = makeMockPool([
      {
        snapshot,
        state_vector: stateVectorBuffer,
        revision_id: 'rev-abc',
      },
    ]);
    const s3 = makeMockS3();
    const bucket = 'test-bucket';

    const adapter = createColdStorageAdapter(pool as never, s3 as never, bucket);
    await adapter.archiveToCold('doc-1');

    // S3 PutObject was called
    expect(s3.send).toHaveBeenCalledTimes(1);
    const putCmd = (s3.send as Mock).mock.calls[0][0];
    expect(putCmd.input.Bucket).toBe(bucket);
    expect(putCmd.input.Key).toBe('cold/doc-1.json');
    expect(putCmd.input.ContentType).toBe('application/json');

    // Body contains expected fields
    const body = JSON.parse(putCmd.input.Body as string) as {
      docId: string;
      stateVector: string;
      revisionId: string;
    };
    expect(body.docId).toBe('doc-1');
    expect(body.revisionId).toBe('rev-abc');
    expect(body.stateVector).toBe(stateVectorBuffer.toString('base64'));

    // PG UPDATE sets tier=cold and nulls snapshot/state_vector
    expect(pool.query).toHaveBeenCalledTimes(2);
    const updateCall = (pool.query as Mock).mock.calls[1];
    expect(updateCall[0]).toContain("tier        = 'cold'");
    expect(updateCall[1]).toEqual(['doc-1', 'cold/doc-1.json']);
  });

  it('throws if document is not found', async () => {
    const pool = makeMockPool([]); // empty rows
    const s3 = makeMockS3();

    const adapter = createColdStorageAdapter(pool as never, s3 as never, 'bucket');
    await expect(adapter.archiveToCold('missing-doc')).rejects.toThrow(
      'archiveToCold: document not found',
    );
    expect(s3.send).not.toHaveBeenCalled();
  });

  it('stores null stateVector as null in the cold object', async () => {
    const pool = makeMockPool([
      { snapshot: {}, state_vector: null, revision_id: 'rev-x' },
    ]);
    const s3 = makeMockS3();

    const adapter = createColdStorageAdapter(pool as never, s3 as never, 'bucket');
    await adapter.archiveToCold('doc-2');

    const putCmd = (s3.send as Mock).mock.calls[0][0];
    const body = JSON.parse(putCmd.input.Body as string) as { stateVector: null };
    expect(body.stateVector).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// warmFromCold
// ---------------------------------------------------------------------------

describe('warmFromCold', () => {
  it('downloads from S3 and updates PG row to tier=hot', async () => {
    const coldObject = {
      docId: 'doc-3',
      snapshot: { documentType: 'text' },
      stateVector: Buffer.from([4, 5, 6]).toString('base64'),
      revisionId: 'rev-warm',
      archivedAt: new Date().toISOString(),
    };

    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ cold_key: 'cold/doc-3.json' }] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
    };
    const mockBody = {
      transformToString: vi.fn().mockResolvedValue(JSON.stringify(coldObject)),
    };
    const s3 = { send: vi.fn().mockResolvedValue({ Body: mockBody }) };

    const adapter = createColdStorageAdapter(pool as never, s3 as never, 'bucket');
    await adapter.warmFromCold('doc-3');

    // S3 GetObject was called with correct key
    expect(s3.send).toHaveBeenCalledTimes(1);
    const getCmd = (s3.send as Mock).mock.calls[0][0];
    expect(getCmd.input.Bucket).toBe('bucket');
    expect(getCmd.input.Key).toBe('cold/doc-3.json');

    // PG UPDATE restores snapshot, state_vector and sets tier=hot
    expect(pool.query).toHaveBeenCalledTimes(2);
    const updateCall = (pool.query as Mock).mock.calls[1];
    expect(updateCall[0]).toContain("tier         = 'hot'");
    expect(updateCall[1][0]).toBe('doc-3');
  });

  it('throws if document is not found', async () => {
    const pool = makeMockPool([]);
    const s3 = makeMockS3();

    const adapter = createColdStorageAdapter(pool as never, s3 as never, 'bucket');
    await expect(adapter.warmFromCold('missing')).rejects.toThrow(
      'warmFromCold: document not found',
    );
  });

  it('throws if cold_key is missing', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [{ cold_key: null }] }),
    };
    const s3 = makeMockS3();

    const adapter = createColdStorageAdapter(pool as never, s3 as never, 'bucket');
    await expect(adapter.warmFromCold('doc-no-key')).rejects.toThrow(
      'warmFromCold: document has no cold_key',
    );
    expect(s3.send).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getSnapshot staleSeconds (via adapter protocol verification)
// ---------------------------------------------------------------------------

describe('staleSeconds contract', () => {
  it('archiveToCold stores archivedAt in the cold object', async () => {
    const before = Date.now();
    const pool = makeMockPool([
      { snapshot: {}, state_vector: null, revision_id: 'r' },
    ]);
    const s3 = makeMockS3();

    const adapter = createColdStorageAdapter(pool as never, s3 as never, 'bucket');
    await adapter.archiveToCold('doc-ts');

    const after = Date.now();
    const putCmd = (s3.send as Mock).mock.calls[0][0];
    const body = JSON.parse(putCmd.input.Body as string) as { archivedAt: string };
    const archivedMs = new Date(body.archivedAt).getTime();

    expect(archivedMs).toBeGreaterThanOrEqual(before);
    expect(archivedMs).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// archiveStaleDocuments lifecycle policy
// ---------------------------------------------------------------------------

describe('archiveStaleDocuments', () => {
  it('calls archiveToCold for each stale document id', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 'stale-1' }, { id: 'stale-2' }],
      }),
    };
    const mockAdapter: ColdStorageAdapter = {
      archiveToCold: vi.fn().mockResolvedValue(undefined),
      warmFromCold: vi.fn().mockResolvedValue(undefined),
    };

    await archiveStaleDocuments(pool as never, mockAdapter, 90);

    expect(mockAdapter.archiveToCold).toHaveBeenCalledWith('stale-1');
    expect(mockAdapter.archiveToCold).toHaveBeenCalledWith('stale-2');
    expect(mockAdapter.archiveToCold).toHaveBeenCalledTimes(2);
  });

  it('continues past errors (fire-and-forget per document)', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 'err-doc' }, { id: 'ok-doc' }],
      }),
    };
    let callCount = 0;
    const mockAdapter: ColdStorageAdapter = {
      archiveToCold: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error('simulated S3 failure');
      }),
      warmFromCold: vi.fn(),
    };

    // Should not throw even though first archiveToCold fails
    await expect(archiveStaleDocuments(pool as never, mockAdapter, 30)).resolves.toBeUndefined();
    expect(mockAdapter.archiveToCold).toHaveBeenCalledTimes(2);
  });

  it('uses parameterized INTERVAL to prevent SQL injection', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    const mockAdapter: ColdStorageAdapter = {
      archiveToCold: vi.fn(),
      warmFromCold: vi.fn(),
    };

    await archiveStaleDocuments(pool as never, mockAdapter, 45);

    const [sql, params] = (pool.query as Mock).mock.calls[0] as [string, string[]];
    // The threshold must be passed as a parameter, not interpolated
    expect(sql).toContain('$1');
    expect(params).toContain('45');
  });
});
