import { api } from '../../shared/api/client';
import type { Task, TaskInput } from '../../shared/types';

export type TaskChanges = Partial<Pick<Task, 'completed' | 'status_id'>>;

export const taskApi = {
  list: () => api<Task[]>('/tasks'),
  create: (input: TaskInput) => api<Task>('/tasks', 'POST', input),
  update: (id: number, input: TaskInput) => api<Task>(`/tasks/${id}`, 'PUT', input),
  patch: (id: number, changes: TaskChanges) => api<Task>(`/tasks/${id}`, 'PATCH', changes),
  delete: (id: number) => api<{ deleted: boolean }>(`/tasks/${id}`, 'DELETE'),
  createExamples: () => api<{ message: string }>('/demo', 'POST', {}),
};
