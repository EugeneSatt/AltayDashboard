const MS_IN_DAY = 24 * 60 * 60 * 1000;

export const PERIOD_DAY_OPTIONS = [15, 31] as const;
export const DEFAULT_PERIOD_DAYS = 15;
export const MAX_PERIOD_DAYS = 31;

type PeriodDayOption = (typeof PERIOD_DAY_OPTIONS)[number];

export function sanitizePeriodDays(input: string | number | null | undefined): number {
  const value = typeof input === 'number' ? input : Number(input);

  if (!Number.isFinite(value)) {
    return DEFAULT_PERIOD_DAYS;
  }

  const periodDays = Math.trunc(value);

  return PERIOD_DAY_OPTIONS.includes(periodDays as PeriodDayOption)
    ? periodDays
    : DEFAULT_PERIOD_DAYS;
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getDateRange(periodDays: number, anchor = new Date()) {
  const safePeriod = sanitizePeriodDays(periodDays);
  const todayDate = new Date(
    Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  );
  const endDate = new Date(todayDate.getTime() - MS_IN_DAY);
  const startDate = new Date(endDate.getTime() - (safePeriod - 1) * MS_IN_DAY);
  const dates = Array.from({ length: safePeriod }, (_, index) =>
    formatIsoDate(new Date(startDate.getTime() + index * MS_IN_DAY))
  );

  return {
    periodDays: safePeriod,
    startDate,
    endDate,
    dates
  };
}

export function toIsoDateTime(date: Date, endOfDay = false): string {
  const normalized = new Date(date);

  if (endOfDay) {
    normalized.setUTCHours(23, 59, 59, 999);
  } else {
    normalized.setUTCHours(0, 0, 0, 0);
  }

  return normalized.toISOString();
}

export function getOrderDateKey(value?: string): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatIsoDate(parsed);
}
