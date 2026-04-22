'use client';

import { DragScroll } from '@/components/drag-scroll';
import { createCanonicalBrandMap, getCanonicalBrand } from '@/lib/brands';
import type { DashboardRow, Marketplace } from '@/types/dashboard';

type BrandAnalyticsProps = {
  rows: DashboardRow[];
  allRows: DashboardRow[];
  dates: string[];
  selectedBrand: string;
  isLoading: boolean;
};

type MutableSummary = {
  label: string;
  orders: number;
  stock: number;
  revenue: number;
  revenueWithSpp: number;
  priceSum: number;
  priceWeight: number;
  priceWithSppSum: number;
  priceWithSppWeight: number;
  skuWithoutSales: number;
  productKeys: Set<string>;
  marketplaceOrders: Record<Marketplace, number>;
  marketplaceSkus: Record<Marketplace, number>;
};

type Summary = {
  label: string;
  orders: number;
  ordersShare: number;
  stock: number;
  averageDailyOrders: number;
  coverageDays: number;
  averagePrice: number | null;
  averagePriceWithSpp: number | null;
  sppDiscountValue: number | null;
  sppDiscountPercent: number | null;
  revenue: number;
  revenueWithSpp: number;
  skuCount: number;
  skuWithoutSales: number;
  turnover: number;
  wbOrders: number;
  ozonOrders: number;
  wbSkus: number;
  ozonSkus: number;
};

type Comparison = {
  label: string;
  previousOrders: number;
  currentOrders: number;
  ordersDeltaPercent: number | null;
  previousRevenue: number;
  currentRevenue: number;
  revenueDeltaPercent: number | null;
};

const UNKNOWN_BRAND = 'БЕЗ БРЕНДА';

function createMutableSummary(label: string): MutableSummary {
  return {
    label,
    orders: 0,
    stock: 0,
    revenue: 0,
    revenueWithSpp: 0,
    priceSum: 0,
    priceWeight: 0,
    priceWithSppSum: 0,
    priceWithSppWeight: 0,
    skuWithoutSales: 0,
    productKeys: new Set<string>(),
    marketplaceOrders: {
      wb: 0,
      ozon: 0
    },
    marketplaceSkus: {
      wb: 0,
      ozon: 0
    }
  };
}

function getPointMap(points: DashboardRow['priceByDay']) {
  return new Map(points.map((item) => [item.date, item.amount] as const));
}

function consumeRow(summary: MutableSummary, row: DashboardRow, dates: string[]) {
  const ordersByDate = new Map(row.ordersByDay.map((item) => [item.date, item.count] as const));
  const priceByDate = getPointMap(row.priceByDay ?? []);
  const priceWithSppByDate = getPointMap(row.priceWithSppByDay ?? []);
  let rowOrders = 0;

  summary.productKeys.add(row.productKey);
  summary.marketplaceSkus[row.marketplace] += 1;
  summary.stock += Math.max(row.stock ?? 0, 0);

  for (const date of dates) {
    const count = ordersByDate.get(date) ?? 0;

    if (count <= 0) {
      continue;
    }

    rowOrders += count;
    summary.orders += count;
    summary.marketplaceOrders[row.marketplace] += count;

    const price = priceByDate.get(date) ?? row.price;

    if (typeof price === 'number' && Number.isFinite(price)) {
      summary.priceSum += price * count;
      summary.priceWeight += count;
      summary.revenue += price * count;
    }

    const priceWithSpp = priceWithSppByDate.get(date);

    if (typeof priceWithSpp === 'number' && Number.isFinite(priceWithSpp)) {
      summary.priceWithSppSum += priceWithSpp * count;
      summary.priceWithSppWeight += count;
      summary.revenueWithSpp += priceWithSpp * count;
    }
  }

  if (rowOrders === 0) {
    summary.skuWithoutSales += 1;
  }
}

