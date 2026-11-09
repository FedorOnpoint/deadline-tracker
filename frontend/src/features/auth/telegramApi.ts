import { api } from '../../shared/api/client';

export type TelegramSettings = {
  available: boolean;
  connected: boolean;
  digest_time: string;
  timezone: string;
  digest_enabled: boolean;
  status_enabled: boolean;
};

export type TelegramPreferences = Pick<
  TelegramSettings,
  'digest_time' | 'timezone' | 'digest_enabled' | 'status_enabled'
>;

export const telegramApi = {
  settings: () => api<TelegramSettings>('/telegram'),
  connect: () => api<{ url: string }>('/telegram/connect', 'POST', {}),
  disconnect: () => api<TelegramSettings>('/telegram', 'DELETE'),
  save: (preferences: TelegramPreferences) =>
    api<TelegramSettings>('/telegram', 'PUT', preferences),
};
