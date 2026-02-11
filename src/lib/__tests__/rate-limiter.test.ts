import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, checkRegisterLimit, checkHeartbeatLimit, _resetAll } from "../rate-limiter";

beforeEach(() => {
  _resetAll();
});

describe("checkRateLimit", () => {
  it("allows requests within limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("key1", 5, 60_000).allowed).toBe(true);
    }
  });

  it("blocks requests exceeding limit", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("key2", 5, 60_000);
    }
    const result = checkRateLimit("key2", 5, 60_000);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("different keys are independent", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("a", 5, 60_000);
    }
    expect(checkRateLimit("a", 5, 60_000).allowed).toBe(false);
    expect(checkRateLimit("b", 5, 60_000).allowed).toBe(true);
  });
});

describe("preset helpers", () => {
  it("checkRegisterLimit allows up to 10 per hour", () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRegisterLimit("1.2.3.4").allowed).toBe(true);
    }
    expect(checkRegisterLimit("1.2.3.4").allowed).toBe(false);
  });

  it("checkHeartbeatLimit allows up to 60 per hour", () => {
    for (let i = 0; i < 60; i++) {
      expect(checkHeartbeatLimit("agent-1").allowed).toBe(true);
    }
    expect(checkHeartbeatLimit("agent-1").allowed).toBe(false);
  });
});
