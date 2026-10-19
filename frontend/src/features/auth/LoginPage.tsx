import { useState, type FormEvent } from 'react';
import { api } from '../../shared/api/client';
import { Brand } from '../../shared/ui/Brand';
import { Varenik } from '../../shared/mascot/Varenik';
import type { User } from '../../shared/types';

export function Login({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [registration, setRegistration] = useState(false);
  const [login, setLogin] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (registration && password !== confirmation) {
      setError('Пароли не совпадают');
      return;
    }
    setBusy(true);
    try {
      const user = await api<User>(
        registration ? '/auth/register' : '/auth/login',
        'POST',
        registration ? { login, name, password, code } : { login, password },
      );
      onAuthenticated(user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <header className="auth-header">
        <Brand />
      </header>
      <main className="auth-layout">
        <section className="auth-welcome" aria-label="Дедлайнишная">
          <Varenik />
          <div className="eyebrow">СВОЁ МЕСТО ДЛЯ ВАЖНЫХ ДЕЛ</div>
          <h1>
            Все сроки —<br />
            на своих местах<span className="accent">.</span>
          </h1>
          <p className="subtitle">
            Материалы, рассылки и планы.
            <br />
            Только ваши проекты. Всё в своё время.
          </p>
        </section>
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="tabs auth-tabs" role="group" aria-label="Вход или регистрация">
            <button
              type="button"
              disabled={busy}
              className={!registration ? 'active' : ''}
              aria-pressed={!registration}
              onClick={() => {
                setRegistration(false);
                setError('');
                setPassword('');
                setConfirmation('');
              }}
            >
              Войти
            </button>
            <button
              type="button"
              disabled={busy}
              className={registration ? 'active' : ''}
              aria-pressed={registration}
              onClick={() => {
                setRegistration(true);
                setError('');
                setPassword('');
                setConfirmation('');
              }}
            >
              По приглашению
            </button>
          </div>
          <h2 id="auth-title">{registration ? 'Заходите, мы вас ждали' : 'С возвращением'}</h2>
          <p className="form-intro">
            {registration
              ? 'Введите код от администратора и создайте свой аккаунт.'
              : 'Войдите, чтобы вернуться к своим проектам.'}
          </p>
          <form className="auth-form" onSubmit={submit}>
            {registration && (
              <>
                <label>
                  Код приглашения
                  <input
                    required
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={80}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Код от администратора"
                  />
                </label>
                <label>
                  Ваше имя
                  <input
                    required
                    autoComplete="name"
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Как к вам обращаться?"
                  />
                </label>
              </>
            )}
            <label>
              Логин
              <input
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={64}
                minLength={registration ? 3 : undefined}
                pattern={registration ? '[a-zA-Z0-9][a-zA-Z0-9._\-]{2,63}' : undefined}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Например, maria.panina"
              />
            </label>
            {registration && (
              <p className="hint">От 3 символов: латиница, цифры, точка, дефис и подчёркивание.</p>
            )}
            <label>
              Пароль
              <input
                type="password"
                required
                minLength={registration ? 8 : undefined}
                autoComplete={registration ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={registration ? 'Не менее 8 символов' : 'Ваш пароль'}
              />
            </label>
            {registration && (
              <label>
                Повторите пароль
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary auth-submit" disabled={busy}>
              {busy ? 'Подождите…' : registration ? 'Создать аккаунт' : 'Войти в дедлайнишную'}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          <p className="auth-footnote">
            {registration
              ? 'Код действует 7 дней и используется один раз.'
              : 'Нет аккаунта? Получите код приглашения у администратора.'}
          </p>
        </section>
      </main>
      <footer className="auth-footer">время подавать дедлайны</footer>
    </div>
  );
}
