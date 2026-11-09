import { useTelegramSettings } from './useTelegramSettings';

export function TelegramSettings() {
  const {
    settings,
    busy,
    link,
    error,
    notice,
    changePreferences,
    connect,
    disconnect,
    save,
    retry,
  } = useTelegramSettings();
  let connectLabel = 'Подключить Telegram';
  if (busy) connectLabel = 'Подключение…';
  else if (link) connectLabel = 'Обновить ссылку';

  return (
    <section className="telegram-settings" aria-labelledby="telegram-heading">
      <h3 id="telegram-heading">Уведомления в Telegram</h3>
      {!settings && !error && <p role="status">Загрузка…</p>}
      {settings && !settings.available && <p className="hint">Бот пока не настроен на сервере.</p>}
      {settings?.available && (
        <>
          <p className="hint">
            {settings.connected
              ? 'Telegram подключён.'
              : 'Подключите личный Telegram, чтобы получать уведомления.'}{' '}
            В сводке — ваши и совместные задачи: просроченные, на сегодня и ближайшие 7 дней.
          </p>
          {settings.connected ? (
            <button type="button" disabled={busy} onClick={() => void disconnect()}>
              Отключить Telegram
            </button>
          ) : (
            <div className="telegram-connect-actions">
              {link && (
                <a
                  className="telegram-open-bot"
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Открыть бота в Telegram
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="M14 3h7v7M10 14 21 3M21 14v7H3V3h7" />
                  </svg>
                </a>
              )}
              <button
                type="button"
                className={link ? 'reset' : 'primary'}
                disabled={busy}
                onClick={() => void connect()}
              >
                {connectLabel}
              </button>
            </div>
          )}
          {link && (
            <p className="hint telegram-connect-hint" role="status">
              Откройте бота кнопкой выше и нажмите «Запустить» в чате Telegram. Затем вернитесь сюда
              — статус подключения обновится автоматически. Ссылка действует 10 минут.
            </p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label className="check">
              <input
                type="checkbox"
                disabled={busy}
                checked={settings.digest_enabled}
                onChange={(event) => changePreferences({ digest_enabled: event.target.checked })}
              />
              Утренняя сводка
            </label>
            <div className="form-grid">
              <label>
                Время сводки
                <input
                  type="time"
                  required
                  disabled={busy}
                  value={settings.digest_time}
                  onChange={(event) => changePreferences({ digest_time: event.target.value })}
                />
              </label>
              <label>
                Часовой пояс
                <input
                  required
                  disabled={busy}
                  maxLength={100}
                  value={settings.timezone}
                  placeholder="Europe/Moscow"
                  onChange={(event) => changePreferences({ timezone: event.target.value })}
                />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                disabled={busy}
                checked={settings.status_enabled}
                onChange={(event) => changePreferences({ status_enabled: event.target.checked })}
              />
              Изменения статуса карточек
            </label>
            <button disabled={busy}>Сохранить уведомления</button>
          </form>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}{' '}
          <button type="button" disabled={busy} onClick={() => void retry()}>
            Повторить
          </button>
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
