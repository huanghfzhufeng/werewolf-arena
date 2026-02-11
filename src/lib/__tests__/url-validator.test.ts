import { describe, it, expect } from "vitest";
import { validateWebhookUrl } from "../url-validator";

describe("validateWebhookUrl", () => {
  it("accepts valid HTTPS URL", () => {
    expect(validateWebhookUrl("https://example.com/webhook")).toEqual({ valid: true });
  });

  it("accepts HTTP URL in non-production", () => {
    expect(validateWebhookUrl("http://example.com/webhook")).toEqual({ valid: true });
  });

  it("rejects invalid URL format", () => {
    const result = validateWebhookUrl("not-a-url");
    expect(result.valid).toBe(false);
  });

  it("rejects ftp protocol", () => {
    const result = validateWebhookUrl("ftp://example.com/file");
    expect(result.valid).toBe(false);
  });

  it("blocks localhost", () => {
    const result = validateWebhookUrl("http://localhost:3000/hook");
    expect(result.valid).toBe(false);
  });

  it("blocks 127.x.x.x", () => {
    const result = validateWebhookUrl("http://127.0.0.1/hook");
    expect(result.valid).toBe(false);
  });

  it("blocks 10.x.x.x private IP", () => {
    const result = validateWebhookUrl("http://10.0.0.1/hook");
    expect(result.valid).toBe(false);
  });

  it("blocks 192.168.x.x private IP", () => {
    const result = validateWebhookUrl("http://192.168.1.1/hook");
    expect(result.valid).toBe(false);
  });

  it("blocks 169.254.169.254 metadata endpoint", () => {
    const result = validateWebhookUrl("http://169.254.169.254/latest/meta-data/");
    expect(result.valid).toBe(false);
  });

  it("blocks metadata.google.internal", () => {
    const result = validateWebhookUrl("http://metadata.google.internal/computeMetadata/v1/");
    expect(result.valid).toBe(false);
  });

  it("rejects URLs longer than 2048 characters", () => {
    const longUrl = "https://example.com/" + "a".repeat(2048);
    const result = validateWebhookUrl(longUrl);
    expect(result.valid).toBe(false);
  });
});
