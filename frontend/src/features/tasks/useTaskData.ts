import { useCallback, useEffect, useState } from 'react';
import { api } from '../../shared/api/client';
import type { Catalog, Task, TaskInput } from '../../shared/types';
import { taskApi, type TaskChanges } from './api';

export function useTaskData() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [catalog, setCatalog] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyIDs, setBusyIDs] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creatingExamples, setCreatingExamples] = useState(false);

  const refresh = useCallback(async () => {
    const [loadedTasks, loadedCatalog] = await Promise.all([
      taskApi.list(),
      api<Catalog[]>('/catalog'),
    ]);
    setTasks(loadedTasks);
    setCatalog(loadedCatalog);
  }, []);

  const retry = useCallback(async () => {
    setError('');
    try {
      await refresh();
    } catch (error) {
      setError((error as Error).message);
    }
  }, [refresh]);

  useEffect(() => {
    void retry().finally(() => setLoading(false));
  }, [retry]);

  function replaceTask(updatedTask: Task) {
    setTasks((tasks) => tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
  }

  async function createTask(input: TaskInput) {
    setSaving(true);
    try {
      const createdTask = await taskApi.create(input);
      setTasks((tasks) => [...tasks, createdTask]);
      return createdTask;
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(id: number, input: TaskInput) {
    setSaving(true);
    try {
      const updatedTask = await taskApi.update(id, input);
      replaceTask(updatedTask);
      return updatedTask;
    } finally {
      setSaving(false);
    }
  }

  async function patchTask(id: number, changes: TaskChanges) {
    setBusyIDs((previous) => new Set(previous).add(id));
    setError('');
    try {
      replaceTask(await taskApi.patch(id, changes));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusyIDs((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  }

  async function deleteTask(id: number) {
    setDeleting(true);
    setError('');
    try {
      await taskApi.delete(id);
      setTasks((tasks) => tasks.filter((task) => task.id !== id));
      return true;
    } catch (error) {
      setError((error as Error).message);
      return false;
    } finally {
      setDeleting(false);
    }
  }

  async function createExamples() {
    setCreatingExamples(true);
    setError('');
    try {
      const result = await taskApi.createExamples();
      await refresh();
      setNotice(result.message);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setCreatingExamples(false);
    }
  }

  return {
    tasks,
    catalog,
    loading,
    error,
    notice,
    busyIDs,
    saving,
    deleting,
    creatingExamples,
    refresh,
    retry,
    createTask,
    updateTask,
    patchTask,
    deleteTask,
    createExamples,
    dismissError: () => setError(''),
    dismissNotice: () => setNotice(''),
  };
}
