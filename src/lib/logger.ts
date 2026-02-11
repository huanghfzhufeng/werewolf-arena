type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";

export type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

/**
 * Create a tagged logger — e.g. `createLogger("Engine")` produces
 * `[Engine] some message` on every call.
 */
export function createLogger(tag: string): Logger {
  const prefix = `[${tag}]`;
  const minLevel = LOG_LEVELS[currentLevel];

  return {
    debug: (...args) => {
      if (minLevel <= LOG_LEVELS.debug) console.debug(prefix, ...args);
    },
    info: (...args) => {
      if (minLevel <= LOG_LEVELS.info) console.log(prefix, ...args);
    },
    warn: (...args) => {
      if (minLevel <= LOG_LEVELS.warn) console.warn(prefix, ...args);
    },
    error: (...args) => {
      if (minLevel <= LOG_LEVELS.error) console.error(prefix, ...args);
    },
  };
}
