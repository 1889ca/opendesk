/** Contract: contracts/app/shell.md */

import { describe, it, expect, vi } from 'vitest';
import { loadModule, type ViewModule } from './lazy-loader.ts';

function createViewModule(): ViewModule {
  return {
    mount: vi.fn(),
    unmount: vi.fn(),
  };
}

describe('loadModule', () => {
  it('calls the factory and returns the module', async () => {
    const mod = createViewModule();
    const factory = vi.fn().mockResolvedValue(mod);

    const result = await loadModule('test-load-1', factory);

    expect(factory).toHaveBeenCalledOnce();
    expect(result).toBe(mod);
  });

  it('caches the module after first load', async () => {
    const mod = createViewModule();
    const factory = vi.fn().mockResolvedValue(mod);

    const first = await loadModule('test-cache-1', factory);
    const second = await loadModule('test-cache-1', factory);

    expect(factory).toHaveBeenCalledOnce();
    expect(first).toBe(second);
  });

  it('uses different cache entries for different keys', async () => {
    const mod1 = createViewModule();
    const mod2 = createViewModule();

    const result1 = await loadModule('key-diff-a', vi.fn().mockResolvedValue(mod1));
    const result2 = await loadModule('key-diff-b', vi.fn().mockResolvedValue(mod2));

    expect(result1).toBe(mod1);
    expect(result2).toBe(mod2);
    expect(result1).not.toBe(result2);
  });

  it('propagates factory errors', async () => {
    const factory = vi.fn().mockRejectedValue(new Error('load failed'));

    await expect(loadModule('test-error-1', factory)).rejects.toThrow('load failed');
  });

  it('returns ViewModule with mount and unmount', async () => {
    const mod = createViewModule();
    const result = await loadModule('test-shape-1', vi.fn().mockResolvedValue(mod));

    expect(typeof result.mount).toBe('function');
    expect(typeof result.unmount).toBe('function');
  });
});
