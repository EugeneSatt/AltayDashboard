'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

import { BrandAnalytics } from '@/components/brand-analytics';
import { DashboardFilters } from '@/components/dashboard-filters';
import { DashboardMetrics } from '@/components/dashboard-metrics';
import { OrdersChart } from '@/components/orders-chart';
import { DashboardStatus } from '@/components/dashboard-status';
import { DashboardTable } from '@/components/dashboard-table';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  createCanonicalBrandMap,
  getCanonicalBrand,
  getCanonicalBrandFilter,
  normalizeBrand,
  normalizeBrandFilter
} from '@/lib/brands';
import { matchesDynamicFilter } from '@/lib/dashboard-dynamics';
import { DEFAULT_PERIOD_DAYS, sanitizePeriodDays } from '@/lib/date/range';
import { dashboardApiClient } from '@/lib/http/client';
import {
  getCachedDashboardResponse,
  setCachedDashboardResponse
} from '@/lib/indexed-db/cache';
import type {
  BrandOption,
  DashboardFiltersState,
  DashboardResponse,
  DynamicFilter
} from '@/types/dashboard';

const FILTERS_STORAGE_KEY = 'dashboard:filters';

const DEFAULT_FILTERS: DashboardFiltersState = {
  marketplace: 'all',
  periodDays: DEFAULT_PERIOD_DAYS,
  brand: 'all',
  dynamic: 'all',
  search: ''
};

function getCacheKey(periodDays: number) {
  return `dashboard:${periodDays}`;
}

function normalizeDashboardResponseBrands(
  response: DashboardResponse,
  selectedBrand: string
) {
  const brandValues = response.rows.map((row) => row.brand);

  if (selectedBrand !== 'all') {
    brandValues.push(selectedBrand);
  }

  const canonicalByBrand = createCanonicalBrandMap(brandValues);
  const canonicalSelectedBrand = getCanonicalBrandFilter(selectedBrand, canonicalByBrand);
  let hasChanged = false;
  const rows = response.rows.map((row) => {
    const brand = getCanonicalBrand(row.brand, canonicalByBrand);

    if (brand === row.brand) {
      return row;
    }

    hasChanged = true;

    return {
      ...row,
      brand
    };
  });

  return {
    response: hasChanged ? { ...response, rows } : response,
    selectedBrand: canonicalSelectedBrand
  };
}

