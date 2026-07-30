/**
 * Measured token counting via js-tiktoken (cl100k_base).
 * Development / measurement only — never used as a pricing estimate.
 */
import { getEncoding } from "js-tiktoken";

let encoder: ReturnType<typeof getEncoding> | null = null;

function getEncoder() {
  if (!encoder) {
    encoder = getEncoding("cl100k_base");
  }
  return encoder;
}

/** Count tokens with the OpenAI cl100k_base tokenizer. */
export function countTokens(text: string): number {
  if (!text) return 0;
  try {
    return getEncoder().encode(text).length;
  } catch {
    // Fail closed: do not invent a fallback estimate for Cockpit metrics.
    throw new Error("Tokenizer failed while measuring prompt tokens");
  }
}

export function countCharacters(text: string): number {
  return text.length;
}
