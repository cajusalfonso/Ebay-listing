import { pino, type Logger, type LoggerOptions } from 'pino';
import { getCorrelationId } from './correlation';

export type { Logger } from 'pino';

export interface CreateLoggerOptions {
  readonly level?: LoggerOptions['level'];
  readonly pretty?: boolean;
}

/**
 * Build the root logger. `pretty=true` pipes through pino-pretty for development
 * readability; in production we emit JSON for ingestion. The logger injects a
 * `correlationId` field from AsyncLocalStorage on every log call, so downstream
 * modules do not need to thread the id through manually.
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const level = options.level ?? 'info';
  const usePretty = options.pretty ?? process.env.NODE_ENV === 'development';

  const base: LoggerOptions = {
    level,
    base: { pid: process.pid },
    mixin: () => {
      const correlationId = getCorrelationId();
      return correlationId ? { correlationId } : {};
    },
  };

  if (usePretty) {
    return pino({
      ...base,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:HH:MM:ss.l',
        },
      },
    });
  }
  return pino(base);
}
