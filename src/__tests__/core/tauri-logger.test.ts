import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockExists = vi.fn();
const mockMkdir = vi.fn();
const mockWriteTextFile = vi.fn();

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: (...args: any[]) => mockWriteTextFile(...args),
  mkdir: (...args: any[]) => mockMkdir(...args),
  exists: (...args: any[]) => mockExists(...args),
  BaseDirectory: { AppData: 0 },
}));

type LoggerModule = typeof import('@/core/tauri-logger');

let mod: LoggerModule;

beforeEach(async () => {
  vi.resetModules();
  mod = await import('@/core/tauri-logger');
  mockExists.mockReset();
  mockMkdir.mockReset();
  mockWriteTextFile.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('initLogger', () => {
  it('should create log dir and set initialized', async () => {
    mockExists.mockResolvedValue(false);
    mockMkdir.mockResolvedValue(undefined);

    await mod.initLogger();

    expect(mockExists).toHaveBeenCalledWith('logs', { baseDir: 0 });
    expect(mockMkdir).toHaveBeenCalledWith('logs', { baseDir: 0, recursive: true });
  });

  it('should skip mkdir if log dir already exists', async () => {
    mockExists.mockResolvedValue(true);

    await mod.initLogger();

    expect(mockMkdir).not.toHaveBeenCalled();
  });

  it('should be idempotent — second call skips', async () => {
    mockExists.mockResolvedValue(true);

    await mod.initLogger();
    mockExists.mockClear();
    await mod.initLogger();

    expect(mockExists).not.toHaveBeenCalled();
  });

  it('should handle fs errors gracefully', async () => {
    mockExists.mockRejectedValue(new Error('no tauri'));

    await mod.initLogger();

    expect(mockMkdir).not.toHaveBeenCalled();
  });
});

describe('logToFile', () => {
  it('should fallback to console when not initialized', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await mod.logToFile('INFO', 'hello %s', 'world');

    expect(spy).toHaveBeenCalledWith('[Logger]', 'hello %s', 'world');
    expect(mockWriteTextFile).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should write to file after initialization', async () => {
    mockExists.mockResolvedValue(true);
    await mod.initLogger();

    mockWriteTextFile.mockResolvedValue(undefined);
    vi.setSystemTime(new Date('2026-05-26T12:00:00.000Z'));

    await mod.logToFile('WARN', 'something went wrong');

    expect(mockWriteTextFile).toHaveBeenCalledWith(
      'logs/2026-05-26.log',
      expect.stringContaining('[WARN] something went wrong'),
      { baseDir: 0, append: true },
    );
  });

  it('should handle write failures gracefully', async () => {
    mockExists.mockResolvedValue(true);
    await mod.initLogger();
    mockWriteTextFile.mockRejectedValue(new Error('disk full'));

    await expect(mod.logToFile('ERROR', 'boom')).resolves.toBeUndefined();
  });
});

describe('tauriLogger.info / warn / error', () => {
  it('should call logToFile with INFO level', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mod.tauriLogger.info('test');
    expect(spy).toHaveBeenCalledWith('[Logger]', 'test');
    spy.mockRestore();
  });

  it('should call logToFile with WARN level', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mod.tauriLogger.warn('warning');
    expect(spy).toHaveBeenCalledWith('[Logger]', 'warning');
    spy.mockRestore();
  });

  it('should call logToFile with ERROR level', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mod.tauriLogger.error('fail');
    expect(spy).toHaveBeenCalledWith('[Logger]', 'fail');
    spy.mockRestore();
  });
});

describe('formatLine (via logToFile)', () => {
  it('should produce correct format without args', async () => {
    mockExists.mockResolvedValue(true);
    await mod.initLogger();
    mockWriteTextFile.mockResolvedValue(undefined);
    vi.setSystemTime(new Date('2026-05-26T12:00:00.000Z'));

    await mod.logToFile('INFO', 'hello');

    const written = mockWriteTextFile.mock.calls[0][1] as string;
    expect(written).toMatch(/^\[2026-05-26T12:00:00\.000Z\] \[INFO\] hello\n$/);
  });

  it('should replace %s and %d placeholders', async () => {
    mockExists.mockResolvedValue(true);
    await mod.initLogger();
    mockWriteTextFile.mockResolvedValue(undefined);
    vi.setSystemTime(new Date('2026-05-26T12:00:00.000Z'));

    await mod.logToFile('WARN', 'count=%d name=%s', 42, 'foo');

    const written = mockWriteTextFile.mock.calls[0][1] as string;
    expect(written).toContain('[WARN] count=42 name=foo');
  });

  it('should handle placeholders without args', async () => {
    mockExists.mockResolvedValue(true);
    await mod.initLogger();
    mockWriteTextFile.mockResolvedValue(undefined);
    vi.setSystemTime(new Date('2026-05-26T12:00:00.000Z'));

    await mod.logToFile('INFO', 'hello %s world');

    const written = mockWriteTextFile.mock.calls[0][1] as string;
    expect(written).toContain('hello %s world');
  });
});
