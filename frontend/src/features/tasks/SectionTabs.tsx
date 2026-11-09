import { useId } from 'react';
import type { SectionDefinition, Task } from '../../shared/types';

export function SectionTabs({
  sections,
  tasks,
  selected,
  onSelect,
  onCreate,
  disabled,
}: {
  sections: SectionDefinition[];
  tasks: Task[];
  selected: string;
  onSelect: (key: string) => void;
  onCreate: (parent: SectionDefinition | null) => void;
  disabled: boolean;
}) {
  const childID = useId();
  const current = sections.find((section) => section.key === selected);
  const parent = sections.find((section) => section.key === current?.parent_key) ?? current;
  const children = sections.filter((section) => section.parent_key === parent?.key);
  const counts = new Map<string, number>();
  for (const task of tasks) counts.set(task.section, (counts.get(task.section) ?? 0) + 1);
  return (
    <div className="section-navigation">
      <nav className="section-tabs" aria-label="Разделы задач">
        {sections
          .filter((section) => !section.parent_key)
          .map((section) => {
            const descendants = sections.filter((child) => child.parent_key === section.key);
            const active = parent?.key === section.key;
            const count = descendants.length
              ? descendants.reduce((total, child) => total + (counts.get(child.key) ?? 0), 0)
              : (counts.get(section.key) ?? 0);
            return (
              <button
                key={section.key}
                type="button"
                className={active ? 'active' : ''}
                aria-pressed={active}
                aria-expanded={descendants.length ? active : undefined}
                aria-controls={descendants.length && active ? childID : undefined}
                onClick={() => onSelect(descendants[0]?.key ?? section.key)}
              >
                <span className="section-label">{section.label}</span>
                <span className="count">{count}</span>
                {descendants.length > 0 && (
                  <svg
                    className={`section-chevron ${active ? 'is-expanded' : ''}`}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                )}
              </button>
            );
          })}
        <button
          type="button"
          className="section-create"
          disabled={disabled}
          onClick={() => onCreate(null)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Новый раздел</span>
        </button>
      </nav>
      {parent && (
        <nav
          key={parent?.key}
          id={childID}
          className="section-tabs section-tabs-children"
          aria-label={`Подразделы: ${parent?.label}`}
        >
          {children.map((child) => (
            <button
              key={child.key}
              type="button"
              className={selected === child.key ? 'active' : ''}
              aria-pressed={selected === child.key}
              onClick={() => onSelect(child.key)}
            >
              <span className="section-label">{child.label}</span>
              <span className="count">{counts.get(child.key) ?? 0}</span>
            </button>
          ))}
          <button
            type="button"
            className="section-create"
            disabled={disabled}
            onClick={() => onCreate(parent)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Добавить подраздел</span>
          </button>
        </nav>
      )}
    </div>
  );
}
