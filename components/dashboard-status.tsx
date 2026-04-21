import type { DashboardResponse } from '@/types/dashboard';

type DashboardStatusProps = {
  data: DashboardResponse | null;
  hasLoadedLiveData: boolean;
  isFetching: boolean;
  errorMessage: string | null;
};

function sourceLabel(source: DashboardResponse['meta']['source']) {
  switch (source) {
    case 'live':
      return 'Live API';
    default:
      return 'Partial';
  }
}

export function DashboardStatus({
  data,
  hasLoadedLiveData,
  isFetching,
  errorMessage
}: DashboardStatusProps) {
  if (!data && !errorMessage) {
    return (
      <section className="status-card">
        <div className="status-header">
          <div>
            <h2 className="status-title">Состояние данных</h2>
            <p className="hero-copy">
              Данные не загружены. Нажми <strong>Refresh</strong>, чтобы получить
              актуальные остатки, цены и заказы за последние 14 дней.
            </p>
          </div>

          <div className="status-meta">
            <span className="badge">Ожидает загрузку</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="status-card">
      <div className="status-header">
        <div>
          <h2 className="status-title">Состояние данных</h2>
          {data ? (
            <p className="hero-copy">
              Последнее обновление:{' '}
              {new Date(data.updatedAt).toLocaleString('ru-RU')}
            </p>
          ) : null}
        </div>

        <div className="status-meta">
          {data ? (
            <span className="badge accent">{sourceLabel(data.meta.source)}</span>
          ) : null}
          <span className={`badge ${isFetching ? 'teal' : ''}`}>
            {isFetching ? 'Идет синхронизация' : 'Синхронизировано'}
          </span>
          {data ? <span className="badge">{data.rows.length} строк</span> : null}
          {hasLoadedLiveData ? <span className="badge">Живые данные</span> : null}
        </div>
      </div>

      {errorMessage ? <p className="hero-copy">{errorMessage}</p> : null}

      {data?.meta.errors.length ? (
        <ul className="status-errors">
          {data.meta.errors.map((item) => (
            <li key={`${item.marketplace ?? 'system'}-${item.code}-${item.message}`}>
              {(item.marketplace ?? 'system').toUpperCase()}: {item.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
