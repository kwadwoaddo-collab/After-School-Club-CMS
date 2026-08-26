import * as Sentry from '@sentry/nextjs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  module?: string;
  orgId?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Every call site in this codebase logs like `logger.error('message', err)`
 * or `logger.error('message', someValue)` — i.e. treats the second argument
 * the way `console.error(message, ...args)` works, not as a structured
 * `LogContext` object. That is the actual, consistent calling convention
 * (see architecture-decisions.md, "Logger context typing"), so the public
 * signature accepts it directly instead of requiring ~350 call sites to be
 * rewritten to fit a shape nothing actually uses.
 *
 * normalizeContext turns whatever was passed into a LogContext for `log()`
 * to redact/serialize. This also fixes a real runtime bug, not just a type
 * mismatch: `Error` instances have non-enumerable `message`/`stack`
 * properties (`JSON.stringify(new Error('x'))` is `"{}"`), so every prior
 * `logger.error('msg', someError)` call was silently logging an empty
 * object and forwarding no error detail to Sentry's `extra`. Every other
 * non-object value (a string, a number, an array, a caught `unknown`) hit
 * the same problem — `...redactedContext` spreads nothing useful from a
 * non-plain-object. This wraps those cases so the detail is actually kept.
 */
function normalizeContext(context: unknown): LogContext | undefined {
  if (context === undefined || context === null) return undefined;

  if (context instanceof Error) {
    return {
      errorName: context.name,
      errorMessage: context.message,
      stack: context.stack,
    };
  }

  if (typeof context === 'object' && !Array.isArray(context)) {
    return context as LogContext;
  }

  // Primitives, arrays, or a caught `unknown` that isn't an Error instance
  // (e.g. a thrown string) — wrap so it's still captured instead of
  // silently dropped by the `...redactedContext` spread below.
  return { detail: context };
}

// Recursive PII Redactor
function redact(obj: unknown): unknown {
  if (!obj) return obj;
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      // Redact email-like strings
      if (obj.includes('@') && obj.includes('.')) {
        return '[REDACTED_EMAIL]';
      }
      // Redact magic links / authorization tokens
      if (obj.includes('token=') || obj.includes('magic_link_token') || obj.includes('magicLinkToken')) {
        return '[REDACTED_TOKEN_URL]';
      }
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redact);
  }

  const result: Record<string, unknown> = {};
  const record = obj as Record<string, unknown>;
  for (const key in record) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const val = record[key];
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('email') ||
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('key') ||
        lowerKey.includes('phone') ||
        lowerKey.includes('url') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('cookie') ||
        lowerKey.includes('host')
      ) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redact(val);
      }
    }
  }
  return result;
}

export const logger = {
  log(level: LogLevel, message: string, context?: unknown) {
    const normalizedContext = normalizeContext(context);
    const redactedContext = normalizedContext ? (redact(normalizedContext) as LogContext) : undefined;
    const logData = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...redactedContext,
    };

    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logData));
    } else {
      const colorMap = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
      };
      const reset = '\x1b[0m';
      const color = colorMap[level] || reset;
      const contextStr = redactedContext ? ` ${JSON.stringify(redactedContext)}` : '';
      console.log(`${color}[${level.toUpperCase()}]${reset} ${message}${contextStr}`);
    }

    // Forward warnings and errors to Sentry
    if (level === 'error') {
      Sentry.captureMessage(message, {
        level: 'error',
        extra: redactedContext,
      });
    } else if (level === 'warn') {
      Sentry.captureMessage(message, {
        level: 'warning',
        extra: redactedContext,
      });
    }
  },

  debug(message: string, context?: unknown) {
    this.log('debug', message, context);
  },

  info(message: string, context?: unknown) {
    this.log('info', message, context);
  },

  warn(message: string, context?: unknown) {
    this.log('warn', message, context);
  },

  error(message: string, context?: unknown) {
    this.log('error', message, context);
  },
};
