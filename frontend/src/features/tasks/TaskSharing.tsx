import { useTaskSharing } from './useTaskSharing';

export function TaskSharing({ taskID }: { taskID: number }) {
  const { members, login, loading, busy, error, notice, changeLogin, addMember, removeMember } =
    useTaskSharing(taskID);

  return (
    <details className="builder-extra">
      <summary>Совместная работа</summary>
      <p className="hint">
        Участники могут редактировать эту карточку и менять статус. Удаление и управление доступом
        доступны только вам. Изменения доступа сохраняются сразу.
      </p>
      {loading && <p role="status">Загрузка участников…</p>}
      <ul className="task-members">
        {members.map((member) => (
          <li key={member.id}>
            <span>
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
      <label>
        Логин пользователя в приложении
        <input
          value={login}
          disabled={busy || loading}
          maxLength={100}
          autoComplete="off"
          onChange={(event) => changeLogin(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || loading || !login.trim()}
        onClick={() => void addMember()}
      >
        {busy ? 'Сохранение…' : 'Добавить участника'}
      </button>
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
    </details>
  );
}
