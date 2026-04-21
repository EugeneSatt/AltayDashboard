import { getDateRange, getOrderDateKey } from '@/lib/date/range';
import type { DashboardRow } from '@/types/dashboard';
import type {
  OzonProductAttributesItem,
  OzonPostingItem,
  OzonPriceItem,
  OzonProductItem,
  OzonStockItem
} from '@/types/marketplaces';

type OzonAccumulator = {
  marketplace: 'ozon';
  productKey: string;
  productName: string;
  imageUrl?: string;
  brand?: string;
  article?: string;
  sku?: string;
  offerId?: string;
  productId?: number;
  stock: number | null;
  price: number | null;
  currency: string | null;
  updatedAt: string;
  ordersMap: Map<string, number>;
  priceSumMap: Map<string, number>;
  priceWithSppSumMap: Map<string, number>;
};

type ProductLookup = {
  productId?: number;
  offerId?: string;
  sku?: string;
};

type OzonPostingProduct = NonNullable<OzonPostingItem['products']>[number];

type OzonFinancialProduct = NonNullable<
  NonNullable<OzonPostingItem['financial_data']>['products']
>[number];

function resolveProductKey(input: ProductLookup) {
  return `ozon:${input.productId ?? input.offerId ?? input.sku ?? 'unknown'}`;
}

function buildAliasKeys(input: ProductLookup) {
  const keys: string[] = [];

  if (typeof input.productId === 'number') {
    keys.push(`productId:${input.productId}`);
  }

  if (input.offerId) {
    keys.push(`offerId:${input.offerId}`);
  }

  if (input.sku) {
    keys.push(`sku:${input.sku}`);
  }

  return keys;
}

function createAccumulator(product: OzonProductItem): OzonAccumulator {
  const productId = product.product_id ?? product.id;
  const productBarcode =
    product.barcodes?.[0] ??
    (Array.isArray(product.barcode) ? product.barcode[0] : product.barcode);
  const sku = product.sku ?? productBarcode;

  return {
    marketplace: 'ozon',
    productKey: resolveProductKey({
      productId,
      offerId: product.offer_id,
      sku: sku ? String(sku) : undefined
    }),
    productName: product.name ?? product.title ?? 'Unnamed Ozon product',
    imageUrl: Array.isArray(product.primary_image)
      ? product.primary_image[0]
      : product.primary_image,
    brand: undefined,
    article: product.offer_id,
    sku: sku ? String(sku) : undefined,
    offerId: product.offer_id,
    productId,
    stock: null,
    price: null,
    currency: 'RUB',
    updatedAt: new Date().toISOString(),
    ordersMap: new Map(),
    priceSumMap: new Map(),
    priceWithSppSumMap: new Map()
  };
}

function extractOzonBrand(item?: OzonProductAttributesItem) {
  const brandAttribute = item?.attributes?.find((attribute) => attribute.id === 85);
  return brandAttribute?.values?.[0]?.value;
}

function inferBrandFromName(name: string | undefined, knownBrands: string[]) {
  if (!name) {
    return undefined;
  }

  const normalizedName = name.trim().toLowerCase();

  const knownBrand = knownBrands.find((brand) =>
    normalizedName.startsWith(brand.trim().toLowerCase())
  );

  if (knownBrand) {
    return knownBrand;
  }

  const tokens = name
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}-]+$/gu, ''))
    .filter(Boolean);

  if (tokens.length === 0) {
    return undefined;
  }

  const first = tokens[0];
  const second = tokens[1];
  const latinTitlePair =
    first &&
    second &&
    /^[A-Za-z][A-Za-z-]*$/.test(first) &&
    /^[A-Za-z][A-Za-z-]*$/.test(second) &&
    first[0] === first[0].toUpperCase() &&
    second[0] === second[0].toUpperCase();

  if (latinTitlePair) {
    return `${first} ${second}`;
  }

  return first;
}

function registerAliases(
  aliasIndex: Map<string, string>,
  accumulator: OzonAccumulator,
  lookup: ProductLookup
) {
  for (const key of buildAliasKeys({
    productId: lookup.productId ?? accumulator.productId,
    offerId: lookup.offerId ?? accumulator.offerId,
    sku: lookup.sku ?? accumulator.sku
  })) {
    aliasIndex.set(key, accumulator.productKey);
  }
}

function createFallbackAccumulator(lookup: ProductLookup & { name?: string }) {
  return createAccumulator({
    product_id: lookup.productId,
    offer_id: lookup.offerId,
    name: lookup.name,
    sku: lookup.sku
  });
}

function findOrCreateAccumulator(params: {
  rows: Map<string, OzonAccumulator>;
  aliasIndex: Map<string, string>;
  lookup: ProductLookup & { name?: string };
}) {
  const { rows, aliasIndex, lookup } = params;

  for (const aliasKey of buildAliasKeys(lookup)) {
    const matchedProductKey = aliasIndex.get(aliasKey);

    if (matchedProductKey) {
      const matched = rows.get(matchedProductKey);

      if (matched) {
        registerAliases(aliasIndex, matched, lookup);
        return matched;
      }
    }
  }

  const next = createFallbackAccumulator(lookup);
  rows.set(next.productKey, next);
  registerAliases(aliasIndex, next, lookup);
  return next;
}

