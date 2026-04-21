'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type ScriptableContext
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import type { DashboardRow } from '@/types/dashboard';

type OrdersChartProps = {
  rows: DashboardRow[];
  dates: string[];
  isLoading: boolean;
};

type VisibilityState = {
  wbOrders: boolean;
  ozonOrders: boolean;
  wbPrice: boolean;
  wbPriceWithSpp: boolean;
  ozonPrice: boolean;
  ozonPriceWithSpp: boolean;
};

type StoredVisibilityState = Partial<VisibilityState> & {
  orderPrice?: boolean;
  orderPriceWithSpp?: boolean;
};

type ThemePalette = {
  text: string;
  muted: string;
  line: string;
  panel: string;
  accent: string;
  accentDark: string;
  teal: string;
  river: string;
  pine: string;
};

type AggregatedSeries = {
  wbOrders: number[];
  ozonOrders: number[];
  wbPrice: Array<number | null>;
  wbPriceWithSpp: Array<number | null>;
  ozonPrice: Array<number | null>;
  ozonPriceWithSpp: Array<number | null>;
};

type PriceScaleBounds = {
  suggestedMin?: number;
  suggestedMax?: number;
};

const CHART_VISIBILITY_STORAGE_KEY = 'dashboard:chart-visibility:v4';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  Legend
);

function aggregateSeries(rows: DashboardRow[], dates: string[]): AggregatedSeries {
  const orderTotals = {
    wb: new Map<string, number>(),
    ozon: new Map<string, number>()
  };
  const priceSums = {
    wb: new Map<string, number>(),
    ozon: new Map<string, number>()
  };
  const priceCounts = {
    wb: new Map<string, number>(),
    ozon: new Map<string, number>()
  };
  const wbPriceWithSppSums = new Map<string, number>();
  const wbPriceWithSppCounts = new Map<string, number>();
  const ozonPriceWithSppSums = new Map<string, number>();
  const ozonPriceWithSppCounts = new Map<string, number>();

  for (const row of rows) {
    const countsByDate = new Map(row.ordersByDay.map((item) => [item.date, item.count] as const));
    const priceByDate = new Map(
      (row.priceByDay ?? []).map((item) => [item.date, item.amount] as const)
    );
    const priceWithSppByDate = new Map(
      (row.priceWithSppByDay ?? []).map((item) => [item.date, item.amount] as const)
    );

    for (const date of dates) {
      const count = countsByDate.get(date) ?? 0;

      if (count > 0) {
        const current = orderTotals[row.marketplace].get(date) ?? 0;
        orderTotals[row.marketplace].set(date, current + count);
      }

      const price = priceByDate.get(date) ?? row.price;

      if (count > 0 && typeof price === 'number') {
        priceSums[row.marketplace].set(
          date,
          (priceSums[row.marketplace].get(date) ?? 0) + price * count
        );
        priceCounts[row.marketplace].set(
          date,
          (priceCounts[row.marketplace].get(date) ?? 0) + count
        );
      }

      const priceWithSpp = priceWithSppByDate.get(date);

      if (count > 0 && typeof priceWithSpp === 'number') {
        const sums = row.marketplace === 'wb' ? wbPriceWithSppSums : ozonPriceWithSppSums;
        const counts =
          row.marketplace === 'wb' ? wbPriceWithSppCounts : ozonPriceWithSppCounts;

        sums.set(date, (sums.get(date) ?? 0) + priceWithSpp * count);
        counts.set(date, (counts.get(date) ?? 0) + count);
      }
    }
  }

  const getAverage = (
    date: string,
    sums: Map<string, number>,
    counts: Map<string, number>
  ) => {
    const count = counts.get(date) ?? 0;
    const sum = sums.get(date) ?? 0;
    return count > 0 ? sum / count : null;
  };

  return {
    wbOrders: dates.map((date) => orderTotals.wb.get(date) ?? 0),
    ozonOrders: dates.map((date) => orderTotals.ozon.get(date) ?? 0),
    wbPrice: dates.map((date) => getAverage(date, priceSums.wb, priceCounts.wb)),
    wbPriceWithSpp: dates.map((date) =>
      getAverage(date, wbPriceWithSppSums, wbPriceWithSppCounts)
    ),
    ozonPrice: dates.map((date) => getAverage(date, priceSums.ozon, priceCounts.ozon)),
    ozonPriceWithSpp: dates.map((date) =>
      getAverage(date, ozonPriceWithSppSums, ozonPriceWithSppCounts)
    )
  };
}

