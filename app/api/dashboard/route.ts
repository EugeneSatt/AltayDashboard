import { NextResponse } from 'next/server';

import { sanitizePeriodDays } from '@/lib/date/range';
import { serializeError } from '@/lib/errors/serialize-error';
import { logError, logInfo, summarizeRows } from '@/lib/logger/server';
import { getDashboardData } from '@/services/dashboard';
import type { MarketplaceFilter } from '@/types/dashboard';

export const dynamic = 'force-dynamic';

function getMarketplace(value: string | null): MarketplaceFilter {
  if (value === 'wb' || value === 'ozon') {
    return value;
  }

  return 'all';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const marketplace = getMarketplace(searchParams.get('marketplace'));
  const periodDays = sanitizePeriodDays(searchParams.get('periodDays'));
  const search = searchParams.get('search') ?? '';

  logInfo('api:dashboard', 'Incoming request', {
    marketplace,
    periodDays,
    search
  });

  try {
    const data = await getDashboardData({
      marketplace,
      periodDays,
      search
    });

    logInfo('api:dashboard', 'Response ready', {
      ...summarizeRows(data.rows),
      dates: data.dates.length,
      source: data.meta.source,
      errors: data.meta.errors.length
    });

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    const payload = serializeError(error);
    logError('api:dashboard', 'Request failed', payload);
    return NextResponse.json(payload, {
      status: payload.statusCode ?? 500
    });
  }
}