function loadSavedFilters(): DashboardFiltersState {
  if (typeof window === 'undefined') {
    return DEFAULT_FILTERS;
  }

  try {
    const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);

    if (!raw) {
      return DEFAULT_FILTERS;
    }

    const parsed = JSON.parse(raw) as Partial<DashboardFiltersState>;

    return {
      marketplace:
        parsed.marketplace === 'wb' || parsed.marketplace === 'ozon'
          ? parsed.marketplace
          : 'all',
      periodDays: sanitizePeriodDays(parsed.periodDays),
      brand: normalizeBrandFilter(parsed.brand),
      dynamic: sanitizeDynamicFilter(parsed.dynamic),
      search: typeof parsed.search === 'string' ? parsed.search : ''
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(filters: DashboardFiltersState) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
}

function matchesSearch(rowText: string, search: string) {
  return rowText.toLowerCase().includes(search.toLowerCase());
}

function sanitizeDynamicFilter(value: unknown): DynamicFilter {
  return value === 'up' || value === 'down' || value === 'same' ? value : 'all';
}

export function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFiltersState>(DEFAULT_FILTERS);
  const [pendingPeriodDays, setPendingPeriodDays] = useState(DEFAULT_FILTERS.periodDays);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasLoadedLiveData, setHasLoadedLiveData] = useState(false);
  const deferredSearch = useDeferredValue(filters.search);

  useEffect(() => {
    const savedFilters = loadSavedFilters();

    setFilters(savedFilters);
    setPendingPeriodDays(savedFilters.periodDays);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveFilters(filters);
  }, [filters, isHydrated]);

  useEffect(() => {
    if (!isHydrated || isFetching) {
      return;
    }

    let isMounted = true;

    async function restoreCachedDashboard() {
      try {
        const cached = await getCachedDashboardResponse(getCacheKey(filters.periodDays));

        if (cached && isMounted) {
          const normalized = normalizeDashboardResponseBrands(cached, 'all');
          setData(normalized.response);
        }
      } catch {
        // Cache restore is optional and should not break the page.
      }
    }

    void restoreCachedDashboard();

    return () => {
      isMounted = false;
    };
  }, [filters.periodDays, isFetching, isHydrated]);

  useEffect(() => {
    if (!data || !isHydrated || filters.brand === 'all') {
      return;
    }

    const canonicalByBrand = createCanonicalBrandMap([
      ...data.rows.map((row) => row.brand),
      filters.brand
    ]);
    const canonicalBrand = getCanonicalBrandFilter(filters.brand, canonicalByBrand);

    if (canonicalBrand === filters.brand) {
      return;
    }

    setFilters((current) => ({
      ...current,
      brand: canonicalBrand
    }));
  }, [data, filters.brand, isHydrated]);

  async function loadDashboard() {
    if (!isHydrated) {
      return;
    }

    const startedAt = Date.now();
    const requestId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(startedAt);
    const requestedPeriodDays = sanitizePeriodDays(pendingPeriodDays);
    const cacheKey = getCacheKey(requestedPeriodDays);

    setIsFetching(true);
    setErrorMessage(null);

    try {
      console.info('[dashboard] refresh started', {
        requestId,
        periodDays: requestedPeriodDays,
        cacheKey
      });

      const response = await dashboardApiClient.get<DashboardResponse>('/dashboard', {
        params: {
          periodDays: requestedPeriodDays,
          refreshTs: startedAt
        },
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        }
      });

      const normalized = normalizeDashboardResponseBrands(response.data, filters.brand);
      const normalizedData = normalized.response;

      setData(normalizedData);
      setFilters((current) => ({
        ...current,
        periodDays: requestedPeriodDays,
        brand: normalized.selectedBrand
      }));
      setPendingPeriodDays(requestedPeriodDays);
      setHasLoadedLiveData(true);
      await setCachedDashboardResponse(cacheKey, normalizedData);

      console.info('[dashboard] refresh completed', {
        requestId,
        durationMs: Date.now() - startedAt,
        rows: normalizedData.rows.length,
        updatedAt: normalizedData.updatedAt,
        source: normalizedData.meta.source,
        errors: normalizedData.meta.errors.length
      });
    } catch (error) {
      console.error('[dashboard] refresh failed', {
        requestId,
        durationMs: Date.now() - startedAt,
        error
      });

      setErrorMessage(
        axios.isAxiosError(error)
          ? error.response?.data?.message ?? error.message
          : 'Не удалось обновить данные'
      );
    } finally {
      setIsFetching(false);
    }
  }

  const brandOptions = useMemo<BrandOption[]>(() => {
    if (!data) {
      return [];
    }

    return Array.from(
      new Set(
        data.rows
          .map((row) => normalizeBrand(row.brand))
          .filter((brand): brand is string => Boolean(brand))
      )
    )
      .sort((left, right) => left.localeCompare(right, 'ru'))
      .map((brand) => ({
        value: brand,
        label: brand
      }));
  }, [data]);

  const baseRows = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.rows.filter((row) => {
      if (filters.marketplace !== 'all' && row.marketplace !== filters.marketplace) {
        return false;
      }

      if (!deferredSearch.trim()) {
        return true;
      }

      const haystack = [
        row.productName,
        row.brand,
        row.article,
        row.sku,
        row.offerId,
        row.productId?.toString(),
        row.nmId?.toString(),
        row.vendorCode
      ]
        .filter(Boolean)
        .join(' ');

      return matchesSearch(haystack, deferredSearch);
    });
  }, [data, deferredSearch, filters.marketplace]);

  const filteredRows = useMemo(() => {
    if (filters.brand === 'all') {
      return baseRows;
    }

    return baseRows.filter((row) => normalizeBrand(row.brand) === filters.brand);
  }, [baseRows, filters.brand]);

  const tableRows = useMemo(() => {
    const dates = data?.dates ?? [];

    return filteredRows.filter((row) =>
      matchesDynamicFilter(row, dates, filters.dynamic)
    );
  }, [data?.dates, filteredRows, filters.dynamic]);

  return (
    <main className="dashboard-shell">
      <div className="dashboard-topbar">
        <div className="app-brand">
          <span className="app-brand-kicker">Marketplace analytics</span>
          <strong>Altay Dashboard</strong>
        </div>
        <ThemeToggle />
      </div>

      <DashboardFilters
        filters={filters}
        brandOptions={brandOptions}
        isRefreshing={isFetching}
        periodDays={pendingPeriodDays}
        onBrandChange={(brand) =>
          setFilters((current) => ({
            ...current,
            brand: normalizeBrandFilter(brand)
          }))
        }
        onDynamicChange={(dynamic) =>
          setFilters((current) => ({
            ...current,
            dynamic
          }))
        }
        onMarketplaceChange={(marketplace) =>
          setFilters((current) => ({ ...current, marketplace }))
        }
        onPeriodDaysChange={(periodDays) =>
          setPendingPeriodDays(sanitizePeriodDays(periodDays))
        }
        onSearchChange={(search) =>
          setFilters((current) => ({ ...current, search }))
        }
        onRefresh={() => {
          void loadDashboard();
        }}
      />

      <DashboardStatus
        data={data}
        hasLoadedLiveData={hasLoadedLiveData}
        isFetching={isFetching}
        errorMessage={errorMessage}
      />

      <DashboardMetrics
        rows={filteredRows}
        periodDays={filters.periodDays}
        isLoading={isFetching && !data}
      />

      <BrandAnalytics
        rows={filteredRows}
        allRows={baseRows}
        dates={data?.dates ?? []}
        selectedBrand={filters.brand}
        isLoading={isFetching && !data}
      />

      <OrdersChart
        rows={filteredRows}
        dates={data?.dates ?? []}
        isLoading={isFetching && !data}
      />

      <DashboardTable
        rows={tableRows}
        dates={data?.dates ?? []}
        hasData={Boolean(data)}
        isLoading={isFetching && !data}
      />
    </main>
  );
}
