import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '../../shared/api/client';
import type { User } from '../../shared/types';
import { Brand } from '../../shared/ui/Brand';

type Invitation = {
  id: number;
  code?: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: string;
  revoked: boolean;
};
function formatInvitationDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function invitationStatus(invite: Invitation, now: number) {
  if (invite.used_at) return 'Использован';
  if (invite.revoked) return 'Отозван';
  if (new Date(invite.expires_at).getTime() <= now) return 'Истёк';
  return 'Активен';
}
export function AdminPanel({ account }: { account: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [created, setCreated] = useState<Invitation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    const [loadedUsers, loadedInvitations] = await Promise.all([
      api<User[]>('/admin/users'),
      api<Invitation[]>('/admin/invitations'),
    ]);
    setUsers(loadedUsers);
    setInvitations(loadedInvitations);
  }, []);
  useEffect(() => {
    void load()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  async function create() {
    setBusy(true);
    setError('');
    setCopied(false);
    try {
      const invite = await api<Invitation>('/admin/invitations', 'POST', {});
      setCreated(invite);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: number) {
    setBusy(true);
    setError('');
    try {
      await api(`/admin/invitations/${id}/revoke`, 'POST', {});
      if (created?.id === id) setCreated(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!created?.code) return;
    try {
      await navigator.clipboard.writeText(created.code);
      setCopied(true);
    } catch {
      setError('Не удалось скопировать автоматически. Выделите код и скопируйте его вручную.');
    }
  }
  return (
    <>
      <a className="skip-link" href="#admin-content">
        К управлению доступом
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <div className="topbar-actions">{account}</div>
        </div>
      </header>
      <main id="admin-content" className="admin-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">АДМИН-ПАНЕЛЬ</div>
            <h1>
              Кого ждём к столу<span className="accent">?</span>
            </h1>
            <p className="subtitle">
              Управляйте приглашениями. У каждого пользователя — свои проекты.
            </p>
          </div>
          <button className="primary add-button" disabled={busy} onClick={() => void create()}>
            {busy ? 'Подождите…' : '＋ Сгенерировать код'}
          </button>
        </div>
        {error && (
          <div className="error banner" role="alert">
            <span>{error}</span>
            <button
              onClick={() => {
                setError('');
                void load().catch((e) => setError((e as Error).message));
              }}
            >
              Повторить
            </button>
          </div>
        )}
        {created && (
          <section className="invite-result" aria-labelledby="invite-result-title">
            <div className="eyebrow">ПРИГЛАШЕНИЕ ГОТОВО</div>
            <h2 id="invite-result-title">Передайте код будущему пользователю</h2>
            <div className="invite-code-row">
              <code>{created.code}</code>
              <button className="primary" onClick={() => void copy()}>
                {copied ? 'Скопировано ✓' : 'Скопировать'}
              </button>
            </div>
            <p className="hint">
              Действует до {formatInvitationDate(created.expires_at)}. Одноразовый. Код показывается
              только сейчас — сохраните его перед выходом.
            </p>
            <a className="invite-site-link" href="/" target="_blank" rel="noreferrer">
              Страница входа и регистрации ↗
            </a>
          </section>
        )}
        <section className="admin-section" aria-labelledby="invitations-title">
          <div className="admin-section-heading">
            <h2 id="invitations-title">
              Приглашения <span className="count">{invitations.length}</span>
            </h2>
            <p className="muted">Срок действия — 7 дней</p>
          </div>
          {loading ? (
            <p role="status" className="admin-empty">
              Загружаем приглашения…
            </p>
          ) : !invitations.length ? (
            <p className="admin-empty">Пока нет приглашений. Сгенерируйте первый код.</p>
          ) : (
            <div className="admin-list">
              {invitations.map((invite) => {
                const state = invitationStatus(invite, now);
                return (
                  <div className="admin-row" key={invite.id}>
                    <div>
                      <strong>Приглашение #{invite.id}</strong>
                      <p className="muted">Создано {formatInvitationDate(invite.created_at)}</p>
                      <p className="muted">До {formatInvitationDate(invite.expires_at)}</p>
                      {invite.used_by && <p className="muted">{invite.used_by}</p>}
                    </div>
                    <div className="admin-row-actions">
                      <span className={`invitation-status ${state === 'Активен' ? 'active' : ''}`}>
                        {state}
                      </span>
                      {state === 'Активен' && (
                        <button disabled={busy} onClick={() => void revoke(invite.id)}>
                          Отозвать
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="admin-section" aria-labelledby="users-title">
          <div className="admin-section-heading">
            <h2 id="users-title">
              Пользователи <span className="count">{users.length}</span>
            </h2>
          </div>
          {loading ? (
            <p role="status" className="admin-empty">
              Загружаем пользователей…
            </p>
          ) : (
            <div className="admin-list">
              {users.map((user) => (
                <div className="admin-row" key={user.id}>
                  <div className="profile-summary">
                    <span className="avatar" aria-hidden="true">
                      {user.name.slice(0, 1)}
                    </span>
                    <div>
                      <strong>{user.name}</strong>
                      <p className="muted">@{user.login}</p>
                    </div>
                  </div>
                  <span className="invitation-status">
                    {user.role === 'admin' ? 'Администратор' : 'Пользователь'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
