import { writeTextFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';

const LOG_DIR = 'logs';

let initialized = false;

function getLogFileName(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}.log`;
}

function formatLine(level: string, msg: string, ...args: any[]): string {
  const timestamp = new Date().toISOString();
  let formatted = msg;
  if (args.length > 0) {
    let i = 0;
    formatted = msg.replace(/%[sdifo]/g, () => {
      const val = args[i++];
      return val !== undefined ? String(val) : '';
    });
  }
  return `[${timestamp}] [${level}] ${formatted}\n`;
}

async function ensureLogDir(): Promise<void> {
  if (!(await exists(LOG_DIR, { baseDir: BaseDirectory.AppData }))) {
    await mkdir(LOG_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  }
}

export async function initLogger(): Promise<void> {
  if (initialized) return;
  try {
    await ensureLogDir();
    initialized = true;
  } catch {
    // Running outside Tauri — silent fallback
  }
}

export async function logToFile(level: string, msg: string, ...args: any[]): Promise<void> {
  if (!initialized) {
    console.log(`[Logger]`, msg, ...args);
    return;
  }
  try {
    const line = formatLine(level, msg, ...args);
    await writeTextFile(`${LOG_DIR}/${getLogFileName()}`, line, {
      baseDir: BaseDirectory.AppData,
      append: true,
    });
  } catch {
    // File write failed — swallow
  }
}

export const tauriLogger = {
  info: (msg: string, ...args: any[]) => logToFile('INFO', msg, ...args),
  warn: (msg: string, ...args: any[]) => logToFile('WARN', msg, ...args),
  error: (msg: string, ...args: any[]) => logToFile('ERROR', msg, ...args),
};
