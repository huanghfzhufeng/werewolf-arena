import { loadConfig } from "@/config";
import { createLogger } from "@/lib";

const log = createLogger("Embeddings");

/**
 * Generate an embedding vector for the given text.
 * Returns null if embedding is disabled or fails (graceful degradation).
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const cfg = loadConfig().memory;
  if (cfg.embeddingProvider === "disabled") return null;

  const apiKey = process.env.OPENAI_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    log.warn("No embedding API key found, skipping embedding");
    return null;
  }

  try {
    const response = await fetch(cfg.embeddingApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.embeddingModel,
        input: text.slice(0, 8000), // cap input length
      }),
    });

    if (!response.ok) {
      log.warn(`Embedding API error (${response.status}), skipping`);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding ?? null;
  } catch (err) {
    log.warn("Embedding generation failed, degrading to FTS-only:", err);
    return null;
  }
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
