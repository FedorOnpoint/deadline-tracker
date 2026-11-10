import { useState } from 'react';
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

  return (
    <>
      <button
        type="button"
        className="task-sharing-button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Совместная работа
      </button>
      {open && (
        <Modal title="Совместная работа" onClose={() => setOpen(false)}>
          <div className="task-sharing-content">
            <p className="hint">
              Участники могут редактировать эту карточку и менять статус. Удаление и управление
              доступом доступны только вам. Изменения доступа сохраняются сразу.
            </p>
            {loading && <p role="status">Загрузка участников…</p>}
            <ul className="task-members">
              {members.map((member) => (
                <li key={member.id}>
                  <span className="sharing-user">
                    <UserAvatar
                      name={member.name}
                      src={member.has_avatar ? `/api/users/${member.id}/avatar` : undefined}
                    />
                    {member.name} <span className="muted">@{member.login}</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeMember(member)}
                    aria-label={`Убрать участника ${member.name}`}
                  >
                    Убрать
                  </button>
                </li>
              ))}
            </ul>
            <div className="task-sharing-invite">
              <fieldset className="sharing-candidates" disabled={busy || loading}>
                <legend>Пользователь</legend>
                {loading && <p className="hint">Загрузка…</p>}
                {!loading && candidates.length === 0 && (
                  <p className="hint">Нет пользователей для добавления.</p>
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
                      <span>
                        <strong>{user.name}</strong>
                        <span className="muted">@{user.login}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="button"
                disabled={busy || loading || !login.trim()}
                onClick={() => void addMember()}
              >
                {busy ? 'Сохранение…' : 'Добавить'}
              </button>
            </div>
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
          </div>
        </Modal>
      )}
    </>
  );
}
