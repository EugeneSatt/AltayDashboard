export type WbStockItem = {
  nmId?: number;
  supplierArticle?: string;
  barcode?: string;
  subject?: string;
  category?: string;
  brand?: string;
  quantity?: number;
  Price?: number;
  Discount?: number;
  discountedPrice?: number;
  lastChangeDate?: string;
};

export type WbOrderItem = {
  date?: string;
  lastChangeDate?: string;
  nmId?: number;
  supplierArticle?: string;
  barcode?: string;
  subject?: string;
  brand?: string;
  totalPrice?: number;
  priceWithDisc?: number;
  finishedPrice?: number;
  forPay?: number | null;
  spp?: number;
  discountPercent?: number;
  isCancel?: boolean;
  quantity?: number;
};

export type WbCardPhoto = {
  big?: string;
  c246x328?: string;
  c516x688?: string;
  square?: string;
  tm?: string;
};

export type WbContentCard = {
  nmID?: number;
  vendorCode?: string;
  brand?: string;
  title?: string;
  photos?: WbCardPhoto[];
};

export type OzonProductListItem = {
  product_id?: number;
  offer_id?: string;
};

export type OzonProductItem = {
  id?: number;
  product_id?: number;
  offer_id?: string;
  sku?: string | number;
  barcode?: string | string[];
  barcodes?: string[];
  name?: string;
  title?: string;
  primary_image?: string | string[];
};

export type OzonAttributeValue = {
  dictionary_value_id?: number;
  value?: string;
};

export type OzonProductAttribute = {
  id?: number;
  values?: OzonAttributeValue[];
};

export type OzonProductAttributesItem = {
  id?: number;
  offer_id?: string;
  name?: string;
  sku?: number | string;
  primary_image?: string | string[];
  attributes?: OzonProductAttribute[];
};

export type OzonPriceItem = {
  product_id?: number;
  offer_id?: string;
  price?: {
    price?: string | number;
    currency_code?: string;
  };
  price_index?: string | number;
  marketing_price?: string | number;
  commissions_currency_code?: string;
  currency_code?: string;
};

export type OzonStockItem = {
  product_id?: number;
  offer_id?: string;
  present?: number;
  reserved?: number;
  stocks?: Array<{
    present?: number;
    reserved?: number;
  }>;
};

export type OzonPostingItem = {
  order_id?: number;
  posting_number?: string;
  status?: string;
  in_process_at?: string;
  created_at?: string;
  products?: Array<{
    product_id?: number;
    offer_id?: string;
    name?: string;
    quantity?: number;
    sku?: string | number;
    price?: string | number;
    currency_code?: string;
  }>;
  financial_data?: {
    products?: Array<{
      product_id?: number;
      old_price?: number;
      price?: number;
      customer_price?: number;
      payout?: number;
      commission_amount?: number;
      commission_percent?: number;
      total_discount_value?: number;
      total_discount_percent?: number;
      currency_code?: string;
      actions?: string[];
      quantity?: number;
    }>;
  } | null;
};
