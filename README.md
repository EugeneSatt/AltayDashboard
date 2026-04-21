# Marketplace Dashboard MVP

MVP веб-дашборда на `Next.js` + `TypeScript` + `axios` без базы данных.

## Что реализовано

- единый dashboard по `Wildberries` и `Ozon`
- серверные интеграции только внутри `Next.js Route Handlers`
- единая нормализованная модель `DashboardRow`
- объединенная таблица с колонками по дням
- фильтры `marketplace`, `periodDays`, `search`
- кэш ответов в `IndexedDB`
- `localStorage` только для фильтров и UI-state
- мок-режим без токенов для локального запуска

## Структура

- `app/` - App Router, layout, page, API routes
- `components/` - dashboard UI
- `services/` - серверные сервисы WB/Ozon/dashboard
- `types/` - доменные типы
- `lib/indexed-db/` - клиентский кэш
- `lib/normalizers/` - нормализация ответов
- `lib/date/` - диапазоны дат
- `lib/http/` - `axios`-клиенты
- `lib/errors/` - единый формат ошибок

## Переменные окружения

Скопируйте `.env.example` в `.env.local` и заполните:

```bash
WB_API_TOKEN=
WB_API_BASE_URL=https://statistics-api.wildberries.ru

OZON_CLIENT_ID=
OZON_API_KEY=
OZON_API_BASE_URL=https://api-seller.ozon.ru
OZON_PRODUCT_LIST_PATH=/v2/product/info/list
OZON_PRICE_LIST_PATH=/v4/product/info/prices
OZON_STOCK_INFO_PATH=/v3/product/info/stocks
OZON_POSTING_LIST_PATH=/v3/posting/fbs/list
```

Если токены не заданы, сервисы автоматически переключаются на мок-данные.

## Запуск

```bash
npm install
npm run dev
```

## API

- `GET /api/wb?periodDays=14`
- `GET /api/ozon?periodDays=14`
- `GET /api/dashboard?periodDays=14&marketplace=all&search=hoodie`

## Важная оговорка по Ozon

У Ozon версии и тела некоторых seller API методов периодически меняются. Для этого пути вынесены в env-переменные, чтобы интеграцию можно было быстро подстроить под конкретный кабинет без изменений клиентской части.