function isCancelledPosting(posting: OzonPostingItem) {
  return posting.status === 'cancelled';
}

function findFinancialProduct(
  posting: OzonPostingItem,
  product: OzonPostingProduct,
  index: number
): OzonFinancialProduct | undefined {
  const financialProducts = posting.financial_data?.products ?? [];

  return (
    financialProducts.find(
      (item) =>
        typeof item.product_id === 'number' &&
        product.sku !== undefined &&
        String(item.product_id) === String(product.sku)
    ) ??
    financialProducts.find(
      (item) =>
        typeof item.product_id === 'number' &&
        typeof product.product_id === 'number' &&
        item.product_id === product.product_id
    ) ??
    financialProducts[index]
  );
}

function parsePrice(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeOzonRows(params: {
  products: OzonProductItem[];
  productAttributes?: OzonProductAttributesItem[];
  prices: OzonPriceItem[];
  stocks: OzonStockItem[];
  postings: OzonPostingItem[];
  periodDays: number;
}): DashboardRow[] {
  const { products, productAttributes = [], prices, stocks, postings, periodDays } = params;
  const dates = getDateRange(periodDays).dates;
  const rows = new Map<string, OzonAccumulator>();
  const aliasIndex = new Map<string, string>();
  const knownBrands = Array.from(
    new Set(productAttributes.map(extractOzonBrand).filter((brand): brand is string => Boolean(brand)))
  ).sort((left, right) => right.length - left.length);

  for (const product of products) {
    const accumulator = createAccumulator(product);
    rows.set(accumulator.productKey, accumulator);
    registerAliases(aliasIndex, accumulator, {
      productId: accumulator.productId,
      offerId: accumulator.offerId,
      sku: accumulator.sku
    });
  }

  for (const item of productAttributes) {
    const accumulator = findOrCreateAccumulator({
      rows,
      aliasIndex,
      lookup: {
        productId: item.id,
        offerId: item.offer_id,
        sku: item.sku ? String(item.sku) : undefined,
        name: item.name
      }
    });

    accumulator.brand = extractOzonBrand(item) ?? accumulator.brand;
    accumulator.imageUrl =
      (Array.isArray(item.primary_image) ? item.primary_image[0] : item.primary_image) ??
      accumulator.imageUrl;
  }

  for (const price of prices) {
    const accumulator = findOrCreateAccumulator({
      rows,
      aliasIndex,
      lookup: {
        productId: price.product_id,
        offerId: price.offer_id,
        name: price.offer_id
      }
    });

    accumulator.price = Number(
      price.price?.price ?? price.marketing_price ?? price.price_index ?? 0
    ) || accumulator.price;
    accumulator.currency =
      price.price?.currency_code ?? price.currency_code ?? accumulator.currency;
  }

  for (const stock of stocks) {
    const accumulator = findOrCreateAccumulator({
      rows,
      aliasIndex,
      lookup: {
        productId: stock.product_id,
        offerId: stock.offer_id,
        name: stock.offer_id
      }
    });

    const stockValue = stock.stocks?.reduce(
      (sum, item) => sum + (item.present ?? 0) - (item.reserved ?? 0),
      0
    );

    accumulator.stock =
      stockValue ?? ((stock.present ?? 0) - (stock.reserved ?? 0));
  }

  for (const posting of postings) {
    if (isCancelledPosting(posting)) {
      continue;
    }

    const dateKey = getOrderDateKey(posting.in_process_at ?? posting.created_at);

    if (!dateKey) {
      continue;
    }

    for (const [index, product] of (posting.products ?? []).entries()) {
      const accumulator = findOrCreateAccumulator({
        rows,
        aliasIndex,
        lookup: {
          productId: product.product_id,
          offerId: product.offer_id,
          sku: product.sku ? String(product.sku) : undefined,
          name: product.name
        }
      });

      const current = accumulator.ordersMap.get(dateKey) ?? 0;
      const quantity = product.quantity ?? 1;
      accumulator.ordersMap.set(dateKey, current + quantity);

      const financialProduct = findFinancialProduct(posting, product, index);
      const numericPrice = parsePrice(financialProduct?.price ?? product.price);
      const numericPriceWithSpp = parsePrice(
        financialProduct?.customer_price ?? financialProduct?.price ?? product.price
      );

      if (typeof numericPrice === 'number') {
        const currentPriceSum = accumulator.priceSumMap.get(dateKey) ?? 0;
        accumulator.priceSumMap.set(dateKey, currentPriceSum + numericPrice * quantity);
      }

      if (typeof numericPriceWithSpp === 'number') {
        const currentPriceWithSppSum = accumulator.priceWithSppSumMap.get(dateKey) ?? 0;
        accumulator.priceWithSppSumMap.set(
          dateKey,
          currentPriceWithSppSum + numericPriceWithSpp * quantity
        );
      }
    }
  }

  for (const row of rows.values()) {
    row.brand = row.brand ?? inferBrandFromName(row.productName, knownBrands);
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
        brand: row.brand ?? inferBrandFromName(row.productName, knownBrands),
        article: row.article,
        sku: row.sku,
        offerId: row.offerId,
        productId: row.productId,
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
