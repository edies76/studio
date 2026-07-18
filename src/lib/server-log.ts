/**
 * Server-only structured logs (never ship to browser).
 * Usage: slog('chat', 'tool.start', { name, id })
 */

import 'server-only';

type Level = 'info' | 'warn' | 'error' | 'debug';

function line(level: Level, scope: string, msg: string, data?: unknown) {
  const ts = new Date().toISOString();
  const base = `[studio][${ts}][${level}][${scope}] ${msg}`;
  if (data !== undefined) {
    try {
      console[level === 'debug' ? 'log' : level](base, JSON.stringify(data));
    } catch {
      console[level === 'debug' ? 'log' : level](base, data);
    }
  } else {
    console[level === 'debug' ? 'log' : level](base);
  }
}

export const slog = {
  info: (scope: string, msg: string, data?: unknown) => line('info', scope, msg, data),
  warn: (scope: string, msg: string, data?: unknown) => line('warn', scope, msg, data),
  error: (scope: string, msg: string, data?: unknown) => line('error', scope, msg, data),
  debug: (scope: string, msg: string, data?: unknown) => line('debug', scope, msg, data),
};
