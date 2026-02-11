import type { Logger } from "./logger";

export type RetryOpts = {
  /** Maximum number of retries (0 = no retries, just the initial attempt) */
  maxRetries: number;
  /** Base backoff in ms (doubled each retry) */
  retryBaseMs: number;
  /** Optional logger for retry diagnostics */
  logger?: Logger;
  /** Label for log messages */
  label?: string;
};

/**
 * Run an async function with exponential-backoff retries.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoff = opts.retryBaseMs * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, backoff));
        opts.logger?.warn(
          `${opts.label ?? "Retry"} attempt ${attempt}/${opts.maxRetries}...`
        );
      }
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      opts.logger?.error(
        `${opts.label ?? "Call"} attempt ${attempt + 1} failed:`,
        lastError.message
      );
    }
  }

  throw lastError ?? new Error(`${opts.label ?? "Call"} failed after retries`);
}

/**
 * Wrap a promise with a timeout. Rejects if not resolved within `ms`.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = "Operation"
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}
