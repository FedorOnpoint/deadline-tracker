import { api } from '../../shared/api/client';
import type { Task, TaskInput, Catalog, SectionDefinition, TaskMember } from '../../shared/types';

export type TaskChanges = Partial<Pick<Task, 'completed' | 'status_id'>>;

export type SharedTask = {
  task: Task;
  catalog: Catalog[];
  section: SectionDefinition;
  owner_name: string;
};

export type { TaskMember } from '../../shared/types';

export const taskApi = {
  candidates: (id: number) => api<TaskMember[]>(`/tasks/${id}/candidates`),
  members: (id: number) => api<TaskMember[]>(`/tasks/${id}/members`),
  addMember: (id: number, login: string) => api(`/tasks/${id}/members`, 'POST', { login }),
  removeMember: (id: number, memberID: number) => api(`/tasks/${id}/members/${memberID}`, 'DELETE'),
  shared: () => api<SharedTask[]>('/tasks/shared'),
  list: () => api<Task[]>('/tasks'),
  create: (input: TaskInput) => api<Task>('/tasks', 'POST', input),
  update: (id: number, input: TaskInput) => api<Task>(`/tasks/${id}`, 'PUT', input),
  patch: (id: number, changes: TaskChanges) => api<Task>(`/tasks/${id}`, 'PATCH', changes),
  delete: (id: number) => api<{ deleted: boolean }>(`/tasks/${id}`, 'DELETE'),
  createExamples: () => api<{ message: string }>('/demo', 'POST', {}),
};
