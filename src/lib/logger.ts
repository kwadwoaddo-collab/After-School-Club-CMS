import * as Sentry from '@sentry/nextjs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  module?: string;
  orgId?: string;
  userId?: string;
  [key: string]: unknown;
}

const EMAIL_IN_STRING_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const TOKEN_QUERY_RE = /(?:^|[?&\s])token=|magicLinkToken=/i;

/**
 * Redacts PII (email addresses) and URL token query parameters from free-text
 * strings without wiping scoped npm package frames (`@scope/pkg`) or SQL
 * column identifiers (`magic_link_token`).
 */
function redactString(str: string): string {
  if (TOKEN_QUERY_RE.test(str)) {
    return '[REDACTED_TOKEN_URL]';
  }
  return str.replace(EMAIL_IN_STRING_RE, '[REDACTED_EMAIL]');
}

/**
 * Every call site in this codebase logs like `logger.error('message', err)`
 * or `logger.error('message', someValue)` — i.e. treats the second argument
 * the way `console.error(message, ...args)` works, not as a structured
 * `LogContext` object.
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

  return { detail: context };
}

// Recursive PII Redactor
function redact(obj: unknown): unknown {
  if (!obj) return obj;
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return redactString(obj);
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
    const safeMessage = typeof message === 'string' ? redactString(message) : String(message);
    const normalizedContext = normalizeContext(context);
    const redactedContext = normalizedContext ? (redact(normalizedContext) as LogContext) : undefined;
    const logData = {
      timestamp: new Date().toISOString(),
      level,
      message: safeMessage,
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
      console.log(`${color}[${level.toUpperCase()}]${reset} ${safeMessage}${contextStr}`);
    }

    // Forward warnings and errors to Sentry with redacted message
    if (level === 'error') {
      Sentry.captureMessage(safeMessage, {
        level: 'error',
        extra: redactedContext,
      });
    } else if (level === 'warn') {
      Sentry.captureMessage(safeMessage, {
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
