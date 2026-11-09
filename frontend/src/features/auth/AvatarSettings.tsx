import { useRef, useState, type ChangeEvent } from 'react';
import { api } from '../../shared/api/client';
import { UserAvatar } from '../../shared/ui/UserAvatar';
import type { User } from '../../shared/types';

async function prepareAvatar(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Выберите изображение JPEG, PNG или WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Максимальный размер файла — 10 МБ.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Не удалось подготовить изображение.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 256, 256);
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256,
    );
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    bitmap.close();
  }
}

export function AvatarSettings({
  user,
  onAvatarChange,
}: {
  user: User;
  onAvatarChange: (hasAvatar: boolean) => void;
}) {
  const [src, setSrc] = useState(user.has_avatar ? `/api/users/${user.id}/avatar` : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  async function save(image: string) {
    await api('/auth/avatar', 'PUT', { image });
    setSrc(image);
    onAvatarChange(Boolean(image));
    setNotice(image ? 'Фото сохранено.' : 'Фото удалено.');
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await save(await prepareAvatar(file));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось загрузить фото.');
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await save('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось удалить фото.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="avatar-settings" aria-label="Фото профиля">
      <div className="profile-summary">
        <UserAvatar name={user.name} src={src} />
        <div>
          <strong>{user.name}</strong>
          <p className="muted">@{user.login}</p>
        </div>
      </div>
      <div className="avatar-actions">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          disabled={busy}
          onChange={(event) => void upload(event)}
        />
        <button type="button" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Сохранение…' : 'Загрузить фото'}
        </button>
        {src && (
          <button type="button" className="reset" disabled={busy} onClick={() => void remove()}>
            Удалить фото
          </button>
        )}
      </div>
      <p className="hint">
        Фото будет видно при выборе участников карточки. JPEG, PNG или WebP, до 10 МБ.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
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
