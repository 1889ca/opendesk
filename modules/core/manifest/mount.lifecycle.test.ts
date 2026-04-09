/** Contract: contracts/core/manifest/rules.md */

import { describe, expect, it, vi } from 'vitest';
import express, { Router } from 'express';
import {
  createServiceRegistry,
  mountManifestRoutes,
  runManifestShutdownHooks,
  runManifestStartHooks,
} from './mount.ts';
import type { AppContext, OpenDeskManifest } from './contract.ts';

/**
 * Build a minimal AppContext literal for tests. Fields not exercised
 * by the assertions in this file are stubbed with `null` and coerced
 * — they would only run if a manifest factory tried to read them,
 * which none of these test manifests do.
 */
function makeCtx(): AppContext {
  return {
    app: express(),
    config: {} as AppContext['config'],
    pool: null as unknown as AppContext['pool'],
    auth: null as unknown as AppContext['auth'],
    permissions: null as unknown as AppContext['permissions'],
    hocuspocus: null as unknown as AppContext['hocuspocus'],
    redisClient: null as unknown as AppContext['redisClient'],
    eventBus: null as unknown as AppContext['eventBus'],
    audit: null as unknown as AppContext['audit'],
    workflow: null as unknown as AppContext['workflow'],
    observability: null as unknown as AppContext['observability'],
    shareLinkService: null as unknown as AppContext['shareLinkService'],
    shareRateLimiter: null as unknown as AppContext['shareRateLimiter'],
    shareResolveRateLimiter: null as unknown as AppContext['shareResolveRateLimiter'],
    publicDir: '/tmp',
    ...createServiceRegistry(),
  };
}

describe('mount: lifecycle hooks', () => {
  it('runs onShutdown in reverse start order', async () => {
    const events: string[] = [];
    const make = (name: string): OpenDeskManifest => ({
      name,
      lifecycle: {
        onStart: () => {
          events.push(`start:${name}`);
          return `handle:${name}`;
        },
        onShutdown: (handle) => {
          events.push(`stop:${handle as string}`);
        },
      },
    });
    const ctx = makeCtx();
    const manifests = [make('a'), make('b'), make('c')];

    const handles = await runManifestStartHooks(ctx, manifests);
    await runManifestShutdownHooks(ctx, handles);

    expect(events).toEqual([
      'start:a',
      'start:b',
      'start:c',
      'stop:handle:c',
      'stop:handle:b',
      'stop:handle:a',
    ]);
  });

  it('an onShutdown that throws does not block subsequent shutdowns', async () => {
    const events: string[] = [];
    const ctx = makeCtx();
    const manifests: OpenDeskManifest[] = [
      {
        name: 'good-first',
        lifecycle: {
          onStart: () => 1,
          onShutdown: () => {
            events.push('first');
          },
        },
      },
      {
        name: 'bad',
        lifecycle: {
          onStart: () => 2,
          onShutdown: () => {
            throw new Error('boom');
          },
        },
      },
      {
        name: 'good-last',
        lifecycle: {
          onStart: () => 3,
          onShutdown: () => {
            events.push('last');
          },
        },
      },
    ];

    const handles = await runManifestStartHooks(ctx, manifests);
    await runManifestShutdownHooks(ctx, handles);

    // Reverse order: good-last, then bad (throws, swallowed), then good-first.
    expect(events).toEqual(['last', 'first']);
  });

  it('skips manifests with no onStart hook', async () => {
    const onStart = vi.fn(() => 'handle');
    const manifests: OpenDeskManifest[] = [
      { name: 'no-hooks' },
      { name: 'has-hook', lifecycle: { onStart } },
    ];

    const handles = await runManifestStartHooks(makeCtx(), manifests);

    expect(onStart).toHaveBeenCalledOnce();
    expect(handles).toHaveLength(1);
    expect(handles[0]?.manifest.name).toBe('has-hook');
  });
});

describe('mount: service registry', () => {
  it('register stores a value that get retrieves under the same key', () => {
    const reg = createServiceRegistry();
    reg.register('answer', 42);
    expect(reg.get<number>('answer')).toBe(42);
  });

  it('get returns undefined for an unset key', () => {
    const reg = createServiceRegistry();
    expect(reg.get<string>('missing')).toBeUndefined();
  });

  it('register overwrites an existing key (idempotent within startup)', () => {
    const reg = createServiceRegistry();
    reg.register('x', 'first');
    reg.register('x', 'second');
    expect(reg.get<string>('x')).toBe('second');
  });

  it('two registries are isolated from each other', () => {
    const a = createServiceRegistry();
    const b = createServiceRegistry();
    a.register('shared', 'A');
    b.register('shared', 'B');
    expect(a.get<string>('shared')).toBe('A');
    expect(b.get<string>('shared')).toBe('B');
  });

  it('a manifest onStart hook can register a handle that a route factory reads', () => {
    const onStart = vi.fn((ctx: AppContext) => ctx.register('myService', { ready: true }));
    const factory = vi.fn((ctx: AppContext) => {
      const svc = ctx.get<{ ready: boolean }>('myService');
      expect(svc?.ready).toBe(true);
      return Router();
    });
    const m: OpenDeskManifest = {
      name: 'shared-handle',
      lifecycle: { onStart },
      apiRoutes: [{ mount: '/api/x', factory }],
    };
    const ctx = makeCtx();

    return runManifestStartHooks(ctx, [m]).then(() => {
      mountManifestRoutes(ctx, [m]);
      expect(factory).toHaveBeenCalledOnce();
    });
  });
});