function getNumericValues(values: Array<number | null>) {
  return values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function getPriceScaleBounds(values: number[]): PriceScaleBounds {
  if (values.length === 0) {
    return {};
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min;
  const padding = spread > 0 ? spread * 0.18 : Math.max(max * 0.08, 100);

  return {
    suggestedMin: Math.max(0, Math.floor(min - padding)),
    suggestedMax: Math.ceil(max + padding)
  };
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit'
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function readVisibilityState(): VisibilityState {
  if (typeof window === 'undefined') {
    return {
      wbOrders: true,
      ozonOrders: true,
      wbPrice: true,
      wbPriceWithSpp: true,
      ozonPrice: true,
      ozonPriceWithSpp: true
    };
  }

  try {
    const raw = window.localStorage.getItem(CHART_VISIBILITY_STORAGE_KEY);

    if (!raw) {
      return {
        wbOrders: true,
        ozonOrders: true,
        wbPrice: true,
        wbPriceWithSpp: true,
        ozonPrice: true,
        ozonPriceWithSpp: true
      };
    }

    const parsed = JSON.parse(raw) as StoredVisibilityState;

    return {
      wbOrders: parsed.wbOrders ?? true,
      ozonOrders: parsed.ozonOrders ?? true,
      wbPrice: parsed.wbPrice ?? parsed.orderPrice ?? true,
      wbPriceWithSpp: parsed.wbPriceWithSpp ?? parsed.orderPriceWithSpp ?? true,
      ozonPrice: parsed.ozonPrice ?? parsed.orderPrice ?? true,
      ozonPriceWithSpp: parsed.ozonPriceWithSpp ?? parsed.orderPriceWithSpp ?? true
    };
  } catch {
    return {
      wbOrders: true,
      ozonOrders: true,
      wbPrice: true,
      wbPriceWithSpp: true,
      ozonPrice: true,
      ozonPriceWithSpp: true
    };
  }
}

function readThemePalette(): ThemePalette {
  if (typeof window === 'undefined') {
    return {
      text: '#203128',
      muted: '#5d6c62',
      line: 'rgba(53, 78, 59, 0.15)',
      panel: 'rgba(252, 255, 252, 0.94)',
      accent: '#a96a2b',
      accentDark: '#71441d',
      teal: '#2a7f82',
      river: '#74b7bc',
      pine: '#345844'
    };
  }

  const styles = window.getComputedStyle(document.documentElement);

  return {
    text: styles.getPropertyValue('--text').trim() || '#203128',
    muted: styles.getPropertyValue('--muted').trim() || '#5d6c62',
    line: styles.getPropertyValue('--line').trim() || 'rgba(53, 78, 59, 0.15)',
    panel: styles.getPropertyValue('--panel-strong').trim() || 'rgba(252, 255, 252, 0.94)',
    accent: styles.getPropertyValue('--accent').trim() || '#a96a2b',
    accentDark: styles.getPropertyValue('--accent-dark').trim() || '#71441d',
    teal: styles.getPropertyValue('--teal').trim() || '#2a7f82',
    river: styles.getPropertyValue('--river').trim() || '#74b7bc',
    pine: styles.getPropertyValue('--pine').trim() || '#345844'
  };
}

function createFillGradient(
  context: ScriptableContext<'line'>,
  topColor: string,
  bottomColor: string
) {
  const chart = context.chart;
  const { ctx, chartArea } = chart;

  if (!chartArea) {
    return bottomColor;
  }

  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  return gradient;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0
  }).format(value);
}

export function OrdersChart({
  rows,
  dates,
  isLoading
}: OrdersChartProps) {
  const [visibility, setVisibility] = useState<VisibilityState>({
    wbOrders: true,
    ozonOrders: true,
    wbPrice: true,
    wbPriceWithSpp: true,
    ozonPrice: true,
    ozonPriceWithSpp: true
  });
  const [palette, setPalette] = useState<ThemePalette>(readThemePalette);
  const series = aggregateSeries(rows, dates);
  const wbTotal = series.wbOrders.reduce((sum, value) => sum + value, 0);
  const ozonTotal = series.ozonOrders.reduce((sum, value) => sum + value, 0);
  const wbPriceDays = getNumericValues(series.wbPrice);
  const wbPriceWithSppDays = getNumericValues(series.wbPriceWithSpp);
  const ozonPriceDays = getNumericValues(series.ozonPrice);
  const ozonPriceWithSppDays = getNumericValues(series.ozonPriceWithSpp);
  const priceScaleBounds = getPriceScaleBounds([
    ...wbPriceDays,
    ...wbPriceWithSppDays,
    ...ozonPriceDays,
    ...ozonPriceWithSppDays
  ]);
  const avgWbPrice =
    wbPriceDays.length > 0
      ? wbPriceDays.reduce((sum, value) => sum + value, 0) / wbPriceDays.length
      : null;
  const avgWbPriceWithSpp =
    wbPriceWithSppDays.length > 0
      ? wbPriceWithSppDays.reduce((sum, value) => sum + value, 0) / wbPriceWithSppDays.length
      : null;
  const avgOzonPrice =
    ozonPriceDays.length > 0
      ? ozonPriceDays.reduce((sum, value) => sum + value, 0) / ozonPriceDays.length
      : null;
  const avgOzonPriceWithSpp =
    ozonPriceWithSppDays.length > 0
      ? ozonPriceWithSppDays.reduce((sum, value) => sum + value, 0) /
        ozonPriceWithSppDays.length
      : null;

  useEffect(() => {
    setVisibility(readVisibilityState());
    setPalette(readThemePalette());

    const observer = new MutationObserver(() => {
      setPalette(readThemePalette());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(CHART_VISIBILITY_STORAGE_KEY, JSON.stringify(visibility));
  }, [visibility]);

  const labels = useMemo(() => dates.map(formatDateLabel), [dates]);

  const data = useMemo<ChartData<'line'>>(
    () => ({
      labels,
      datasets: [
        {
          label: 'WB заказы',
          data: series.wbOrders,
          hidden: !visibility.wbOrders,
          yAxisID: 'yOrders',
          borderColor: palette.accent,
          backgroundColor: (context) =>
            createFillGradient(
              context,
              'rgba(169, 106, 43, 0.34)',
              'rgba(169, 106, 43, 0.02)'
            ),
          fill: true,
          borderWidth: 3,
          tension: 0.38,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHitRadius: 18,
          pointHoverBorderWidth: 3,
          pointHoverBackgroundColor: palette.panel,
          pointHoverBorderColor: palette.accent,
          pointBackgroundColor: palette.accent,
          pointBorderColor: palette.panel
        },
        {
          label: 'Ozon заказы',
          data: series.ozonOrders,
          hidden: !visibility.ozonOrders,
          yAxisID: 'yOrders',
          borderColor: palette.teal,
          backgroundColor: (context) =>
            createFillGradient(
              context,
              'rgba(42, 127, 130, 0.28)',
              'rgba(42, 127, 130, 0.02)'
            ),
          fill: true,
          borderWidth: 3,
          tension: 0.38,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHitRadius: 18,
          pointHoverBorderWidth: 3,
          pointHoverBackgroundColor: palette.panel,
          pointHoverBorderColor: palette.teal,
          pointBackgroundColor: palette.teal,
          pointBorderColor: palette.panel
        },
        {
          label: 'WB цена',
          data: series.wbPrice,
          hidden: !visibility.wbPrice,
          yAxisID: 'yPrice',
          borderColor: palette.accentDark,
          backgroundColor: 'transparent',
          fill: false,
          borderWidth: 3.5,
          tension: 0.3,
          borderDash: [8, 6],
          spanGaps: true,
          pointRadius: 2,
          pointHoverRadius: 7,
          pointHitRadius: 18,
          pointHoverBorderWidth: 2,
          pointHoverBackgroundColor: palette.panel,
          pointHoverBorderColor: palette.accentDark,
          pointBackgroundColor: palette.accentDark,
          pointBorderColor: palette.panel
        },
        {
          label: 'WB цена с СПП',
          data: series.wbPriceWithSpp,
          hidden: !visibility.wbPriceWithSpp,
          yAxisID: 'yPrice',
          borderColor: palette.river,
          backgroundColor: 'transparent',
          fill: false,
          borderWidth: 3.5,
          tension: 0.3,
          borderDash: [3, 5],
          spanGaps: true,
          pointRadius: 2,
          pointHoverRadius: 7,
          pointHitRadius: 18,
          pointHoverBorderWidth: 2,
          pointHoverBackgroundColor: palette.panel,
          pointHoverBorderColor: palette.river,
          pointBackgroundColor: palette.river,
          pointBorderColor: palette.panel
        },
        {
          label: 'Ozon цена',
          data: series.ozonPrice,
          hidden: !visibility.ozonPrice,
          yAxisID: 'yPrice',
          borderColor: palette.pine,
          backgroundColor: 'transparent',
          fill: false,
          borderWidth: 3.5,
          tension: 0.3,
          borderDash: [1, 5],
          spanGaps: true,
          pointRadius: 2,
          pointHoverRadius: 7,
          pointHitRadius: 18,
          pointHoverBorderWidth: 2,
          pointHoverBackgroundColor: palette.panel,
          pointHoverBorderColor: palette.pine,
          pointBackgroundColor: palette.pine,
          pointBorderColor: palette.panel
        },
        {
          label: 'Ozon цена с СПП',
          data: series.ozonPriceWithSpp,
          hidden: !visibility.ozonPriceWithSpp,
          yAxisID: 'yPrice',
          borderColor: palette.teal,
          backgroundColor: 'transparent',
          fill: false,
          borderWidth: 3.5,
          tension: 0.3,
          borderDash: [10, 4, 2, 4],
          spanGaps: true,
          pointRadius: 2,
          pointHoverRadius: 7,
          pointHitRadius: 18,
          pointHoverBorderWidth: 2,
          pointHoverBackgroundColor: palette.panel,
          pointHoverBorderColor: palette.teal,
          pointBackgroundColor: palette.teal,
          pointBorderColor: palette.panel
        }
      ]
    }),
    [labels, palette, series, visibility]
  );

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      animation: {
        duration: 450,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          displayColors: true,
          backgroundColor: 'rgba(17, 27, 23, 0.92)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#f5fbf8',
          bodyColor: '#dcebdc',
          padding: 14,
          cornerRadius: 14,
          caretPadding: 10,
          titleFont: {
            weight: 700
          },
          bodyFont: {
            weight: 600
          },
          callbacks: {
            title(items) {
              return items[0]?.label ?? '';
            },
            label(context) {
              if (context.dataset.yAxisID === 'yPrice') {
                const value = context.parsed.y;

                if (typeof value !== 'number') {
                  return `${context.dataset.label}: —`;
                }

                return `${context.dataset.label}: ${formatCurrency(value)}`;
              }

              return `${context.dataset.label}: ${context.parsed.y} заказов`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
          border: {
            display: false
          },
          ticks: {
            color: palette.muted,
            font: {
              size: 11,
              weight: 600
            },
            maxRotation: 0,
            autoSkipPadding: 18
          }
        },
        yOrders: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          border: {
            display: false
          },
          grid: {
            color: palette.line,
            drawBorder: false
          },
          ticks: {
            color: palette.muted,
            font: {
              size: 11,
              weight: 600
            },
            padding: 10
          }
        },
        yPrice: {
          type: 'linear',
          position: 'right',
          beginAtZero: false,
          suggestedMin: priceScaleBounds.suggestedMin,
          suggestedMax: priceScaleBounds.suggestedMax,
          border: {
            display: false
          },
          grid: {
            drawOnChartArea: false,
            drawBorder: false
          },
          ticks: {
            color: palette.muted,
            font: {
              size: 11,
              weight: 600
            },
            padding: 10,
            callback(value) {
              return formatCurrency(Number(value));
            }
          }
        }
      },
      elements: {
        line: {
          capBezierPoints: true
        }
      }
    }),
    [palette.line, palette.muted, priceScaleBounds.suggestedMax, priceScaleBounds.suggestedMin]
  );

  const hasVisibleSeries =
    visibility.wbOrders ||
    visibility.ozonOrders ||
    visibility.wbPrice ||
    visibility.wbPriceWithSpp ||
    visibility.ozonPrice ||
    visibility.ozonPriceWithSpp;

  if (isLoading) {
    return (
      <section className="chart-card">
        <div className="loading-state">
          <div className="loading-grid">
            <div className="loading-bar" />
            <div className="loading-bar" />
          </div>
        </div>
      </section>
    );
  }

  if (dates.length === 0) {
    return (
      <section className="chart-card">
        <div className="empty-state">Нет данных для построения графика.</div>
      </section>
    );
  }

  if (!hasVisibleSeries) {
    return (
      <section className="chart-card">
        <div className="chart-header">
          <div>
            <h2 className="table-title">Заказы и цены по дням</h2>
            <p className="chart-subtitle">
              Динамика заказов и средней цены из заказов за выбранный период.
            </p>
          </div>

          <div className="chart-controls">
            <button
              type="button"
              className={`chart-toggle ${visibility.wbOrders ? 'active wb' : ''}`}
              onClick={() =>
                setVisibility((current) => ({ ...current, wbOrders: !current.wbOrders }))
              }
            >
              WB заказы: {visibility.wbOrders ? 'вкл' : 'выкл'}
            </button>
            <button
              type="button"
              className={`chart-toggle ${visibility.ozonOrders ? 'active ozon' : ''}`}
              onClick={() =>
                setVisibility((current) => ({
                  ...current,
                  ozonOrders: !current.ozonOrders
                }))
              }
            >
              Ozon заказы: {visibility.ozonOrders ? 'вкл' : 'выкл'}
            </button>
            <button
              type="button"
              className={`chart-toggle ${visibility.wbPrice ? 'active price' : ''}`}
              onClick={() =>
                setVisibility((current) => ({
                  ...current,
                  wbPrice: !current.wbPrice
                }))
              }
            >
              WB цена: {visibility.wbPrice ? 'вкл' : 'выкл'}
            </button>
            <button
              type="button"
              className={`chart-toggle ${visibility.wbPriceWithSpp ? 'active price-spp' : ''}`}
              onClick={() =>
                setVisibility((current) => ({
                  ...current,
                  wbPriceWithSpp: !current.wbPriceWithSpp
                }))
              }
            >
              WB с СПП: {visibility.wbPriceWithSpp ? 'вкл' : 'выкл'}
            </button>
            <button
              type="button"
              className={`chart-toggle ${visibility.ozonPrice ? 'active price-ozon' : ''}`}
              onClick={() =>
                setVisibility((current) => ({
                  ...current,
                  ozonPrice: !current.ozonPrice
                }))
              }
            >
              Ozon цена: {visibility.ozonPrice ? 'вкл' : 'выкл'}
            </button>
            <button
              type="button"
              className={`chart-toggle ${visibility.ozonPriceWithSpp ? 'active price-ozon-spp' : ''}`}
              onClick={() =>
                setVisibility((current) => ({
                  ...current,
                  ozonPriceWithSpp: !current.ozonPriceWithSpp
                }))
              }
            >
              Ozon с СПП: {visibility.ozonPriceWithSpp ? 'вкл' : 'выкл'}
            </button>
          </div>
        </div>

        <div className="chart-empty">Включите хотя бы одну серию.</div>
      </section>
    );
  }

  return (
    <section className="chart-card chart-card-hero">
      <div className="chart-card-glow chart-card-glow-left" />
      <div className="chart-card-glow chart-card-glow-right" />

      <div className="chart-header">
        <div>
          <h2 className="table-title">Заказы и цены по дням</h2>
          <p className="chart-subtitle">
            Динамика заказов и средней цены из заказов за выбранный период. Цена с
            СПП строится только там, где маркетплейс отдает это поле отдельно.
          </p>
        </div>

        <div className="chart-controls">
          <button
            type="button"
            className={`chart-toggle ${visibility.wbOrders ? 'active wb' : ''}`}
            onClick={() =>
              setVisibility((current) => ({ ...current, wbOrders: !current.wbOrders }))
            }
          >
            WB заказы: {visibility.wbOrders ? 'вкл' : 'выкл'}
          </button>
          <button
            type="button"
            className={`chart-toggle ${visibility.ozonOrders ? 'active ozon' : ''}`}
            onClick={() =>
              setVisibility((current) => ({
                ...current,
                ozonOrders: !current.ozonOrders
              }))
            }
          >
            Ozon заказы: {visibility.ozonOrders ? 'вкл' : 'выкл'}
          </button>
          <button
            type="button"
            className={`chart-toggle ${visibility.wbPrice ? 'active price' : ''}`}
            onClick={() =>
              setVisibility((current) => ({
                ...current,
                wbPrice: !current.wbPrice
              }))
            }
          >
            WB цена: {visibility.wbPrice ? 'вкл' : 'выкл'}
          </button>
          <button
            type="button"
            className={`chart-toggle ${visibility.wbPriceWithSpp ? 'active price-spp' : ''}`}
            onClick={() =>
              setVisibility((current) => ({
                ...current,
                wbPriceWithSpp: !current.wbPriceWithSpp
              }))
            }
          >
            WB с СПП: {visibility.wbPriceWithSpp ? 'вкл' : 'выкл'}
          </button>
          <button
            type="button"
            className={`chart-toggle ${visibility.ozonPrice ? 'active price-ozon' : ''}`}
            onClick={() =>
              setVisibility((current) => ({
                ...current,
                ozonPrice: !current.ozonPrice
              }))
            }
          >
            Ozon цена: {visibility.ozonPrice ? 'вкл' : 'выкл'}
          </button>
          <button
            type="button"
            className={`chart-toggle ${visibility.ozonPriceWithSpp ? 'active price-ozon-spp' : ''}`}
            onClick={() =>
              setVisibility((current) => ({
                ...current,
                ozonPriceWithSpp: !current.ozonPriceWithSpp
              }))
            }
          >
            Ozon с СПП: {visibility.ozonPriceWithSpp ? 'вкл' : 'выкл'}
          </button>
        </div>
      </div>

      <div className="chart-stats">
        <div className="stat-pill wb">
          <span className="stat-label">WB Orders</span>
          <strong>{wbTotal}</strong>
        </div>
        <div className="stat-pill ozon">
          <span className="stat-label">Ozon Orders</span>
          <strong>{ozonTotal}</strong>
        </div>
        <div className="stat-pill price">
          <span className="stat-label">WB Avg Price</span>
          <strong>{avgWbPrice !== null ? formatCurrency(avgWbPrice) : '—'}</strong>
        </div>
        <div className="stat-pill price-spp">
          <span className="stat-label">WB Avg SPP</span>
          <strong>
            {avgWbPriceWithSpp !== null ? formatCurrency(avgWbPriceWithSpp) : '—'}
          </strong>
        </div>
        <div className="stat-pill price-ozon">
          <span className="stat-label">Ozon Avg Price</span>
          <strong>{avgOzonPrice !== null ? formatCurrency(avgOzonPrice) : '—'}</strong>
        </div>
        <div className="stat-pill price-ozon-spp">
          <span className="stat-label">Ozon Avg SPP</span>
          <strong>
            {avgOzonPriceWithSpp !== null ? formatCurrency(avgOzonPriceWithSpp) : '—'}
          </strong>
        </div>
      </div>

      <div className="chart-stage chart-stage-canvas">
        <div className="chart-canvas-wrap">
          <Line data={data} options={options} />
        </div>
      </div>
    </section>
  );
}
