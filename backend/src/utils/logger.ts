/**
 * Lightweight LOG_LEVEL-gated logger.
 *
 * Reads LOG_LEVEL from environment (default: 'info').
 * Levels (ascending verbosity): error (0), warn (1), info (2), debug (3).
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type LogLevel = keyof typeof LEVELS;

const currentLevel = LEVELS[
  (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel
] ?? LEVELS.info;

export const logger = {
  error(...args: unknown[]): void {
    console.error(...args);
  },
  warn(...args: unknown[]): void {
    if (currentLevel >= LEVELS.warn) console.warn(...args);
  },
  info(...args: unknown[]): void {
    if (currentLevel >= LEVELS.info) console.log(...args);
  },
  debug(...args: unknown[]): void {
    if (currentLevel >= LEVELS.debug) console.log(...args);
  },
};