function finalizeSummary(
  summary: MutableSummary,
  dates: string[],
  denominatorOrders: number
): Summary {
  const averageDailyOrders = dates.length > 0 ? summary.orders / dates.length : 0;
  const coverageDays =
    summary.stock === 0
      ? 0
      : averageDailyOrders > 0
        ? summary.stock / averageDailyOrders
        : Infinity;
  const averagePrice =
    summary.priceWeight > 0 ? summary.priceSum / summary.priceWeight : null;
  const averagePriceWithSpp =
    summary.priceWithSppWeight > 0
      ? summary.priceWithSppSum / summary.priceWithSppWeight
      : null;
  const sppDiscountValue =
    averagePrice !== null && averagePriceWithSpp !== null
      ? averagePrice - averagePriceWithSpp
      : null;
  const sppDiscountPercent =
    averagePrice !== null && averagePrice > 0 && averagePriceWithSpp !== null
      ? ((averagePrice - averagePriceWithSpp) / averagePrice) * 100
      : null;

  return {
    label: summary.label,
    orders: summary.orders,
    ordersShare: denominatorOrders > 0 ? (summary.orders / denominatorOrders) * 100 : 0,
    stock: summary.stock,
    averageDailyOrders,
    coverageDays,
    averagePrice,
    averagePriceWithSpp,
    sppDiscountValue,
    sppDiscountPercent,
    revenue: summary.revenue,
    revenueWithSpp: summary.revenueWithSpp,
    skuCount: summary.productKeys.size,
    skuWithoutSales: summary.skuWithoutSales,
    turnover:
      summary.stock > 0 ? summary.orders / summary.stock : summary.orders > 0 ? Infinity : 0,
    wbOrders: summary.marketplaceOrders.wb,
    ozonOrders: summary.marketplaceOrders.ozon,
    wbSkus: summary.marketplaceSkus.wb,
    ozonSkus: summary.marketplaceSkus.ozon
  };
}

function summarizeRows(
  label: string,
  rows: DashboardRow[],
  dates: string[],
  denominatorOrders: number
) {
  const summary = createMutableSummary(label);

  for (const row of rows) {
    consumeRow(summary, row, dates);
  }

  return finalizeSummary(summary, dates, denominatorOrders);
}

function summarizeBrands(rows: DashboardRow[], dates: string[], denominatorOrders: number) {
  const groups = new Map<string, MutableSummary>();
  const canonicalByBrand = createCanonicalBrandMap(rows.map((row) => row.brand));

  for (const row of rows) {
    const brand = getCanonicalBrand(row.brand, canonicalByBrand) ?? UNKNOWN_BRAND;
    const summary = groups.get(brand) ?? createMutableSummary(brand);

    consumeRow(summary, row, dates);
    groups.set(brand, summary);
  }

  return Array.from(groups.values())
    .map((summary) => finalizeSummary(summary, dates, denominatorOrders))
    .sort((left, right) => right.orders - left.orders || right.revenue - left.revenue);
}

function getComparisonDates(dates: string[]) {
  const rangeSize = Math.floor(dates.length / 2);

  if (rangeSize < 1) {
    return null;
  }

  const comparableDates = dates.slice(dates.length - rangeSize * 2);

  return {
    previous: comparableDates.slice(0, rangeSize),
    current: comparableDates.slice(rangeSize),
    rangeSize
  };
}

function getDeltaPercent(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return ((current - previous) / previous) * 100;
}

function createComparison(
  label: string,
  rows: DashboardRow[],
  previousDates: string[],
  currentDates: string[]
): Comparison {
  const previous = summarizeRows(label, rows, previousDates, 0);
  const current = summarizeRows(label, rows, currentDates, 0);

  return {
    label,
    previousOrders: previous.orders,
    currentOrders: current.orders,
    ordersDeltaPercent: getDeltaPercent(current.orders, previous.orders),
    previousRevenue: previous.revenue,
    currentRevenue: current.revenue,
    revenueDeltaPercent: getDeltaPercent(current.revenue, previous.revenue)
  };
}

