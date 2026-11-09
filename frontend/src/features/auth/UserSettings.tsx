import { useState, type FormEvent } from 'react';
import { api } from '../../shared/api/client';
import { Modal } from '../../shared/ui/Modal';
import type { User } from '../../shared/types';
import { TelegramSettings } from './TelegramSettings';
import { AvatarSettings } from './AvatarSettings';
import { AppearanceSettings } from '../../shared/ui/AppearanceSettings';

export function UserSettings({
  user,
  onClose,
  onUserChange,
}: {
  user: User;
  onClose: () => void;
  onUserChange: (user: User) => void;
}) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess(false);
    if (password !== confirmation) {
      setError('Пароли не совпадают');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/password', 'POST', { current_password: current, new_password: password });
      setCurrent('');
      setPassword('');
      setConfirmation('');
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Настройки аккаунта"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <AvatarSettings
        user={user}
        onAvatarChange={(hasAvatar) => onUserChange({ ...user, has_avatar: hasAvatar })}
      />
      <AppearanceSettings />
      <TelegramSettings />
      <form onSubmit={submit}>
        <h3>Сменить пароль</h3>
        <label>
          Текущий пароль
          <input
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label>
          Новый пароль
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <p className="hint">Не менее 8 символов. После смены пароля остальные сеансы завершатся.</p>
        <label>
          Повторите новый пароль
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="notice" role="status">
            Пароль изменён. Остальные сеансы завершены.
          </p>
        )}
        <div className="modal-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Закрыть
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Сохранение…' : 'Сохранить пароль'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
