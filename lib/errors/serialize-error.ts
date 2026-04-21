import axios from 'axios';

import { AppError } from '@/lib/errors/app-error';
import type { ApiErrorPayload, Marketplace } from '@/types/dashboard';

export function serializeError(error: unknown, marketplace?: Marketplace): ApiErrorPayload {
  if (error instanceof AppError) {
    return {
      marketplace,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode
    };
  }

  if (axios.isAxiosError(error)) {
    return {
      marketplace,
      code: 'HTTP_ERROR',
      message: error.response?.data?.message ?? error.message,
      statusCode: error.response?.status
    };
  }

  if (error instanceof Error) {
    return {
      marketplace,
      code: 'UNEXPECTED_ERROR',
      message: error.message
    };
  }

  return {
    marketplace,
    code: 'UNKNOWN_ERROR',
    message: 'Unknown error'
  };
}
