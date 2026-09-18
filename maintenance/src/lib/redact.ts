import { createHash } from 'crypto';

/**
 * Secret redaction utility.
 * Sanitizes connection strings, API keys, tokens, and dynamically redacts
 * all values present in the current process.env that look like secrets.
 */

const SECRET_ENV_KEY_PATTERNS = [
  /SECRET/i,
  /KEY/i,
  /TOKEN/i,
  /PASSWORD/i,
  /PASS/i,
  /AUTH/i,
  /URL/i,
  /DATABASE/i,
  /POSTGRES/i,
  /STRIPE/i,
  /RESEND/i,
  /CRON/i,
  /PRIVATE/i
];

/**
 * Extract known secrets from environment variables dynamically.
 */
function getKnownSecretValues(): string[] {
  const secrets: string[] = [];
  for (const [key, value] of Object.entries(process.env)) {
    if (!value || typeof value !== 'string' || value.trim().length < 6) {
      continue;
    }
    const isSensitiveKey = SECRET_ENV_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitiveKey) {
      secrets.push(value.trim());
    }
  }
  // Sort longest first to avoid partial replacement of substrings
  return secrets.sort((a, b) => b.length - a.length);
}

const REGEX_DATABASE_URL = /(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@.+)/gi;
const REGEX_STRIPE_KEY = /(?:sk|pk|rk)_(?:live|test)_[0-9a-zA-Z]{20,}/g;
const REGEX_RESEND_KEY = /re_[0-9a-zA-Z]{20,}/g;
const REGEX_BEARER_TOKEN = /Bearer\s+[A-Za-z0-9\-_.]+/gi;
const REGEX_JWT = /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g;

export function redactText(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let result = text;

  // 1. Redact database URL credentials: postgres://user:password@host -> postgres://user:[REDACTED]@host
  result = result.replace(REGEX_DATABASE_URL, (_match, prefix, _password, suffix) => {
    return `${prefix}[REDACTED]${suffix}`;
  });

  // 2. Specific API key formats
  result = result.replace(REGEX_STRIPE_KEY, '[STRIPE_KEY_REDACTED]');
  result = result.replace(REGEX_RESEND_KEY, '[RESEND_KEY_REDACTED]');
  result = result.replace(REGEX_BEARER_TOKEN, 'Bearer [REDACTED_TOKEN]');
  result = result.replace(REGEX_JWT, '[JWT_REDACTED]');

  // 3. Dynamic replacement of env secrets
  const knownSecrets = getKnownSecretValues();
  for (const secret of knownSecrets) {
    if (secret && result.includes(secret)) {
      result = result.split(secret).join('[REDACTED_SECRET]');
    }
  }

  return result;
}

export function redactObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return redactText(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string') {
        copy[k] = redactText(v);
      } else {
        copy[k] = redactObject(v);
      }
    }
    return copy as unknown as T;
  }
  return obj;
}

export function createStableFingerprint(code: string, discriminator: string): string {
  const hash = createHash('sha256').update(discriminator).digest('hex').slice(0, 8);
  return `${code}:${hash}`;
}
