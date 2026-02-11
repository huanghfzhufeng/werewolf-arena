import { randomBytes } from "crypto";

/** Generate a prefixed API key: wwa_sk_<32 hex chars> */
export function generateAgentApiKey(): string {
  return `wwa_sk_${randomBytes(16).toString("hex")}`;
}

/** Generate a prefixed owner API key: wwa_owner_<32 hex chars> */
export function generateOwnerApiKey(): string {
  return `wwa_owner_${randomBytes(16).toString("hex")}`;
}
