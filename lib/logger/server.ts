import 'server-only';

import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import type { DashboardRow, MarketplaceRowsResult } from '@/types/dashboard';

type LogMeta = Record<string, unknown>;

function stringifyMeta(meta?: LogMeta) {
  if (!meta) {
    return '';
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ' {"meta":"[unserializable]"}';
  }
}

function write(level: 'INFO' | 'ERROR', scope: string, message: string, meta?: LogMeta) {
  const line = `[${new Date().toISOString()}] [${level}] [${scope}] ${message}${stringifyMeta(meta)}`;

  try {
    const logsDir = path.join(process.cwd(), 'logs');
    mkdirSync(logsDir, { recursive: true });
    appendFileSync(path.join(logsDir, 'dashboard.log'), `${line}\n`, 'utf8');
  } catch {
    // File logging is best-effort; console logging must still work.
  }

  if (level === 'ERROR') {
    console.error(line);
    return;
  }

  console.info(line);
}

export function logInfo(scope: string, message: string, meta?: LogMeta) {
  write('INFO', scope, message, meta);
}

export function logError(scope: string, message: string, meta?: LogMeta) {
  write('ERROR', scope, message, meta);
}

export function summarizeRows(rows: DashboardRow[]) {
  const firstRow = rows[0];

  return {
    rowCount: rows.length,
    hasData: rows.length > 0,
    sample: firstRow
      ? {
          marketplace: firstRow.marketplace,
          productKey: firstRow.productKey,
          productName: firstRow.productName,
          ordersTotal: firstRow.ordersTotal
        }
      : null
  };
}

export function summarizeMarketplaceResult(result: MarketplaceRowsResult) {
  return {
    marketplace: result.marketplace,
    source: result.source,
    updatedAt: result.updatedAt,
    ...summarizeRows(result.rows)
  };
}
