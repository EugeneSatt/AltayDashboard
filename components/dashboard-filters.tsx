import type {
  BrandOption,
  DashboardFiltersState,
  MarketplaceFilter
} from '@/types/dashboard';

type DashboardFiltersProps = {
  filters: DashboardFiltersState;
  brandOptions: BrandOption[];
  isRefreshing: boolean;
  onBrandChange: (brand: string) => void;
  onMarketplaceChange: (marketplace: MarketplaceFilter) => void;
  onPeriodDaysChange: (periodDays: number) => void;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
};

export function DashboardFilters({
  filters,
  brandOptions,
  isRefreshing,
  onBrandChange,
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
          <span className="filter-label">Период, дней (до 14)</span>
          <input
            className="input"
            type="number"
            min={1}
            max={14}
            value={filters.periodDays}
            onChange={(event) => onPeriodDaysChange(Number(event.target.value))}
          />
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
