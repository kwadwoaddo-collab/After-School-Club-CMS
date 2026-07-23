import * as Sentry from '@sentry/nextjs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  module?: string;
  orgId?: string;
  userId?: string;
  [key: string]: unknown;
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
        lowerKey.includes('phone')
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
  log(level: LogLevel, message: string, context?: LogContext) {
    const redactedContext = context ? (redact(context) as LogContext) : undefined;
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

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  },

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  },

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  },

  error(message: string, context?: LogContext) {
    this.log('error', message, context);
  },
};
