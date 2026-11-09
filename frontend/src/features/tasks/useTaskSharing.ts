import { useEffect, useState } from 'react';
import { taskApi, type TaskMember } from './api';

export function useTaskSharing(taskID: number) {
  const [members, setTaskMembers] = useState<TaskMember[]>([]);
  const [login, setLogin] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    taskApi
      .members(taskID)
      .then((result) => {
        if (active) setTaskMembers(result);
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [taskID]);

  async function changeAccess(member?: TaskMember) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (member) await taskApi.removeMember(taskID, member.id);
      else await taskApi.addMember(taskID, login);
      setTaskMembers(await taskApi.members(taskID));
      if (!member) setLogin('');
      setNotice(
        member ? 'Доступ отозван.' : 'Участник добавлен. Карточка доступна в разделе «Совместные».',
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return {
    members,
    login,
    loading,
    busy,
    error,
    notice,
    changeLogin: setLogin,
    addMember: () => changeAccess(),
    removeMember: (member: TaskMember) => changeAccess(member),
  };
}
