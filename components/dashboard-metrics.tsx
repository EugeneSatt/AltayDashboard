'use client';

import type { DashboardRow } from '@/types/dashboard';

type DashboardMetricsProps = {
  rows: DashboardRow[];
  periodDays: number;
  isLoading: boolean;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0
  }).format(value);
}

function formatCoverageDays(value: number | null) {
  if (value === null) {
    return '—';
  }

  if (!Number.isFinite(value)) {
    return '∞';
  }

  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0
  }).format(Math.round(value));
}

export function DashboardMetrics({
  rows,
  periodDays,
  isLoading
}: DashboardMetricsProps) {
  const totalStock = rows.reduce((sum, row) => sum + Math.max(row.stock ?? 0, 0), 0);
  const totalOrders = rows.reduce((sum, row) => sum + row.ordersTotal, 0);
  const averageDailyOrders = periodDays > 0 ? totalOrders / periodDays : 0;
  const stockCoverageDays =
    totalStock === 0 ? 0 : averageDailyOrders > 0 ? totalStock / averageDailyOrders : Infinity;

  if (isLoading) {
    return (
      <section className="metrics-grid">
        <div className="metric-card">
          <div className="loading-grid">
            <div className="loading-bar" />
          </div>
        </div>
        <div className="metric-card">
          <div className="loading-grid">
            <div className="loading-bar" />
          </div>
        </div>
        <div className="metric-card">
          <div className="loading-grid">
            <div className="loading-bar" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="metrics-grid">
      <article className="metric-card stock">
        <span className="metric-kicker">Общие остатки</span>
        <strong className="metric-value">{formatNumber(totalStock)}</strong>
      </article>

      <article className="metric-card orders">
        <span className="metric-kicker">Заказы за {periodDays} дней</span>
        <strong className="metric-value">{formatNumber(totalOrders)}</strong>
      </article>

      <article className="metric-card coverage">
        <span className="metric-kicker">Товарный запас</span>
        <strong className="metric-value">{formatCoverageDays(stockCoverageDays)} дн.</strong>
      </article>
    </section>
  );
}
