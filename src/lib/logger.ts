// Minimal structured logger used in serverless API routes.
// Keeps dependency-free and uses environment-controlled log level.
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const env = (name: string, fallback = '') => process.env[name] || fallback;
const configured = (env('LOG_LEVEL', 'info') as LogLevel) || 'info';
const currentLevel = LEVELS[configured] ?? LEVELS.info;

function shouldLog(level: LogLevel) {
  return LEVELS[level] >= currentLevel;
}

export const logger = {
  debug: (...args: any[]) => { if (shouldLog('debug')) console.debug('[debug]', ...args); },
  info: (...args: any[]) => { if (shouldLog('info')) console.info('[info]', ...args); },
  warn: (...args: any[]) => { if (shouldLog('warn')) console.warn('[warn]', ...args); },
  error: (...args: any[]) => { if (shouldLog('error')) console.error('[error]', ...args); }
};

export default logger;
