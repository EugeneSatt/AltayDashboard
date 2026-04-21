import { getDateRange, getOrderDateKey } from '@/lib/date/range';
import type { DashboardRow } from '@/types/dashboard';
import type { WbOrderItem, WbStockItem } from '@/types/marketplaces';

type WbCardDetails = {
  imageUrl?: string;
  brand?: string;
  title?: string;
};

type WbAccumulator = {
  marketplace: 'wb';
  productKey: string;
  productName: string;
  imageUrl?: string;
  brand?: string;
  article?: string;
  sku?: string;
  nmId?: number;
  vendorCode?: string;
  stock: number | null;
  price: number | null;
  currency: string | null;
  updatedAt: string;
  ordersMap: Map<string, number>;
  priceSumMap: Map<string, number>;
  priceWithSppSumMap: Map<string, number>;
};

function buildProductKey(stock?: WbStockItem, order?: WbOrderItem) {
  const nmId = stock?.nmId ?? order?.nmId;
  const article = stock?.supplierArticle ?? order?.supplierArticle;
  const barcode = stock?.barcode ?? order?.barcode;

  return `wb:${nmId ?? article ?? barcode ?? 'unknown'}`;
}

function getDisplayName(stock?: WbStockItem, order?: WbOrderItem, details?: WbCardDetails) {
  return (
    details?.title ??
    stock?.subject ??
    order?.subject ??
    stock?.brand ??
    order?.brand ??
    'Unnamed WB product'
  );
}

function ensureAccumulator(
  map: Map<string, WbAccumulator>,
  productKey: string,
  details?: WbCardDetails,
  stock?: WbStockItem,
  order?: WbOrderItem
) {
  const existing = map.get(productKey);

  if (existing) {
    existing.imageUrl = details?.imageUrl ?? existing.imageUrl;
    existing.brand = details?.brand ?? stock?.brand ?? order?.brand ?? existing.brand;
    existing.productName =
      details?.title ??
      existing.productName ??
      getDisplayName(stock, order, details);

    return existing;
  }

  const next: WbAccumulator = {
    marketplace: 'wb',
    productKey,
    productName: getDisplayName(stock, order, details),
    imageUrl: details?.imageUrl,
    brand: details?.brand ?? stock?.brand ?? order?.brand,
    article: stock?.supplierArticle ?? order?.supplierArticle,
    sku: stock?.barcode ?? order?.barcode,
    nmId: stock?.nmId ?? order?.nmId,
    vendorCode: stock?.supplierArticle ?? order?.supplierArticle,
    stock: stock?.quantity ?? null,
    price:
      stock?.discountedPrice ??
      order?.priceWithDisc ??
      stock?.Price ??
      order?.totalPrice ??
      null,
    currency: 'RUB',
    updatedAt:
      stock?.lastChangeDate ?? order?.lastChangeDate ?? order?.date ?? new Date().toISOString(),
    ordersMap: new Map(),
    priceSumMap: new Map(),
    priceWithSppSumMap: new Map()
  };

  map.set(productKey, next);
  return next;
}

export function normalizeWbRows(params: {
  stocks: WbStockItem[];
  orders: WbOrderItem[];
  detailsMap?: Map<number, WbCardDetails>;
  periodDays: number;
}): DashboardRow[] {
  const { stocks, orders, detailsMap, periodDays } = params;
  const dates = getDateRange(periodDays).dates;
  const rows = new Map<string, WbAccumulator>();

  for (const stock of stocks) {
    const details =
      typeof stock.nmId === 'number' ? detailsMap?.get(stock.nmId) : undefined;
    const productKey = buildProductKey(stock);
    const accumulator = ensureAccumulator(rows, productKey, details, stock);
    accumulator.stock = stock.quantity ?? accumulator.stock;
    accumulator.price = stock.discountedPrice ?? stock.Price ?? accumulator.price;
    accumulator.updatedAt = stock.lastChangeDate ?? accumulator.updatedAt;
  }

  for (const order of orders) {
    if (order.isCancel) {
      continue;
    }

    const details =
      typeof order.nmId === 'number' ? detailsMap?.get(order.nmId) : undefined;
    const productKey = buildProductKey(undefined, order);
    const accumulator = ensureAccumulator(rows, productKey, details, undefined, order);
    const dateKey = getOrderDateKey(order.date ?? order.lastChangeDate);

    if (!dateKey) {
      continue;
    }

    const current = accumulator.ordersMap.get(dateKey) ?? 0;
    const quantity = order.quantity ?? 1;
    accumulator.ordersMap.set(dateKey, current + quantity);

    if (typeof order.priceWithDisc === 'number') {
      const currentPriceSum = accumulator.priceSumMap.get(dateKey) ?? 0;
      accumulator.priceSumMap.set(dateKey, currentPriceSum + order.priceWithDisc * quantity);
    }

    if (typeof order.finishedPrice === 'number') {
      const currentPriceWithSppSum = accumulator.priceWithSppSumMap.get(dateKey) ?? 0;
      accumulator.priceWithSppSumMap.set(
        dateKey,
        currentPriceWithSppSum + order.finishedPrice * quantity
      );
    }
  }

  return Array.from(rows.values())
    .map((row) => {
      const ordersByDay = dates.map((date) => ({
        date,
        count: row.ordersMap.get(date) ?? 0
      }));
      const priceByDay = dates.map((date, index) => {
        const count = ordersByDay[index]?.count ?? 0;
        const amount = row.priceSumMap.get(date);

        return {
          date,
          amount: count > 0 && typeof amount === 'number' ? amount / count : null
        };
      });
      const priceWithSppByDay = dates.map((date, index) => {
        const count = ordersByDay[index]?.count ?? 0;
        const amount = row.priceWithSppSumMap.get(date);

        return {
          date,
          amount: count > 0 && typeof amount === 'number' ? amount / count : null
        };
      });

      return {
        marketplace: row.marketplace,
        productKey: row.productKey,
        productName: row.productName,
        imageUrl: row.imageUrl,
        brand: row.brand,
        article: row.article,
        sku: row.sku,
        nmId: row.nmId,
        vendorCode: row.vendorCode,
        stock: row.stock,
        price: row.price,
        currency: row.currency,
        ordersByDay,
        priceByDay,
        priceWithSppByDay,
        ordersTotal: ordersByDay.reduce((sum, item) => sum + item.count, 0),
        updatedAt: row.updatedAt
      } satisfies DashboardRow;
    })
    .sort(
      (left, right) =>
        right.ordersTotal - left.ordersTotal ||
        left.productName.localeCompare(right.productName)
    );
}
