import 'server-only';

import { getDateRange, toIsoDateTime } from '@/lib/date/range';
import { requireServerEnv } from '@/lib/env/server';
import { createHttpClient } from '@/lib/http/client';
import { logError, logInfo, summarizeMarketplaceResult } from '@/lib/logger/server';
import { normalizeWbRows } from '@/lib/normalizers/wb';
import type { MarketplaceRowsResult } from '@/types/dashboard';
import type { WbContentCard, WbOrderItem, WbStockItem } from '@/types/marketplaces';

type WbCardDetails = {
  imageUrl?: string;
  brand?: string;
  title?: string;
};

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createWbClient() {
  return createHttpClient({
    baseURL: process.env.WB_API_BASE_URL ?? 'https://statistics-api.wildberries.ru',
    timeout: 120_000,
    headers: {
      Authorization: requireServerEnv('WB_API_TOKEN')
    }
  });
}

function createWbContentClient() {
  return createHttpClient({
    baseURL: process.env.WB_CONTENT_API_BASE_URL ?? 'https://content-api.wildberries.ru',
    timeout: 120_000,
    headers: {
      Authorization: requireServerEnv('WB_API_TOKEN')
    }
  });
}

function pickWbPrimaryPhoto(card: WbContentCard): string | undefined {
  const photo = card.photos?.[0];

  return photo?.big ?? photo?.c516x688 ?? photo?.c246x328 ?? photo?.square ?? photo?.tm;
}

async function fetchWbCardDetails(nmIds: number[]): Promise<Map<number, WbCardDetails>> {
  if (nmIds.length === 0) {
    return new Map();
  }

  const uniqueNmIds = Array.from(new Set(nmIds));
  const client = createWbContentClient();
  const detailsMap = new Map<number, WbCardDetails>();

  for (const nmId of uniqueNmIds) {
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await client.post<{ cards?: WbContentCard[] }>(
          '/content/v2/get/cards/list',
          {
            settings: {
              cursor: {
                limit: 1
              },
              filter: {
                textSearch: String(nmId),
                withPhoto: -1
              }
            }
          }
        );

        const cards = Array.isArray(response.data?.cards) ? response.data.cards : [];
        const card = cards[0];

        if (card) {
          detailsMap.set(nmId, {
            imageUrl: pickWbPrimaryPhoto(card),
            brand: card.brand,
            title: card.title
          });
        }

        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;

        if (attempt < 2) {
          await delay(250 * (attempt + 1));
        }
      }
    }

    if (lastError) {
      logError('service:wb', 'WB card details fetch failed', {
        nmId,
        message: lastError instanceof Error ? lastError.message : 'Unknown error'
      });
    }
  }

  logInfo('service:wb', 'WB card details received', {
    requestedNmIds: uniqueNmIds.length,
    detailsCount: detailsMap.size,
    imagesCount: Array.from(detailsMap.values()).filter((item) => Boolean(item.imageUrl)).length,
    brandsCount: Array.from(detailsMap.values()).filter((item) => Boolean(item.brand)).length
  });

  return detailsMap;
}

export async function getWbDashboardRows(periodDays: number): Promise<MarketplaceRowsResult> {
  const client = createWbClient();
  const { startDate } = getDateRange(periodDays);
  const dateFrom = toIsoDateTime(startDate);

  logInfo('service:wb', 'Fetching WB data', {
    periodDays,
    dateFrom
  });

  const [stocksResponse, ordersResponse] = await Promise.all([
    client.get<WbStockItem[]>('/api/v1/supplier/stocks', {
      params: { dateFrom }
    }),
    client.get<WbOrderItem[]>('/api/v1/supplier/orders', {
      params: { dateFrom }
    })
  ]);

  const stocks = Array.isArray(stocksResponse.data) ? stocksResponse.data : [];
  const orders = Array.isArray(ordersResponse.data) ? ordersResponse.data : [];
  const detailsMap = await fetchWbCardDetails(
    [...stocks.map((item) => item.nmId), ...orders.map((item) => item.nmId)].filter(
      (item): item is number => typeof item === 'number'
    )
  );

  const rows = normalizeWbRows({
    stocks,
    orders,
    detailsMap,
    periodDays
  });

  const result = {
    marketplace: 'wb',
    rows,
    source: 'live',
    updatedAt: new Date().toISOString()
  } satisfies MarketplaceRowsResult;

  logInfo('service:wb', 'WB data received', {
    periodDays,
    stocksCount: stocks.length,
    ordersCount: orders.length,
    detailsCount: detailsMap.size,
    imagesCount: Array.from(detailsMap.values()).filter((item) => Boolean(item.imageUrl)).length,
    ...summarizeMarketplaceResult(result)
  });

  return result;
}
