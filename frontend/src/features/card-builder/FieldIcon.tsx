import type { CardField } from '../../shared/types';

const fieldPaths: Record<string, string> = {
  topic: 'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6',
  deadline:
    'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm4 10h2v3H9v-3Z',
  platform_id: 'm3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4',
  status_id: 'M20 11v1a8 8 0 1 1-4.7-7.3M9 11l3 3 9-9',
  specialty_id:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm4-3.9a4 4 0 0 1 0 7.8',
  sms: 'M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9ZM7 8h10M7 12h7',
  project: 'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 2h18',
  owner: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  email_date: 'M3 6h18v14H3V6Zm0 1 9 7 9-7M7 2v4m10-4v4',
  header: 'M5 4v16m14-16v16M5 12h14',
  preheader: 'M5 7h14M5 12h14M5 17h9',
  comment: 'M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9ZM7 8h10M7 12h6',
  custom_preset_priority: 'M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0',
  custom_preset_start_date:
    'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm5 9 5 3-5 3v-6Z',
  custom_preset_approval_date:
    'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 12 3 3 5-6',
  custom_preset_publication_date: 'M12 16V3m-4 4 4-4 4 4M4 14v7h16v-7',
  custom_preset_material_link:
    'm10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
  custom_preset_next_step: 'M4 12h16m-6-6 6 6-6 6',
  custom_preset_progress: 'M4 20V10m8 10V4m8 16v-6',
  custom_preset_blocker: 'm12 3 10 18H2L12 3Zm0 6v5m0 3v.1',
};

const typePaths: Partial<Record<CardField['type'], string>> = {
  date: fieldPaths.deadline,
  datetime: fieldPaths.deadline,
  checkbox: 'M3 3h18v18H3V3Zm4 9 3 3 7-7',
  number: 'M9 3 7 21M17 3l-2 18M4 9h17M3 15h17',
  select: 'M4 6h10M4 12h7M4 18h7m4-7 3 3 3-3',
};

export function FieldIcon({ field }: { field: Pick<CardField, 'id' | 'type'> }) {
  const path = fieldPaths[field.id] ?? typePaths[field.type] ?? fieldPaths.preheader;
  return (
    <svg
      className="field-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}
