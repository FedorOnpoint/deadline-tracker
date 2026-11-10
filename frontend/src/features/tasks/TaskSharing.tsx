import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../../shared/ui/Modal';
import { UserAvatar } from '../../shared/ui/UserAvatar';
import { useTaskSharing } from './useTaskSharing';

export function TaskSharing({ taskID }: { taskID: number }) {
  const [open, setOpen] = useState(false);
  const {
    members,
    candidates,
    login,
    loading,
    busy,
    error,
    notice,
    changeLogin,
    addMember,
    removeMember,
  } = useTaskSharing(taskID);

  function closePicker() {
    setOpen(false);
    changeLogin('');
  }

  return (
    <>
      <details className="builder-extra task-sharing">
        <summary>Совместная работа</summary>
        <div className="task-sharing-content">
          <p className="hint">
            Участники могут редактировать карточку и менять статус. Управлять доступом и удалять
            карточку можете только вы.
          </p>
          {loading ? (
            <p className="hint" role="status">
              Загрузка участников…
            </p>
          ) : members.length === 0 ? (
            <p className="hint">Пока только вы имеете доступ к карточке</p>
          ) : (
            <ul className="task-members">
              {members.map((member) => (
                <li key={member.id}>
                  <span className="sharing-user">
                    <UserAvatar
                      name={member.name}
                      src={member.has_avatar ? `/api/users/${member.id}/avatar` : undefined}
                    />
                    <span className="sharing-identity">
                      <strong>{member.name}</strong>
                      <span className="muted">@{member.login}</span>
                    </span>
                  </span>
                  <button
                    type="button"
                    className="sharing-remove"
                    disabled={busy}
                    onClick={() => void removeMember(member)}
                    aria-label={`Убрать участника ${member.name}`}
                  >
                    Убрать
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="sharing-add-row">
            <button
              type="button"
              aria-haspopup="dialog"
              disabled={busy || loading}
              onClick={() => setOpen(true)}
            >
              Добавить участника
            </button>
          </div>
          <p className="hint">Изменения доступа сохраняются сразу</p>
          {!open && error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {!open && notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
        </div>
      </details>
      {open &&
        createPortal(
          <Modal title="Добавить участника" onClose={closePicker}>
            <div className="sharing-picker">
              <p className="hint">Выберите, кому дать доступ к редактированию карточки</p>
              <fieldset className="sharing-candidates" disabled={busy || loading}>
                <legend>Пользователи</legend>
                {loading && (
                  <p className="hint" role="status">
                    Загрузка…
                  </p>
                )}
                {!loading && candidates.length === 0 && (
                  <p className="sharing-empty">Все доступные пользователи уже добавлены</p>
                )}
                <div className="sharing-candidate-list">
                  {candidates.map((user) => (
                    <label className="sharing-candidate" key={user.id}>
                      <input
                        type="radio"
                        name={`participant-${taskID}`}
                        value={user.login}
                        checked={login === user.login}
                        onChange={() => changeLogin(user.login)}
                      />
                      <UserAvatar
                        name={user.name}
                        src={user.has_avatar ? `/api/users/${user.id}/avatar` : undefined}
                      />
                      <span className="sharing-identity">
                        <strong>{user.name}</strong>
                        <span className="muted">@{user.login}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
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
              <div className="modal-actions">
                <button type="button" onClick={closePicker}>
                  Закрыть
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={busy || loading || !login.trim()}
                  onClick={() => void addMember()}
                >
                  {busy ? 'Добавление…' : 'Добавить'}
                </button>
              </div>
            </div>
          </Modal>,
          document.body,
        )}
    </>
  );
}
