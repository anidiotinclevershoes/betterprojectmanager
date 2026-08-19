/**
 * Production-safe structured server logging.
 * Never log secrets, passwords, tokens, or full request bodies with credentials.
 */
type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const REDACT_KEYS = [
  "password",
  "token",
  "authorization",
  "cookie",
  "secret",
  "apikey",
  "api_key",
  "service_role",
  "stripe_secret",
  "webhook_secret",
  "openai",
];

function redactValue(key: string, value: unknown): unknown {
  const lower = key.toLowerCase();
  if (REDACT_KEYS.some((k) => lower.includes(k))) return "[redacted]";
  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 120)}…[truncated ${value.length} chars]`;
  }
  return value;
}

function sanitize(fields?: LogFields): LogFields | undefined {
  if (!fields) return undefined;
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = redactValue(key, value);
  }
  return out;
}

function write(level: LogLevel, message: string, fields?: LogFields) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...sanitize(fields),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const serverLog = {
  info(message: string, fields?: LogFields) {
    write("info", message, fields);
  },
  warn(message: string, fields?: LogFields) {
    write("warn", message, fields);
  },
  error(message: string, fields?: LogFields) {
    write("error", message, fields);
  },
};
