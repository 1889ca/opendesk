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

/*
 * The logger module reads config at import time to resolve minLevel.
 * We mock the config module so we can control the log level per test group,
 * then use dynamic import + vi.resetModules() to re-evaluate the logger.
 */

describe('createLogger — default level (info)', () => {
  let createLogger: typeof import('./logger.ts').createLogger;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../../config/index.ts', () => ({
      loadConfig: () => ({ logger: { level: 'info' } }),
    }));
    const mod = await import('./logger.ts');
    createLogger = mod.createLogger;
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
    vi.restoreAllMocks();
  });

  it('emits a single JSON line per log call', () => {
    const log = createLogger('test-mod');
    log.info('hello');

    expect(capture.lines).toHaveLength(1);
    expect(capture.lines[0].endsWith('\n')).toBe(true);
    expect(() => JSON.parse(capture.lines[0])).not.toThrow();
  });

  it('includes level, timestamp, module, and message in every entry', () => {
    const log = createLogger('mymod');
    log.info('check fields');

    const entry = capture.last();
    expect(entry.level).toBe('info');
    expect(entry.module).toBe('mymod');
    expect(entry.message).toBe('check fields');
    expect(typeof entry.timestamp).toBe('string');
    expect(() => new Date(entry.timestamp)).not.toThrow();
  });

  it('merges additional context into the log entry', () => {
    const log = createLogger('ctx-mod');
    log.warn('disk full', { disk: '/dev/sda1', usage: 99 });

    const entry = capture.last();
    expect(entry.level).toBe('warn');
    expect(entry.disk).toBe('/dev/sda1');
    expect(entry.usage).toBe(99);
  });

  it('emits error-level logs', () => {
    const log = createLogger('err-mod');
    log.error('something broke', { err: 'stack trace here' });

    const entry = capture.last();
    expect(entry.level).toBe('error');
    expect(entry.err).toBe('stack trace here');
  });

  it('suppresses debug when level is info', () => {
    const log = createLogger('quiet');
    log.debug('should be hidden');

    expect(capture.lines).toHaveLength(0);
  });

  it('emits info, warn, and error when level is info', () => {
    const log = createLogger('levels');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(capture.lines).toHaveLength(3);
    const entries = capture.parsed();
    expect(entries.map((e: { level: string }) => e.level)).toEqual([
      'info', 'warn', 'error',
    ]);
  });

  it('never throws even with unusual context values', () => {
    const log = createLogger('safe');

    // Circular reference
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    // The logger wraps JSON.stringify in try/catch — this should not throw.
    expect(() => log.info('circular', circular)).not.toThrow();
  });

  it('produces a valid ISO-8601 timestamp', () => {
    const log = createLogger('time');
    log.info('tick');

    const entry = capture.last();
    const d = new Date(entry.timestamp);
    expect(d.toISOString()).toBe(entry.timestamp);
  });
});
