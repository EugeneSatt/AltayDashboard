import { NextResponse } from 'next/server';

import { sanitizePeriodDays } from '@/lib/date/range';
import { serializeError } from '@/lib/errors/serialize-error';
import { logError, logInfo, summarizeMarketplaceResult } from '@/lib/logger/server';
import { getOzonDashboardRows } from '@/services/ozon';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periodDays = sanitizePeriodDays(searchParams.get('periodDays'));

  logInfo('api:ozon', 'Incoming request', {
    periodDays
  });

  try {
    const data = await getOzonDashboardRows(periodDays);
    logInfo('api:ozon', 'Response ready', summarizeMarketplaceResult(data));
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    const payload = serializeError(error, 'ozon');
    logError('api:ozon', 'Request failed', payload);
    return NextResponse.json(payload, {
      status: payload.statusCode ?? 500
    });
  }
}
