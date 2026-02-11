/**
 * Base error class for all Werewolf Arena errors.
 */
export class WerewolfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WerewolfError";
  }
}

/**
 * Thrown when an LLM API call fails after all retries.
 */
export class LLMError extends WerewolfError {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}
