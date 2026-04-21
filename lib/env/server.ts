import 'server-only';

import { AppError } from '@/lib/errors/app-error';

export function requireServerEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new AppError(`Missing required server env: ${name}`, {
      code: 'CONFIG_ERROR',
      statusCode: 500
    });
  }

  return value;
}
