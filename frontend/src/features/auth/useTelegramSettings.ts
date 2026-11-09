import { useEffect, useState } from 'react';
import { telegramApi, type TelegramSettings, type TelegramPreferences } from './telegramApi';

export function useTelegramSettings() {
  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(preserveDraft = false) {
    try {
      const loaded = await telegramApi.settings();
      setSettings((previous) =>
        preserveDraft && previous
          ? { ...previous, connected: loaded.connected, available: loaded.available }
          : loaded,
      );
      if (loaded.connected) setLink('');
      setError('');
    } catch (error) {
      setError((error as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!link) return;
    const timer = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(timer);
  }, [link]);

  async function connect() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await telegramApi.connect();
      setLink(result.url);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setSettings(await telegramApi.disconnect());
      setLink('');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!settings) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setSettings(
        await telegramApi.save({
          digest_time: settings.digest_time,
          timezone: settings.timezone,
          digest_enabled: settings.digest_enabled,
          status_enabled: settings.status_enabled,
        }),
      );
      setNotice('Настройки Telegram сохранены.');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function changePreferences(changes: Partial<TelegramPreferences>) {
    setSettings((previous) => (previous ? { ...previous, ...changes } : previous));
  }
  return {
    settings,
    busy,
    link,
    error,
    notice,
    changePreferences,
    connect,
    disconnect,
    save,
    retry: () => load(),
  };
}
