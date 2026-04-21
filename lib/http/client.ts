import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';

import { AppError } from '@/lib/errors/app-error';

export function createHttpClient(config?: AxiosRequestConfig): AxiosInstance {
  const client = axios.create({
    timeout: 20_000,
    ...config
  });

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ message?: string }>) => {
      throw new AppError(error.response?.data?.message ?? error.message, {
        code: 'HTTP_REQUEST_FAILED',
        statusCode: error.response?.status ?? 502,
        details: error.response?.data
      });
    }
  );

  return client;
}

export const dashboardApiClient = createHttpClient({
  baseURL: '/api',
  timeout: 180_000
});
