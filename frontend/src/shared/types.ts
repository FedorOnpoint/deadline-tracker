export type CatalogKind = 'platform' | 'specialty' | 'status';
export type TaskSection = string;
export type CardFieldLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type CardField = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'checkbox' | 'catalog';
  required: boolean;
  visibility: 'summary' | 'details' | 'hidden';
  options?: string[];
  layout?: CardFieldLayout;
};
export type SectionDefinition = {
  key: TaskSection;
  label: string;
  position: number;
  revision: number;
  fields: CardField[];
  deadline_field?: string;
};
export type Catalog = {
  platform_ids?: number[];
  reminder_text?: string;
  id: number;
  kind: CatalogKind;
  name: string;
  color: string;
  position: number;
  archived: boolean;
  section: TaskSection;
};
export type Task = {
  specialty_ids?: number[];
  sms?: boolean;
  date_deadlines?: Record<string, string>;
  section: TaskSection;
  fields?: CardField[];
  base_date?: string;
  deadline_field?: string;
  timezone?: string;
  id: number;
  platform_id: number;
  specialty_id: number | null;
  status_id: number | null;
  deadline: string;
  email_date: string;
  topic: string;
  project: string;
  header: string;
  preheader: string;
  comment: string;
  owner: string;
  custom_fields: Record<string, string>;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type TaskInput = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>;

export type User = {
  id: number;
  login: string;
  name: string;
  role: 'admin' | 'user';
  disabled: boolean;
  created_at: string;
};
