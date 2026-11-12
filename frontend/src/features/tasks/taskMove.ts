import type { Catalog, Task } from '../../shared/types';

export type TaskDestination = {
  section: string;
  platform_id: number;
  specialty_ids: number[];
};

export function moveDestination(task: Task, section: string, catalog: Catalog[]): TaskDestination {
  const source = catalog.find(
    (entry) => entry.id === task.platform_id && entry.kind === 'platform',
  );
  const platform =
    source &&
    catalog.find(
      (entry) =>
        entry.kind === 'platform' &&
        entry.section === section &&
        entry.name.trim().toLocaleLowerCase('ru') === source.name.trim().toLocaleLowerCase('ru') &&
        (!entry.archived || entry.id === task.platform_id),
    );
  const platformID = platform?.id ?? 0;
  const audiences = task.specialty_ids ?? (task.specialty_id ? [task.specialty_id] : []);
  return {
    section,
    platform_id: platformID,
    specialty_ids: audiences.filter(
      (id) =>
        platformID !== 0 &&
        (platformID === task.platform_id ||
          catalog.some(
            (entry) =>
              entry.id === id &&
              entry.kind === 'specialty' &&
              entry.platform_ids?.includes(platformID),
          )),
    ),
  };
}
