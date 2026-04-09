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

describe('createLogger — debug level', () => {
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

  it('emits debug when level is debug', () => {
    const log = createLogger('verbose');
    log.debug('trace info');

    expect(capture.lines).toHaveLength(1);
    expect(capture.last().level).toBe('debug');
  });
});

describe('createLogger — warn level filtering', () => {
  let createLogger: typeof import('./logger.ts').createLogger;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../../config/index.ts', () => ({
      loadConfig: () => ({ logger: { level: 'warn' } }),
    }));
    const mod = await import('./logger.ts');
    createLogger = mod.createLogger;
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
    vi.restoreAllMocks();
  });

  it('suppresses debug and info when level is warn', () => {
    const log = createLogger('filtered');
    log.debug('hidden');
    log.info('also hidden');
    log.warn('visible');
    log.error('also visible');

    expect(capture.lines).toHaveLength(2);
    const entries = capture.parsed();
    expect(entries.map((e: { level: string }) => e.level)).toEqual([
      'warn', 'error',
    ]);
  });
});

describe('createLogger — config unavailable fallback', () => {
  let createLogger: typeof import('./logger.ts').createLogger;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../../config/index.ts', () => ({
      loadConfig: () => { throw new Error('config not ready'); },
    }));
    const mod = await import('./logger.ts');
    createLogger = mod.createLogger;
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
    vi.restoreAllMocks();
  });

  it('falls back to info level when config throws', () => {
    const log = createLogger('bootstrap');
    log.debug('should be hidden');
    log.info('should appear');

    expect(capture.lines).toHaveLength(1);
    expect(capture.last().level).toBe('info');
  });
});
