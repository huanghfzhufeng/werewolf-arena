/**
 * Webhook URL validation — SSRF prevention.
 * Blocks private IPs, localhost, and non-HTTPS URLs in production.
 */

const PRIVATE_IP_PATTERNS = [
  /^127\./,                       // loopback
  /^10\./,                        // class A private
  /^172\.(1[6-9]|2\d|3[01])\./,  // class B private
  /^192\.168\./,                  // class C private
  /^169\.254\./,                  // link-local
  /^0\./,                         // "this" network
  /^::1$/,                        // IPv6 loopback
  /^fd[0-9a-f]{2}:/i,            // IPv6 ULA
  /^fe80:/i,                      // IPv6 link-local
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",     // GCP metadata
  "instance-data",                // AWS alias
];

export type UrlValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Validate a webhook URL for safety.
 * - Must be a valid URL
 * - Must be HTTPS (skipped in dev when NODE_ENV !== "production")
 * - Must not point to private/loopback/link-local IPs
 * - Must not point to known metadata endpoints
 */
export function validateWebhookUrl(url: string): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: "Invalid URL format" };
  }

  // Protocol check — HTTPS required in production
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    return { valid: false, reason: "Webhook URL must use HTTPS" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, reason: "Webhook URL must use HTTP or HTTPS" };
  }

  // Hostname checks
  const hostname = parsed.hostname.toLowerCase();

  // Block known dangerous hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, reason: `Blocked hostname: ${hostname}` };
  }

  // Block IP addresses in private ranges
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, reason: "Webhook URL must not point to a private IP address" };
    }
  }

  // Block raw IPv6 addresses in brackets (e.g. http://[::1]/)
  if (hostname.startsWith("[")) {
    const inner = hostname.slice(1, -1);
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(inner)) {
        return { valid: false, reason: "Webhook URL must not point to a private IP address" };
      }
    }
  }

  // Block AWS metadata endpoint IP
  if (hostname === "169.254.169.254") {
    return { valid: false, reason: "Webhook URL must not point to a metadata endpoint" };
  }

  // Reasonable length check
  if (url.length > 2048) {
    return { valid: false, reason: "Webhook URL is too long (max 2048 characters)" };
  }

  return { valid: true };
}
