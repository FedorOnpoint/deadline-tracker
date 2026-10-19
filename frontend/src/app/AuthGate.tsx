import { useEffect, useState } from 'react';
import TasksPage from '../features/tasks/TasksPage';
import { AdminPanel } from '../features/admin/AdminPanel';
import { Login } from '../features/auth/LoginPage';
import { UserSettings } from '../features/auth/UserSettings';
import { api, ApiError } from '../shared/api/client';
import type { User } from '../shared/types';

export default function AuthenticatedApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void api<User>('/auth/me').then(result => { if (active) setUser(result); }).catch(e => {
      if (active && !(e instanceof ApiError && e.status === 401)) setError((e as Error).message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    const expired = () => { setUser(null); setSettings(false); };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  async function logout() {
    setLoggingOut(true); setError('');
    try { await api('/auth/logout', 'POST', {}); setUser(null); setSettings(false); }
    catch (e) { setError((e as Error).message); }
    finally { setLoggingOut(false); }
  }
  if (loading) return <div className="auth-loading" role="status"><img src="/varenik.svg" alt="" width="64" height="64" /><p>Накрываем на стол…</p></div>;
  if (!user && error) return <div className="auth-loading"><p role="alert">{error}</p><button onClick={() => setAttempt(n => n + 1)}>Повторить</button></div>;
  if (!user) return <Login onAuthenticated={setUser} />;
  const account = <><button className="account-button" onClick={() => setSettings(true)} aria-label={`Настройки аккаунта: ${user.name}`}><span className="avatar" aria-hidden="true">{user.name.slice(0, 1)}</span><span>{user.name}</span></button><button className="logout-button" disabled={loggingOut} onClick={() => void logout()}>{loggingOut ? 'Выходим…' : 'Выйти'}</button></>;
  return <>
    {error && <div className="error session-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Скрыть ошибку">×</button></div>}
    {user.role === 'admin' ? <AdminPanel account={account} /> : <TasksPage key={user.id} account={account} />}
    {settings && <UserSettings user={user} onClose={() => setSettings(false)} />}
  </>;
}
