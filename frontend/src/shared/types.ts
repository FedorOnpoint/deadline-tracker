export type CatalogKind = 'platform' | 'specialty' | 'status';
export type TaskSection = 'medznat' | 'onpoint' | 'medpoint' | 'special';
export const taskSections: { key: TaskSection; label: string }[] = [
  { key: 'medznat', label: 'Медзнат' }, { key: 'onpoint', label: 'Онпоинт' },
  { key: 'medpoint', label: 'Медпоинт' }, { key: 'special', label: 'Спецпроекты' },
];
export type Catalog = { id: number; kind: CatalogKind; name: string; color: string; position: number; archived: boolean; section: TaskSection };
export type Task = {
  id: number; platform_id: number; specialty_id: number | null; status_id: number | null;
  deadline: string; email_date: string; topic: string; project: string; header: string;
  preheader: string; comment: string; owner: string; completed: boolean;
  completed_at: string | null; created_at: string; updated_at: string;
};
export type TaskInput = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>;

export type User = { id: number; login: string; name: string; role: 'admin' | 'user'; disabled: boolean; created_at: string };
