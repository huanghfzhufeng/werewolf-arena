import { loadConfig } from "@/config";
import { createLogger, withRetry, LLMError } from "@/lib";

const log = createLogger("LLM");

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Single raw fetch to the LLM API (no retries).
 */
async function callLLM(
  apiUrl: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<string> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new LLMError(`DeepSeek API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Call DeepSeek chat completions API (OpenAI-compatible format).
 * All defaults (model, temperature, retries, etc.) come from the config system.
 * Retries are handled by the shared `withRetry` utility.
 */
export async function chatCompletion(
  messages: LLMMessage[],
  opts?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new LLMError("DEEPSEEK_API_KEY is not set");
  }

  const cfg = loadConfig().llm;
  const body = {
    model: opts?.model ?? cfg.model,
    messages,
    temperature: opts?.temperature ?? cfg.temperature,
    max_tokens: opts?.maxTokens ?? cfg.maxTokens,
  };

  return withRetry(() => callLLM(cfg.apiUrl, apiKey, body), {
    maxRetries: cfg.maxRetries,
    retryBaseMs: cfg.retryBaseMs,
    logger: log,
    label: "LLM",
  });
}
