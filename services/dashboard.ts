import 'server-only';

import { getDateRange } from '@/lib/date/range';
import { serializeError } from '@/lib/errors/serialize-error';
import { logInfo, summarizeMarketplaceResult, summarizeRows } from '@/lib/logger/server';
import { getOzonDashboardRows } from '@/services/ozon';
import { getWbDashboardRows } from '@/services/wb';
import type {
  DashboardResponse,
  DashboardRow,
  Marketplace,
  MarketplaceFilter,
  MarketplaceRowsResult
} from '@/types/dashboard';

type DashboardOptions = {
  marketplace?: MarketplaceFilter;
  periodDays: number;
  search?: string;
};

function matchesSearch(row: DashboardRow, search: string) {
  if (!search.trim()) {
    return true;
  }

  const normalizedSearch = search.trim().toLowerCase();
  const haystack = [
    row.productName,
    row.brand,
    row.article,
    row.sku,
    row.offerId,
    row.productId?.toString(),
    row.nmId?.toString(),
    row.vendorCode
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}

function sortRows(rows: DashboardRow[]) {
  return rows.sort(
    (left, right) =>
      right.ordersTotal - left.ordersTotal ||
      (right.stock ?? 0) - (left.stock ?? 0) ||
      left.productName.localeCompare(right.productName)
  );
}

export async function getDashboardData(options: DashboardOptions): Promise<DashboardResponse> {
  const marketplace = options.marketplace ?? 'all';
  const periodDays = options.periodDays;
  const search = options.search ?? '';

  logInfo('service:dashboard', 'Aggregating dashboard data', {
    marketplace,
    periodDays,
    search
  });

  const tasks: Array<Promise<MarketplaceRowsResult>> = [];
  const order: Marketplace[] = [];

  if (marketplace === 'all' || marketplace === 'wb') {
    order.push('wb');
    tasks.push(getWbDashboardRows(periodDays));
  }

  if (marketplace === 'all' || marketplace === 'ozon') {
    order.push('ozon');
    tasks.push(getOzonDashboardRows(periodDays));
  }

  const settled = await Promise.allSettled(tasks);
  const successfulResults: MarketplaceRowsResult[] = [];
  const errors = settled.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      successfulResults.push(result.value);
      return [];
    }

    return [serializeError(result.reason, order[index])];
  });

  const rows = sortRows(
    successfulResults
      .flatMap((result) => result.rows)
      .filter((row) => matchesSearch(row, search))
  );

  logInfo('service:dashboard', 'Marketplace results collected', {
    results: successfulResults.map((result) => summarizeMarketplaceResult(result)),
    errors
  });

  logInfo('service:dashboard', 'Dashboard rows ready', {
    ...summarizeRows(rows),
    requestedMarketplace: marketplace,
    periodDays,
    search
  });

  return {
    rows,
    dates: getDateRange(periodDays).dates,
    updatedAt: new Date().toISOString(),
    meta: {
      periodDays,
      source: errors.length > 0 ? 'mixed' : 'live',
      errors
    }
  };
}
