import type { DashboardRow, DynamicFilter, DynamicTone } from '@/types/dashboard';

const COMPARISON_WINDOW_DAYS = 15;

export type ComparisonDateRanges = {
  previous: string[];
  current: string[];
  rangeSize: number;
};

export type RevenueDynamic = {
  previousRevenue: number;
  currentRevenue: number;
  deltaPercent: number | null;
  tone: DynamicTone;
};

export function getComparisonDateRanges(dates: string[]): ComparisonDateRanges | null {
  if (dates.length >= 31) {
    return {
      previous: dates.slice(-COMPARISON_WINDOW_DAYS * 2, -COMPARISON_WINDOW_DAYS),
      current: dates.slice(-COMPARISON_WINDOW_DAYS),
      rangeSize: COMPARISON_WINDOW_DAYS
    };
  }

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

export function getDeltaPercent(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return ((current - previous) / previous) * 100;
}

export function getRevenueTone(current: number, previous: number): DynamicTone {
  if (current === previous) {
    return 'same';
  }

  return current > previous ? 'up' : 'down';
}

function getPointMap(points: DashboardRow['priceByDay']) {
  return new Map(points.map((item) => [item.date, item.amount] as const));
}

function getRevenueForDates(row: DashboardRow, dates: string[]) {
  const ordersByDate = new Map(row.ordersByDay.map((item) => [item.date, item.count] as const));
  const priceByDate = getPointMap(row.priceByDay ?? []);

  return dates.reduce((sum, date) => {
    const count = ordersByDate.get(date) ?? 0;
    const price = priceByDate.get(date) ?? row.price;

    if (count <= 0 || typeof price !== 'number' || !Number.isFinite(price)) {
      return sum;
    }

    return sum + price * count;
  }, 0);
}

export function getRowRevenueDynamic(
  row: DashboardRow,
  dates: string[]
): RevenueDynamic | null {
  const ranges = getComparisonDateRanges(dates);

  if (!ranges) {
    return null;
  }

  const previousRevenue = getRevenueForDates(row, ranges.previous);
  const currentRevenue = getRevenueForDates(row, ranges.current);

  return {
    previousRevenue,
    currentRevenue,
    deltaPercent: getDeltaPercent(currentRevenue, previousRevenue),
    tone: getRevenueTone(currentRevenue, previousRevenue)
  };
}

export function matchesDynamicFilter(
  row: DashboardRow,
  dates: string[],
  filter: DynamicFilter
) {
  if (filter === 'all') {
    return true;
  }

  const dynamic = getRowRevenueDynamic(row, dates);

  return dynamic?.tone === filter;
}
