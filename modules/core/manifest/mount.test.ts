/** Contract: contracts/core/manifest/rules.md */

import { describe, expect, it, vi } from 'vitest';
import express, { Router } from 'express';
import {
  collectManifestBundles,
  createServiceRegistry,
  filterEnabled,
  mountManifestRoutes,
  runManifestShutdownHooks,
  runManifestStartHooks,
  type ManifestStartHandle,
} from './mount.ts';
import type { AppContext, OpenDeskManifest } from './contract.ts';

/**
 * Build a minimal AppContext literal for tests. The tests in this
 * file only ever exercise `app`, `config`, and the service registry,
 * so the rest of the AppContext fields are stubbed with `null` and
 * coerced — they would only run if a manifest factory tried to read
 * them, which none of these test manifests do.
 */
function makeCtx(overrides: Partial<AppContext> = {}): AppContext {
  const app = express();
  const registry = createServiceRegistry();
  return {
    app,
    config: { ai: { enabled: false }, federation: { enabled: false } } as AppContext['config'],
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
    ...registry,
    ...overrides,
  };
}

describe('mount: enabled gating', () => {
  it('filterEnabled drops manifests whose gate returns false', () => {
    const on: OpenDeskManifest = { name: 'on', enabled: () => true };
    const off: OpenDeskManifest = { name: 'off', enabled: () => false };
    const noGate: OpenDeskManifest = { name: 'noGate' };
    const ctx = makeCtx();

    const result = filterEnabled([on, off, noGate], ctx);

    expect(result.map((m) => m.name)).toEqual(['on', 'noGate']);
  });

  it('mountManifestRoutes mounts no routes for a disabled manifest when caller filters first', () => {
    const factory = vi.fn(() => Router());
    const disabled: OpenDeskManifest = {
      name: 'disabled',
      enabled: () => false,
      apiRoutes: [{ mount: '/api/disabled', factory }],
    };
    const ctx = makeCtx();

    mountManifestRoutes(ctx, filterEnabled([disabled], ctx));

    expect(factory).not.toHaveBeenCalled();
  });
});

describe('mount: order sorting', () => {
  it('mounts routes in numeric order regardless of array position', () => {
    const calls: number[] = [];
    const make = (n: number) => () => {
      calls.push(n);
      return Router();
    };
    const m: OpenDeskManifest = {
      name: 'ordered',
      apiRoutes: [
        { mount: '/a', order: 30, factory: make(30) },
        { mount: '/a', order: 10, factory: make(10) },
        { mount: '/a', order: 20, factory: make(20) },
      ],
    };

    mountManifestRoutes(makeCtx(), [m]);

    expect(calls).toEqual([10, 20, 30]);
  });

  it('routes without an order use the 100 default', () => {
    const calls: string[] = [];
    const make = (label: string) => () => {
      calls.push(label);
      return Router();
    };
    const m: OpenDeskManifest = {
      name: 'mixed',
      apiRoutes: [
        { mount: '/a', factory: make('default-first') },
        { mount: '/a', order: 50, factory: make('explicit-50') },
        { mount: '/a', order: 200, factory: make('explicit-200') },
        { mount: '/a', factory: make('default-second') },
      ],
    };

    mountManifestRoutes(makeCtx(), [m]);

    // 50 < 100 (default-first, default-second) < 200; defaults
    // preserve their original relative order via stable sort.
    expect(calls).toEqual(['explicit-50', 'default-first', 'default-second', 'explicit-200']);
  });
});

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

describe('mount: bundle collection', () => {
  it('flattens bundles from every manifest in declaration order', () => {
    const m1: OpenDeskManifest = {
      name: 'one',
      frontend: {
        bundles: [
          { kind: 'js', entryPoint: 'a.ts', outfile: 'a.js' },
          { kind: 'css', entryPoint: 'a.css', outfile: 'a.css' },
        ],
      },
    };
    const m2: OpenDeskManifest = {
      name: 'two',
      frontend: { bundles: [{ kind: 'js', entryPoint: 'b.ts', outfile: 'b.js' }] },
    };
    const noFrontend: OpenDeskManifest = { name: 'three' };

    const result = collectManifestBundles([m1, m2, noFrontend]);

    expect(result.map((b) => b.outfile)).toEqual(['a.js', 'a.css', 'b.js']);
  });

  it('does NOT skip bundles for disabled manifests (build artifacts always exist)', () => {
    const disabled: OpenDeskManifest = {
      name: 'disabled',
      enabled: () => false,
      frontend: { bundles: [{ kind: 'js', entryPoint: 'x.ts', outfile: 'x.js' }] },
    };

    // collectManifestBundles takes the raw list, not the filtered one,
    // because bundles must be built unconditionally so the runtime
    // can decide whether to serve the page that loads them.
    const result = collectManifestBundles([disabled]);

    expect(result).toHaveLength(1);
    expect(result[0]?.outfile).toBe('x.js');
  });
});
