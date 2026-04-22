import type {
  BrandOption,
  DashboardFiltersState,
  DynamicFilter,
  MarketplaceFilter
} from '@/types/dashboard';
import { PERIOD_DAY_OPTIONS } from '@/lib/date/range';

type DashboardFiltersProps = {
  filters: DashboardFiltersState;
  brandOptions: BrandOption[];
  isRefreshing: boolean;
  periodDays: number;
  onBrandChange: (brand: string) => void;
  onDynamicChange: (dynamic: DynamicFilter) => void;
  onMarketplaceChange: (marketplace: MarketplaceFilter) => void;
  onPeriodDaysChange: (periodDays: number) => void;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
};

export function DashboardFilters({
  filters,
  brandOptions,
  isRefreshing,
  periodDays,
  onBrandChange,
  onDynamicChange,
  onMarketplaceChange,
  onPeriodDaysChange,
  onSearchChange,
  onRefresh
}: DashboardFiltersProps) {
  return (
    <section className="filters-card">
      <div className="filters-grid filters-grid-wide">
        <label className="filter-field">
          <span className="filter-label">Marketplace</span>
          <select
            className="select"
            value={filters.marketplace}
            onChange={(event) =>
              onMarketplaceChange(event.target.value as MarketplaceFilter)
            }
          >
            <option value="all">All</option>
            <option value="wb">Wildberries</option>
            <option value="ozon">Ozon</option>
          </select>
        </label>

        <label className="filter-field">
          <span className="filter-label">Бренд</span>
          <select
            className="select"
            value={filters.brand}
            onChange={(event) => onBrandChange(event.target.value)}
          >
            <option value="all">Все бренды</option>
            {brandOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span className="filter-label">Динамика SKU</span>
          <select
            className="select"
            value={filters.dynamic}
            onChange={(event) => onDynamicChange(event.target.value as DynamicFilter)}
          >
            <option value="all">Вся динамика</option>
            <option value="down">Падение</option>
            <option value="up">Рост</option>
            <option value="same">Без изменений</option>
          </select>
        </label>

        <label className="filter-field">
          <span className="filter-label">Период</span>
          <select
            className="select"
            value={periodDays}
            onChange={(event) => onPeriodDaysChange(Number(event.target.value))}
          >
            {PERIOD_DAY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} дней
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span className="filter-label">Поиск по товару</span>
          <input
            className="input"
            type="search"
            placeholder="Название, бренд, sku, article, nmId..."
            value={filters.search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <div className="filter-field actions-row">
          <button className="button" type="button" onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? 'Обновление...' : 'Refresh'}
          </button>
        </div>
      </div>
    </section>
  );
}