function createBrandComparisonMap(
  rows: DashboardRow[],
  previousDates: string[],
  currentDates: string[]
) {
  const groups = new Map<string, DashboardRow[]>();
  const canonicalByBrand = createCanonicalBrandMap(rows.map((row) => row.brand));

  for (const row of rows) {
    const brand = getCanonicalBrand(row.brand, canonicalByBrand) ?? UNKNOWN_BRAND;
    const groupRows = groups.get(brand) ?? [];

    groupRows.push(row);
    groups.set(brand, groupRows);
  }

  return new Map(
    Array.from(groups.entries()).map(([brand, brandRows]) => [
      brand,
      createComparison(brand, brandRows, previousDates, currentDates)
    ])
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit'
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateRange(dates: string[]) {
  if (dates.length === 0) {
    return '—';
  }

  return `${formatDate(dates[0])}–${formatDate(dates[dates.length - 1])}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0
  }).format(Math.round(value));
}

function formatDecimal(value: number) {
  if (!Number.isFinite(value)) {
    return '∞';
  }

  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2
  }).format(value);
}

function formatMoney(value: number | null) {
  if (value === null) {
    return '—';
  }

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0
  }).format(value);
}

function formatPlainPercent(value: number | null) {
  if (value === null) {
    return '—';
  }

  return `${new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 1
  }).format(value)}%`;
}

function formatSignedPercent(value: number | null) {
  if (value === null) {
    return '+∞';
  }

  return `${value > 0 ? '+' : ''}${new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 1
  }).format(value)}%`;
}

function formatCoverageDays(value: number) {
  if (!Number.isFinite(value)) {
    return '∞';
  }

  return formatNumber(value);
}

function getDeltaTone(value: number | null) {
  if (value === null || value === 0) {
    return 'same';
  }

  return value > 0 ? 'up' : 'down';
}

function getRevenueComparisonTone(comparison: Comparison) {
  if (comparison.currentRevenue === comparison.previousRevenue) {
    return 'same';
  }

  return comparison.currentRevenue > comparison.previousRevenue ? 'up' : 'down';
}

function SummaryMetric({
  label,
  value,
  note,
  tone
}: {
  label: string;
  value: string;
  note: string;
  tone: 'orders' | 'stock' | 'price' | 'spp' | 'revenue' | 'risk';
}) {
  return (
    <article className={`brand-metric ${tone}`}>
      <span className="brand-metric-label">{label}</span>
      <strong className="brand-metric-value">{value}</strong>
      <span className="brand-metric-note">{note}</span>
    </article>
  );
}

function MarketplaceCard({ summary }: { summary: Summary }) {
  return (
    <article className="marketplace-breakdown-card">
      <div className="marketplace-breakdown-head">
        <span className="marketplace-pill">{summary.label}</span>
        <strong>{formatNumber(summary.orders)} заказов</strong>
      </div>
      <div className="marketplace-breakdown-grid">
        <span>SKU</span>
        <strong>{formatNumber(summary.skuCount)}</strong>
        <span>Остаток</span>
        <strong>{formatNumber(summary.stock)}</strong>
        <span>ТЗ</span>
        <strong>{formatCoverageDays(summary.coverageDays)} дн.</strong>
        <span>Средняя цена</span>
        <strong>{formatMoney(summary.averagePrice)}</strong>
        <span>Выручка</span>
        <strong>{formatMoney(summary.revenue)}</strong>
      </div>
    </article>
  );
}

function ComparisonCard({ comparison }: { comparison: Comparison }) {
  return (
    <article className="comparison-card">
      <div className="comparison-title">{comparison.label}</div>
      <div className="comparison-row">
        <span>Заказы</span>
        <strong>
          {formatNumber(comparison.previousOrders)} → {formatNumber(comparison.currentOrders)}
        </strong>
        <span className={`comparison-delta ${getDeltaTone(comparison.ordersDeltaPercent)}`}>
          {formatSignedPercent(comparison.ordersDeltaPercent)}
        </span>
      </div>
      <div className="comparison-row">
        <span>Выручка</span>
        <strong>
          {formatMoney(comparison.previousRevenue)} → {formatMoney(comparison.currentRevenue)}
        </strong>
        <span className={`comparison-delta ${getDeltaTone(comparison.revenueDeltaPercent)}`}>
          {formatSignedPercent(comparison.revenueDeltaPercent)}
        </span>
      </div>
    </article>
  );
}

function BrandRevenueTrend({ comparison }: { comparison?: Comparison }) {
  if (!comparison) {
    return <span className="brand-revenue-empty">—</span>;
  }

  const tone = getRevenueComparisonTone(comparison);

  return (
    <div className="brand-revenue-trend">
      <span className={`brand-revenue-delta ${tone}`}>
        {formatSignedPercent(comparison.revenueDeltaPercent)}
      </span>
      <span className="brand-revenue-range">
        {formatMoney(comparison.previousRevenue)} → {formatMoney(comparison.currentRevenue)}
      </span>
    </div>
  );
}

export function BrandAnalytics({
  rows,
  allRows,
  dates,
  selectedBrand,
  isLoading
}: BrandAnalyticsProps) {
  if (isLoading) {
    return (
      <section className="brand-analytics-card">
        <div className="loading-state">
          <div className="loading-grid">
            <div className="loading-bar" />
            <div className="loading-bar" />
          </div>
        </div>
      </section>
    );
  }

  if (rows.length === 0 || dates.length === 0) {
    return (
      <section className="brand-analytics-card">
        <div className="empty-state">Нет данных для бренд-аналитики.</div>
      </section>
    );
  }

  const denominatorOrders = summarizeRows('all', allRows, dates, 0).orders;
  const totalLabel = selectedBrand === 'all' ? 'Все бренды' : selectedBrand;
  const totalSummary = summarizeRows(totalLabel, rows, dates, denominatorOrders);
  const brandSummaries = summarizeBrands(rows, dates, denominatorOrders);
  const marketplaceSummaries = [
    summarizeRows('WB', rows.filter((row) => row.marketplace === 'wb'), dates, denominatorOrders),
    summarizeRows(
      'Ozon',
      rows.filter((row) => row.marketplace === 'ozon'),
      dates,
      denominatorOrders
    )
  ];
  const comparisonDates = getComparisonDates(dates);
  const brandRevenueComparisons = comparisonDates
    ? createBrandComparisonMap(rows, comparisonDates.previous, comparisonDates.current)
    : new Map<string, Comparison>();
  const comparisons = comparisonDates
    ? [
        createComparison('Все', rows, comparisonDates.previous, comparisonDates.current),
        createComparison(
          'WB',
          rows.filter((row) => row.marketplace === 'wb'),
          comparisonDates.previous,
          comparisonDates.current
        ),
        createComparison(
          'Ozon',
          rows.filter((row) => row.marketplace === 'ozon'),
          comparisonDates.previous,
          comparisonDates.current
        )
      ]
    : [];

  return (
    <section className="brand-analytics-card">
      <div className="brand-analytics-header">
        <div>
          <h2 className="table-title">Бренд-аналитика</h2>
          <p className="chart-subtitle">
            {selectedBrand === 'all'
              ? 'Итог по всем брендам, разбивка по маркетплейсам и таблица брендов.'
              : `Итог по бренду ${selectedBrand} с разбивкой WB/Ozon.`}
          </p>
        </div>
        <span className="badge accent">{totalSummary.skuCount} SKU</span>
      </div>

      <div className="brand-metrics-grid">
        <SummaryMetric
          label="Заказы"
          value={formatNumber(totalSummary.orders)}
          note={`${formatPlainPercent(totalSummary.ordersShare)} от выборки`}
          tone="orders"
        />
        <SummaryMetric
          label="Остатки"
          value={formatNumber(totalSummary.stock)}
          note={`${formatCoverageDays(totalSummary.coverageDays)} дн. ТЗ`}
          tone="stock"
        />
        <SummaryMetric
          label="Выручка"
          value={formatMoney(totalSummary.revenue)}
          note={`${formatMoney(totalSummary.revenueWithSpp)} с СПП`}
          tone="revenue"
        />
        <SummaryMetric
          label="Без продаж"
          value={formatNumber(totalSummary.skuWithoutSales)}
          note={`Оборач. ${formatDecimal(totalSummary.turnover)}`}
          tone="risk"
        />
      </div>

      <div className="brand-section-title">
        <h3>Разбивка по маркетплейсам</h3>
        <span>
          WB: {formatNumber(totalSummary.wbOrders)} заказов · Ozon:{' '}
          {formatNumber(totalSummary.ozonOrders)} заказов
        </span>
      </div>
      <div className="marketplace-breakdown">
        {marketplaceSummaries.map((summary) => (
          <MarketplaceCard key={summary.label} summary={summary} />
        ))}
      </div>

      {comparisonDates ? (
        <>
          <div className="brand-section-title">
            <h3>Сравнение равных диапазонов</h3>
            <span>
              {formatDateRange(comparisonDates.previous)} vs{' '}
              {formatDateRange(comparisonDates.current)}
            </span>
          </div>
          <div className="comparison-grid">
            {comparisons.map((comparison) => (
              <ComparisonCard key={comparison.label} comparison={comparison} />
            ))}
          </div>
        </>
      ) : null}

      <div className="brand-section-title">
        <h3>{selectedBrand === 'all' ? 'Бренды' : 'Выбранный бренд'}</h3>
        <span>Доля считается от заказов текущей выборки</span>
      </div>
      <DragScroll className="brand-table-scroll">
        <table className="brand-table">
          <thead>
            <tr>
              <th>Бренд</th>
              <th className="numeric">Заказы</th>
              <th className="numeric">Доля</th>
              <th className="numeric">Остаток</th>
              <th className="numeric">ТЗ</th>
              <th className="numeric">Сред./день</th>
              <th className="numeric">Выручка</th>
              <th className="numeric">Динамика</th>
              <th className="numeric">WB</th>
              <th className="numeric">Ozon</th>
              <th className="numeric">SKUs</th>
              <th className="numeric">Без продаж</th>
              <th className="numeric">Оборач.</th>
            </tr>
          </thead>
          <tbody>
            {brandSummaries.map((summary) => {
              const revenueComparison = brandRevenueComparisons.get(summary.label);

              return (
                <tr key={summary.label}>
                  <td data-label="Бренд">
                    <strong>{summary.label}</strong>
                    <div className="cell-subtitle">
                      WB SKU: {formatNumber(summary.wbSkus)} · Ozon SKU:{' '}
                      {formatNumber(summary.ozonSkus)}
                    </div>
                  </td>
                  <td className="numeric brand-value-strong orders" data-label="Заказы">
                    {formatNumber(summary.orders)}
                  </td>
                  <td className="numeric brand-value-strong share" data-label="Доля">
                    {formatPlainPercent(summary.ordersShare)}
                  </td>
                  <td className="numeric" data-label="Остаток">
                    {formatNumber(summary.stock)}
                  </td>
                  <td className="numeric brand-value-strong coverage" data-label="ТЗ">
                    {formatCoverageDays(summary.coverageDays)}
                  </td>
                  <td className="numeric" data-label="Сред./день">
                    {formatDecimal(summary.averageDailyOrders)}
                  </td>
                  <td className="numeric brand-value-strong revenue" data-label="Выручка">
                    {formatMoney(summary.revenue)}
                  </td>
                  <td className="numeric" data-label="Динамика">
                    <BrandRevenueTrend comparison={revenueComparison} />
                  </td>
                  <td className="numeric" data-label="WB">
                    {formatNumber(summary.wbOrders)}
                  </td>
                  <td className="numeric" data-label="Ozon">
                    {formatNumber(summary.ozonOrders)}
                  </td>
                  <td className="numeric" data-label="SKUs">
                    {formatNumber(summary.skuCount)}
                  </td>
                  <td className="numeric brand-value-strong risk" data-label="Без продаж">
                    {formatNumber(summary.skuWithoutSales)}
                  </td>
                  <td className="numeric" data-label="Оборач.">
                    {formatDecimal(summary.turnover)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DragScroll>
    </section>
  );
}
