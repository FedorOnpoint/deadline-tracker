import { useEffect, useState, type FormEvent } from 'react';
import App from './App';
import { AdminPanel } from './AdminPanel';
import { api, ApiError } from './api';
import { Modal } from './Modal';
import { Brand } from './Brand';

export type User = { id: number; login: string; name: string; role: 'admin' | 'user'; disabled: boolean; created_at: string };

function Login({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [registration, setRegistration] = useState(false);
  const [login, setLogin] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (registration && password !== confirmation) { setError('Пароли не совпадают'); return; }
    setBusy(true);
    try {
      const user = await api<User>(registration ? '/auth/register' : '/auth/login', 'POST', registration ? { login, name, password, code } : { login, password });
      onAuthenticated(user);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="auth-page">
    <header className="auth-header"><Brand /></header>
    <main className="auth-layout">
      <section className="auth-welcome" aria-label="Дедлайнишная">
        <div className="auth-mascot"><img src="/varenik.svg" alt="Улыбающийся вареник" width="180" height="180" /></div>
        <div className="eyebrow">СВОЁ МЕСТО ДЛЯ ВАЖНЫХ ДЕЛ</div>
        <h1>Все сроки —<br />на своих местах<span className="accent">.</span></h1>
        <p className="subtitle">Материалы, рассылки и планы.<br />Только ваши проекты. Всё в своё время.</p>
      </section>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="tabs auth-tabs" role="group" aria-label="Вход или регистрация">
          <button type="button" disabled={busy} className={!registration ? 'active' : ''} aria-pressed={!registration} onClick={() => { setRegistration(false); setError(''); setPassword(''); setConfirmation(''); }}>Войти</button>
          <button type="button" disabled={busy} className={registration ? 'active' : ''} aria-pressed={registration} onClick={() => { setRegistration(true); setError(''); setPassword(''); setConfirmation(''); }}>По приглашению</button>
        </div>
        <h2 id="auth-title">{registration ? 'Заходите, мы вас ждали' : 'С возвращением'}</h2>
        <p className="form-intro">{registration ? 'Введите код от администратора и создайте свой аккаунт.' : 'Войдите, чтобы вернуться к своим проектам.'}</p>
        <form className="auth-form" onSubmit={submit}>
          {registration && <>
            <label>Код приглашения<input required autoComplete="off" spellCheck={false} maxLength={80} value={code} onChange={e => setCode(e.target.value)} placeholder="Код от администратора" /></label>
            <label>Ваше имя<input required autoComplete="name" maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Как к вам обращаться?" /></label>
          </>}
          <label>Логин<input required autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={64} minLength={registration ? 3 : undefined} pattern={registration ? '[a-zA-Z0-9][a-zA-Z0-9._\-]{2,63}' : undefined} value={login} onChange={e => setLogin(e.target.value)} placeholder="Например, maria.panina" /></label>
          {registration && <p className="hint">От 3 символов: латиница, цифры, точка, дефис и подчёркивание.</p>}
          <label>Пароль<input type="password" required minLength={registration ? 8 : undefined} autoComplete={registration ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={registration ? 'Не менее 8 символов' : 'Ваш пароль'} /></label>
          {registration && <label>Повторите пароль<input type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary auth-submit" disabled={busy}>{busy ? 'Подождите…' : registration ? 'Создать аккаунт' : 'Войти в дедлайнишную'}<span aria-hidden="true">↗</span></button>
        </form>
        <p className="auth-footnote">{registration ? 'Код действует 7 дней и используется один раз.' : 'Нет аккаунта? Получите код приглашения у администратора.'}</p>
      </section>
    </main>
    <footer className="auth-footer">время подавать дедлайны</footer>
  </div>;
}

function UserSettings({ user, onClose }: { user: User; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSuccess(false);
    if (password !== confirmation) { setError('Пароли не совпадают'); return; }
    setBusy(true);
    try {
      await api('/auth/password', 'POST', { current_password: current, new_password: password });
      setCurrent(''); setPassword(''); setConfirmation(''); setSuccess(true);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <Modal title="Настройки аккаунта" onClose={() => { if (!busy) onClose(); }}>
    <div className="profile-summary"><span className="avatar" aria-hidden="true">{user.name.slice(0, 1)}</span><div><strong>{user.name}</strong><p className="muted">@{user.login}</p></div></div>
    <form onSubmit={submit}>
      <h3>Сменить пароль</h3>
      <label>Текущий пароль<input type="password" required autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} /></label>
      <label>Новый пароль<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <p className="hint">Не менее 8 символов. После смены пароля остальные сеансы завершатся.</p>
      <label>Повторите новый пароль<input type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="notice" role="status">Пароль изменён. Остальные сеансы завершены.</p>}
      <div className="modal-actions"><button type="button" disabled={busy} onClick={onClose}>Закрыть</button><button className="primary" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить пароль'}</button></div>
    </form>
  </Modal>;
}

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
    {user.role === 'admin' ? <AdminPanel account={account} /> : <App key={user.id} account={account} />}
    {settings && <UserSettings user={user} onClose={() => setSettings(false)} />}
  </>;
}
