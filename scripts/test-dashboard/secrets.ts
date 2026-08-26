/** Strip credential-shaped values from dashboard text. Test-only. */

const SECRET_KEY =
  /(api[_-]?key|secret|token|password|authorization|bearer|private[_-]?key|credential)/i;

const SECRET_VALUE_SOURCE =
  String.raw`\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b`;

export function looksLikeSecretKey(key: string): boolean {
  return SECRET_KEY.test(key);
}

export function redactSecrets(value: string): string {
  return value.replace(new RegExp(SECRET_VALUE_SOURCE, "g"), "[redacted]");
}

export function scrubUnknown(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[truncated]";
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map((item) => scrubUnknown(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (looksLikeSecretKey(key)) {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = scrubUnknown(nested, depth + 1);
    }
    return out;
  }
  return value;
}

export function containsSecret(payload: string): boolean {
  return new RegExp(SECRET_VALUE_SOURCE).test(payload);
}

export function assertNoSecrets(payload: string): void {
  if (containsSecret(payload)) {
    throw new Error("Dashboard output contained a secret-shaped value.");
  }
}
