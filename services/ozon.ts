import 'server-only';

import { getDateRange, toIsoDateTime } from '@/lib/date/range';
import { requireServerEnv } from '@/lib/env/server';
import { createHttpClient } from '@/lib/http/client';
import { logError, logInfo, summarizeMarketplaceResult } from '@/lib/logger/server';
import { normalizeOzonRows } from '@/lib/normalizers/ozon';
import type { MarketplaceRowsResult } from '@/types/dashboard';
import type {
  OzonProductAttributesItem,
  OzonProductListItem,
  OzonPostingItem,
  OzonPriceItem,
  OzonProductItem,
  OzonStockItem
} from '@/types/marketplaces';

type JsonRecord = Record<string, unknown>;

function createOzonClient() {
  return createHttpClient({
    baseURL: process.env.OZON_API_BASE_URL ?? 'https://api-seller.ozon.ru',
    timeout: 120_000,
    headers: {
      'Api-Key': requireServerEnv('OZON_API_KEY'),
      'Client-Id': requireServerEnv('OZON_CLIENT_ID'),
      'Content-Type': 'application/json'
    }
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function getNestedValue(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[segment];
  }, value);
}

function pickArray<T>(value: unknown, paths: string[]): T[] {
  for (const path of paths) {
    const nested = getNestedValue(value, path);

    if (Array.isArray(nested)) {
      return nested as T[];
    }
  }

  return [];
}

function pickString(value: unknown, paths: string[]): string | undefined {
  for (const path of paths) {
    const nested = getNestedValue(value, path);

    if (typeof nested === 'string' && nested.length > 0) {
      return nested;
    }
  }

  return undefined;
}

function pickBoolean(value: unknown, paths: string[]): boolean {
  for (const path of paths) {
    const nested = getNestedValue(value, path);

    if (typeof nested === 'boolean') {
      return nested;
    }
  }

  return false;
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function getPostingEndpoints() {
  const explicit = process.env.OZON_POSTING_LIST_PATHS?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (explicit && explicit.length > 0) {
    return explicit;
  }

  return [
    process.env.OZON_POSTING_LIST_PATH ?? '/v3/posting/fbs/list',
    process.env.OZON_FBO_POSTING_LIST_PATH ?? '/v2/posting/fbo/list'
  ];
}

async function fetchProductIds(): Promise<number[]> {
  const client = createOzonClient();
  const path = process.env.OZON_PRODUCT_LIST_PATH ?? '/v3/product/list';
  const productIds: number[] = [];
  let lastId = '';

  for (let page = 0; page < 20; page += 1) {
    const response = await client.post(path, {
      filter: {
        visibility: 'ALL'
      },
      last_id: lastId,
      limit: 1000
    });

    const items = pickArray<OzonProductListItem>(response.data, [
      'result.items',
      'items'
    ]);

    productIds.push(
      ...items
        .map((item) => item.product_id)
        .filter((item): item is number => typeof item === 'number')
    );

    const nextLastId = pickString(response.data, ['result.last_id', 'last_id']) ?? '';

    if (!nextLastId || items.length === 0 || nextLastId === lastId) {
      break;
    }

    lastId = nextLastId;
  }

  logInfo('service:ozon', 'Ozon product ids received', {
    endpoint: path,
    productIdsCount: productIds.length
  });

  return productIds;
}

async function fetchProducts(productIds: number[]): Promise<OzonProductItem[]> {
  if (productIds.length === 0) {
    return [];
  }

  const client = createOzonClient();
  const path = process.env.OZON_PRODUCT_INFO_LIST_PATH ?? '/v3/product/info/list';
  const batches = chunk(productIds, 1000);
  const responses = await Promise.all(
    batches.map(async (ids) => {
      const response = await client.post(path, {
        product_id: ids
      });

      return pickArray<OzonProductItem>(response.data, [
        'result.items',
        'items',
        'result.products',
        'products'
      ]);
    })
  );

  const products = responses.flat();

  logInfo('service:ozon', 'Ozon product details received', {
    endpoint: path,
    batches: batches.length,
    productsCount: products.length
  });

  return products;
}

async function fetchProductAttributes(
  productIds: number[]
): Promise<OzonProductAttributesItem[]> {
  if (productIds.length === 0) {
    return [];
  }

  const client = createOzonClient();
  const path = process.env.OZON_PRODUCT_ATTRIBUTES_PATH ?? '/v4/product/info/attributes';
  const batches = chunk(productIds, 1000);
  const responses = await Promise.all(
    batches.map(async (ids) => {
      const response = await client.post(path, {
        filter: {
          product_id: ids,
          visibility: 'ALL'
        },
        limit: ids.length,
        sort_dir: 'ASC'
      });

      return pickArray<OzonProductAttributesItem>(response.data, ['result', 'items']);
    })
  );

  const attributes = responses.flat();

  logInfo('service:ozon', 'Ozon product attributes received', {
    endpoint: path,
    batches: batches.length,
    attributesCount: attributes.length
  });

  return attributes;
}

async function fetchPrices(productIds: number[]): Promise<OzonPriceItem[]> {
  if (productIds.length === 0) {
    return [];
  }

  const client = createOzonClient();
  const path = process.env.OZON_PRICE_LIST_PATH ?? '/v5/product/info/prices';
  const batches = chunk(productIds, 1000);
  const responses = await Promise.all(
    batches.map(async (ids) => {
      const response = await client.post(path, {
        filter: {
          product_id: ids
        },
        limit: ids.length
      });

      return pickArray<OzonPriceItem>(response.data, ['items', 'result.items']);
    })
  );

  const prices = responses.flat();

  logInfo('service:ozon', 'Ozon prices received', {
    endpoint: path,
    batches: batches.length,
    pricesCount: prices.length
  });

  return prices;
}

async function fetchStocks(productIds: number[]): Promise<OzonStockItem[]> {
  if (productIds.length === 0) {
    return [];
  }

  const client = createOzonClient();
  const path = process.env.OZON_STOCK_INFO_PATH ?? '/v4/product/info/stocks';
  const batches = chunk(productIds, 1000);
  const responses = await Promise.all(
    batches.map(async (ids) => {
      const response = await client.post(path, {
        filter: {
          product_id: ids
        },
        limit: ids.length
      });

      return pickArray<OzonStockItem>(response.data, [
        'result.items',
        'items',
        'result'
      ]);
    })
  );

  const stocks = responses.flat();

  logInfo('service:ozon', 'Ozon stocks received', {
    endpoint: path,
    batches: batches.length,
    stocksCount: stocks.length
  });

  return stocks;
}

async function fetchPostingsFromEndpoint(
  path: string,
  periodDays: number
): Promise<OzonPostingItem[]> {
  const client = createOzonClient();
  const { startDate, endDate } = getDateRange(periodDays);
  const postings: OzonPostingItem[] = [];
  const limit = 1000;
  let offset = 0;

  for (let page = 0; page < 50; page += 1) {
    const response = await client.post(path, {
      dir: 'ASC',
      filter: {
        since: toIsoDateTime(startDate),
        to: toIsoDateTime(endDate, true)
      },
      limit,
      offset,
      with: {
        analytics_data: false,
        financial_data: true
      }
    });

    const items = pickArray<OzonPostingItem>(response.data, [
      'result.postings',
      'result',
      'postings'
    ]);

    postings.push(...items);

    const hasNext = pickBoolean(response.data, ['result.has_next', 'has_next']);

    if ((!hasNext && items.length < limit) || items.length === 0) {
      break;
    }

    offset += items.length;
  }

  logInfo('service:ozon', 'Ozon postings received', {
    endpoint: path,
    periodDays,
    postingsCount: postings.length
  });

  return postings;
}

async function fetchPostings(periodDays: number): Promise<OzonPostingItem[]> {
  const endpoints = Array.from(new Set(getPostingEndpoints()));
  const postingMap = new Map<string, OzonPostingItem>();

  for (const path of endpoints) {
    try {
      const items = await fetchPostingsFromEndpoint(path, periodDays);

      for (const item of items) {
        const key =
          item.posting_number ??
          (typeof item.order_id === 'number' ? String(item.order_id) : undefined) ??
          `${path}-${postingMap.size}`;

        if (!postingMap.has(key)) {
          postingMap.set(key, item);
        }
      }
    } catch (error) {
      logError('service:ozon', 'Ozon postings fetch failed', {
        endpoint: path,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  const postings = Array.from(postingMap.values());

  logInfo('service:ozon', 'Ozon postings merged', {
    periodDays,
    endpoints,
    postingsCount: postings.length
  });

  return postings;
}

export async function getOzonDashboardRows(periodDays: number): Promise<MarketplaceRowsResult> {
  logInfo('service:ozon', 'Fetching Ozon data', {
    periodDays
  });

  const productIds = await fetchProductIds();
  const [products, productAttributes] = await Promise.all([
    fetchProducts(productIds),
    fetchProductAttributes(productIds)
  ]);

  const [prices, stocks, postings] = await Promise.all([
    fetchPrices(productIds),
    fetchStocks(productIds),
    fetchPostings(periodDays)
  ]);

  const rows = normalizeOzonRows({
    products,
    productAttributes,
    prices,
    stocks,
    postings,
    periodDays
  });

  const result = {
    marketplace: 'ozon',
    rows,
    source: 'live',
    updatedAt: new Date().toISOString()
  } satisfies MarketplaceRowsResult;

  logInfo('service:ozon', 'Ozon data normalized', {
    productIdsCount: productIds.length,
    productsCount: products.length,
    productAttributesCount: productAttributes.length,
    pricesCount: prices.length,
    stocksCount: stocks.length,
    postingsCount: postings.length,
    ...summarizeMarketplaceResult(result)
  });

  return result;
}
