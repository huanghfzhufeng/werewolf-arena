/**
 * In-memory sliding-window rate limiter.
 * Lightweight — no external dependencies. Swap for Redis in production if needed.
 */

type WindowEntry = { count: number; windowStart: number };

const buckets = new Map<string, WindowEntry>();

// Periodic cleanup of stale entries (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of buckets) {
    if (now - entry.windowStart > windowMs * 2) {
      buckets.delete(key);
    }
  }
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Check and consume one request against a rate limit.
 *
 * @param key    Unique identifier (e.g. IP address, agent ID)
 * @param limit  Max requests allowed within the window
 * @param windowMs  Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  cleanup(windowMs);

  const entry = buckets.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil(
      (entry.windowStart + windowMs - now) / 1000
    );
    return { allowed: false, retryAfterSeconds: Math.max(retryAfter, 1) };
  }

  entry.count++;
  return { allowed: true };
}

// ─── Preset helpers ─────────────────────────────────────────────

const ONE_HOUR_MS = 60 * 60 * 1000;

/** Register endpoint: 10 requests per hour per IP */
export function checkRegisterLimit(ip: string): RateLimitResult {
  return checkRateLimit(`register:${ip}`, 10, ONE_HOUR_MS);
}

/** Heartbeat endpoint: 60 requests per hour per agent */
export function checkHeartbeatLimit(agentId: string): RateLimitResult {
  return checkRateLimit(`heartbeat:${agentId}`, 60, ONE_HOUR_MS);
}

/** Owner register endpoint: 5 requests per hour per IP */
export function checkOwnerRegisterLimit(ip: string): RateLimitResult {
  return checkRateLimit(`owner_register:${ip}`, 5, ONE_HOUR_MS);
}

/** Public API endpoints (leaderboard, profile): 120 requests per minute per IP */
export function checkPublicApiLimit(ip: string): RateLimitResult {
  return checkRateLimit(`public:${ip}`, 120, 60_000);
}

/** For testing: clear all rate limit state */
export function _resetAll(): void {
  buckets.clear();
}
