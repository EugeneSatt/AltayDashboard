import { NextResponse } from 'next/server';

import { sanitizePeriodDays } from '@/lib/date/range';
import { serializeError } from '@/lib/errors/serialize-error';
import { logError, logInfo, summarizeMarketplaceResult } from '@/lib/logger/server';
import { getWbDashboardRows } from '@/services/wb';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periodDays = sanitizePeriodDays(searchParams.get('periodDays'));

  logInfo('api:wb', 'Incoming request', {
    periodDays
  });

  try {
    const data = await getWbDashboardRows(periodDays);
    logInfo('api:wb', 'Response ready', summarizeMarketplaceResult(data));
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    const payload = serializeError(error, 'wb');
    logError('api:wb', 'Request failed', payload);
    return NextResponse.json(payload, {
      status: payload.statusCode ?? 500
    });
  }
}
