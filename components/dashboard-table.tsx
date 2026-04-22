/* eslint-disable @next/next/no-img-element */

import { DragScroll } from '@/components/drag-scroll';
import { normalizeBrand } from '@/lib/brands';
import type { DashboardRow } from '@/types/dashboard';

type DashboardTableProps = {
  rows: DashboardRow[];
  dates: string[];
  hasData: boolean;
  isLoading: boolean;
};

type DeltaTone = 'up' | 'down' | 'same';

function getMarketplaceArticle(row: DashboardRow) {
  return row.marketplace === 'wb'
    ? row.vendorCode ?? row.article ?? '—'
    : row.offerId ?? row.article ?? '—';
}

function getSkuValue(row: DashboardRow) {
  return row.marketplace === 'wb' ? row.nmId ?? row.sku ?? '—' : row.sku ?? row.productId ?? '—';
}

function getMarketplaceProductUrl(row: DashboardRow) {
  const sku = getSkuValue(row);

  if (sku === '—') {
    return null;
  }

  if (row.marketplace === 'wb') {
    return `https://www.wildberries.ru/catalog/${sku}/detail.aspx`;
  }

  if (row.marketplace === 'ozon') {
    return `https://www.ozon.ru/product/${sku}/`;
  }

  return null;
}

function formatMoney(value: number | null, currency: string | null) {
  if (value === null) {
    return '—';
  }

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: currency ?? 'RUB',
    maximumFractionDigits: 0
  }).format(value);
}

function formatStockCoverageDays(row: DashboardRow, periodDays: number) {
  if (row.stock === null) {
    return '—';
  }

  if (row.stock === 0) {
    return '0';
  }

  if (row.ordersTotal === 0 || periodDays === 0) {
    return '∞';
  }

  const averageDailyOrders = row.ordersTotal / periodDays;
  const coverageDays = row.stock / averageDailyOrders;

  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0
  }).format(Math.round(coverageDays));
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit'
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function getDeltaTone(current: number, previous: number | null): DeltaTone {
  if (previous === null || current === previous) {
    return 'same';
  }

  return current > previous ? 'up' : 'down';
}

export function DashboardTable({
  rows,
  dates,
  hasData,
  isLoading
}: DashboardTableProps) {
  if (isLoading) {
    return (
      <section className="table-card">
        <div className="loading-state">
          <div className="loading-grid">
            <div className="loading-bar" />
            <div className="loading-bar" />
            <div className="loading-bar" />
          </div>
        </div>
      </section>
    );
  }

  if (!hasData) {
    return (
      <section className="table-card">
        <div className="empty-state">
          Нажми <strong>Refresh</strong>, чтобы загрузить данные с WB и Ozon.
        </div>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="table-card">
        <div className="empty-state">Нет данных для текущего набора фильтров.</div>
      </section>
    );
  }

  return (
    <section className="table-card">
      <div className="table-toolbar">
        <h2 className="table-title">Объединенные данные</h2>
        <span className="badge">{dates.length} дней в периоде</span>
      </div>

      <DragScroll className="table-scroll">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Marketplace</th>
              <th>Product</th>
              <th>Brand</th>
              <th>sku</th>
              <th>Артикул WB/OZ</th>
              <th className="numeric">Stock</th>
              <th className="numeric">ТЗ</th>
              <th className="numeric">Price</th>
              <th className="numeric orders-total-heading">Orders total</th>
              {dates.map((date) => (
                <th className="numeric orders-column-heading" key={date}>
                  {formatDateLabel(date)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const dayMap = new Map(
                row.ordersByDay.map((item) => [item.date, item.count] as const)
              );
              const productUrl = getMarketplaceProductUrl(row);

              return (
                <tr key={row.productKey}>
                  <td data-label="Marketplace">
                    <span className="marketplace-pill">{row.marketplace}</span>
                  </td>
                  <td data-label="Product">
                    <div className="product-cell">
                      <div className="product-thumb-wrap">
                        {row.imageUrl ? (
                          productUrl ? (
                            <a
                              className="product-thumb-link"
                              href={productUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Открыть товар на маркетплейсе"
                            >
                              <img
                                className="product-thumb"
                                src={row.imageUrl}
                                alt={row.productName}
                                width={54}
                                height={54}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            </a>
                          ) : (
                            <img
                              className="product-thumb"
                              src={row.imageUrl}
                              alt={row.productName}
                              width={54}
                              height={54}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          )
                        ) : (
                          <div className="product-thumb product-thumb-placeholder">—</div>
                        )}
                      </div>
                      <div>
                        <div className="cell-title">{row.productName}</div>
                        <div className="cell-subtitle">
                          {row.article ?? row.vendorCode ?? row.offerId ?? 'Без артикула'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Бренд">{normalizeBrand(row.brand) ?? '—'}</td>
                  <td data-label="sku">{getSkuValue(row)}</td>
                  <td data-label="Артикул WB/OZ">{getMarketplaceArticle(row)}</td>
                  <td className="numeric" data-label="Stock">
                    {row.stock ?? '—'}
                  </td>
                  <td className="numeric" data-label="ТЗ">
                    {formatStockCoverageDays(row, dates.length)}
                  </td>
                  <td className="numeric" data-label="Price">
                    {formatMoney(row.price, row.currency)}
                  </td>
                  <td className="numeric orders-total-cell" data-label="Orders total">
                    <strong>{row.ordersTotal}</strong>
                  </td>
                  {dates.map((date, index) => {
                    const currentValue = dayMap.get(date) ?? 0;
                    const previousValue =
                      index > 0 ? (dayMap.get(dates[index - 1]) ?? 0) : null;
                    const tone = getDeltaTone(currentValue, previousValue);

                    return (
                      <td
                        className="numeric orders-column-cell"
                        data-label={formatDateLabel(date)}
                        key={`${row.productKey}-${date}`}
                      >
                        <span className={`orders-day-badge ${tone}`}>
                          {currentValue}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </DragScroll>
    </section>
  );
}
