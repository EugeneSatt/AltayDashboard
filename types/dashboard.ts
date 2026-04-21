export type Marketplace = 'wb' | 'ozon';

export type MarketplaceFilter = 'all' | Marketplace;

export type OrdersByDay = {
  date: string;
  count: number;
};

export type PricePointByDay = {
  date: string;
  amount: number | null;
};

export type DashboardRow = {
  marketplace: Marketplace;
  productKey: string;
  productName: string;
  imageUrl?: string;
  brand?: string;
  article?: string;
  sku?: string;
  offerId?: string;
  productId?: string | number;
  nmId?: number;
  vendorCode?: string;
  stock: number | null;
  price: number | null;
  currency: string | null;
  ordersByDay: OrdersByDay[];
  priceByDay: PricePointByDay[];
  priceWithSppByDay: PricePointByDay[];
  ordersTotal: number;
  updatedAt: string;
};

export type ApiErrorPayload = {
  marketplace?: Marketplace;
  code: string;
  message: string;
  statusCode?: number;
};

export type DashboardResponse = {
  rows: DashboardRow[];
  dates: string[];
  updatedAt: string;
  meta: {
    periodDays: number;
    source: 'live' | 'mixed';
    errors: ApiErrorPayload[];
  };
};

export type MarketplaceRowsResult = {
  marketplace: Marketplace;
  rows: DashboardRow[];
  source: 'live';
  updatedAt: string;
};

export type DashboardFiltersState = {
  marketplace: MarketplaceFilter;
  periodDays: number;
  brand: string;
  search: string;
};

export type BrandOption = {
  value: string;
  label: string;
};
