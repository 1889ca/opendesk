/** Contract: contracts/logger/rules.md */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** Capture stdout writes so we can inspect structured log output. */
function captureStdout() {
  const lines: string[] = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
  return {
    lines,
    parsed: () => lines.map((l) => JSON.parse(l.trimEnd())),
    last: () => JSON.parse(lines[lines.length - 1].trimEnd()),
    restore: () => spy.mockRestore(),
  };
}

describe('child loggers', () => {
  let createLogger: typeof import('./logger.ts').createLogger;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../../config/index.ts', () => ({
      loadConfig: () => ({ logger: { level: 'debug' } }),
    }));
    const mod = await import('./logger.ts');
    createLogger = mod.createLogger;
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
    vi.restoreAllMocks();
  });

  it('inherits the parent module name', () => {
    const parent = createLogger('api');
    const child = parent.child({ requestId: 'abc-123' });
    child.info('handling request');

    const entry = capture.last();
    expect(entry.module).toBe('api');
  });

  it('includes bound context in every log entry', () => {
    const parent = createLogger('api');
    const child = parent.child({ requestId: 'req-1' });

    child.info('start');
    child.warn('slow query');

    const entries = capture.parsed();
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(entry.requestId).toBe('req-1');
    }
  });

  it('merges call-site context with bound context', () => {
    const parent = createLogger('api');
    const child = parent.child({ requestId: 'req-2' });
    child.info('response', { status: 200 });

    const entry = capture.last();
    expect(entry.requestId).toBe('req-2');
    expect(entry.status).toBe(200);
  });

  it('allows call-site context to override bound context', () => {
    const parent = createLogger('api');
    const child = parent.child({ region: 'us-east' });
    child.info('fallback', { region: 'eu-west' });

    const entry = capture.last();
    expect(entry.region).toBe('eu-west');
  });

  it('supports multi-level nesting', () => {
    const root = createLogger('svc');
    const mid = root.child({ traceId: 't-1' });
    const leaf = mid.child({ spanId: 's-1' });

    leaf.info('deep call');

    const entry = capture.last();
    expect(entry.module).toBe('svc');
    expect(entry.traceId).toBe('t-1');
    expect(entry.spanId).toBe('s-1');
  });

  it('does not mutate the parent logger context', () => {
    const parent = createLogger('clean');
    parent.child({ extra: true });
    parent.info('parent log');

    const entry = capture.last();
    expect(entry.extra).toBeUndefined();
  });

  it('child loggers respect level filtering', () => {
    vi.restoreAllMocks();
    capture.restore();

    // Re-import with warn level
    return (async () => {
      vi.resetModules();
      vi.doMock('../../config/index.ts', () => ({
        loadConfig: () => ({ logger: { level: 'warn' } }),
      }));
      const mod = await import('./logger.ts');
      const log = mod.createLogger('filtered');
      const child = log.child({ scope: 'inner' });

      const cap = captureStdout();
      child.debug('nope');
      child.info('nope');
      child.warn('yes');

      expect(cap.lines).toHaveLength(1);
      expect(cap.last().level).toBe('warn');
      expect(cap.last().scope).toBe('inner');
      cap.restore();
    })();
  });

  it('child logger implements all four log methods', () => {
    const parent = createLogger('iface');
    const child = parent.child({ tag: 'check' });

    expect(typeof child.debug).toBe('function');
    expect(typeof child.info).toBe('function');
    expect(typeof child.warn).toBe('function');
    expect(typeof child.error).toBe('function');
    expect(typeof child.child).toBe('function');
  });
});
