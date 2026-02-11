import fs from "fs";
import path from "path";
import { GameConfigSchema, type GameConfig } from "./schema";
import { createLogger } from "@/lib";

const log = createLogger("Config");

const CONFIG_FILENAME = "game-config.json";

let _config: GameConfig | null = null;

/**
 * Load and validate game configuration.
 *
 * Reads an optional `game-config.json` from the project root.
 * Missing file → all defaults from the Zod schema are used.
 * Invalid file → throws with validation errors.
 */
export function loadConfig(): GameConfig {
  if (_config) return _config;

  const filePath = path.join(process.cwd(), CONFIG_FILENAME);
  let raw: Record<string, unknown> = {};

  if (fs.existsSync(filePath)) {
    try {
      const text = fs.readFileSync(filePath, "utf-8");
      raw = JSON.parse(text) as Record<string, unknown>;
      log.info(`Loaded ${CONFIG_FILENAME}`);
    } catch (err) {
      throw new Error(
        `[Config] Failed to parse ${filePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  } else {
    log.info("No game-config.json found — using defaults.");
  }

  const result = GameConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`[Config] Invalid configuration:\n${issues}`);
  }

  _config = result.data;
  return _config;
}

/** Reset cached config (useful for testing). */
export function resetConfig(): void {
  _config = null;
}
