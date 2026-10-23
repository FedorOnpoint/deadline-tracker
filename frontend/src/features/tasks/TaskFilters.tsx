import { useEffect, useId, useState } from 'react';
import { usePreferences } from '../../shared/preferences';
import type { Catalog } from '../../shared/types';
import { emptyFilters, monthLabel, urgencyLabels, type Filters } from './model';

type TaskFiltersProps = {
  catalog: Catalog[];
  sectionPlatforms: Catalog[];
  sectionLabel: string;
  months: string[];
  filters: Filters;
  onChange: (filters: Filters) => void;
};

export function TaskFilters({
  catalog,
  sectionPlatforms,
  sectionLabel,
  months,
  filters,
  onChange,
}: TaskFiltersProps) {
  const { preferences } = usePreferences();
  const [collapsed, setCollapsed] = useState(!preferences.filtersExpanded);
  useEffect(() => {
    setCollapsed(!preferences.filtersExpanded);
  }, [preferences.filtersExpanded]);
  const panelID = useId();
  const activeFilters = Object.values(filters).filter(Boolean).length;
  function filter<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }
  function catalogOptions(kind: Catalog['kind']) {
    return (
      kind === 'platform'
        ? sectionPlatforms
        : catalog.filter(
            (item) =>
              item.kind === kind &&
              (kind !== 'specialty' ||
                !filters.platform ||
                item.platform_ids?.includes(Number(filters.platform))),
          )
    ).map((item) => (
      <option key={item.id} value={item.id}>
        {item.name}
        {item.archived ? ' (архив)' : ''}
      </option>
    ));
  }
  return (
    <section className="filter-panel" aria-label="Поиск и фильтры" data-expanded={!collapsed}>
      <button
        className="filter-panel-toggle"
        aria-label={collapsed ? 'Показать поиск и фильтры' : 'Свернуть поиск и фильтры'}
        aria-expanded={!collapsed}
        aria-controls={panelID}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="filter-panel-title">
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className={collapsed ? '' : 'is-expanded'}
          >
            <path
              d="m7 5 5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {collapsed ? 'Показать поиск и фильтры' : 'Поиск и фильтры'}
        </span>
        <span className="filter-caption">
          {activeFilters ? `Активно: ${activeFilters}` : sectionLabel}
        </span>
      </button>
      <div
        id={panelID}
        className="filter-panel-content"
        aria-hidden={collapsed}
        inert={collapsed || undefined}
      >
        <div className="filter-panel-fields">
          <div className="search-row">
            <label className="search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                placeholder="Найти тему, материал, текст или ответственного…"
                aria-label="Поиск записей"
                value={filters.query}
                onChange={(e) => filter('query', e.target.value)}
              />
            </label>
            <span className="filter-caption">
              {activeFilters ? `Фильтров: ${activeFilters}` : sectionLabel}
            </span>
            <button
              className="reset"
              disabled={!activeFilters}
              onClick={() => onChange(emptyFilters)}
            >
              Сбросить
            </button>
          </div>
          <div className="filters">
            <label>
              Площадка
              <select
                value={filters.platform}
                onChange={(e) => onChange({ ...filters, platform: e.target.value, specialty: '' })}
              >
                <option value="">Все площадки</option>
                {catalogOptions('platform')}
              </select>
            </label>
            <label>
              Аудитория
              <select
                value={filters.specialty}
                onChange={(e) => filter('specialty', e.target.value)}
              >
                <option value="">Все аудитории</option>
                {catalogOptions('specialty')}
              </select>
            </label>
            <label>
              Рабочий статус
              <select value={filters.status} onChange={(e) => filter('status', e.target.value)}>
                <option value="">Все статусы</option>
                <option value="unset">Не задан</option>
                {catalogOptions('status')}
              </select>
            </label>
            <label>
              Выполнение
              <select
                value={filters.completion}
                onChange={(e) => filter('completion', e.target.value)}
              >
                <option value="">Все записи</option>
                <option value="open">Не выполнено</option>
                <option value="done">Выполнено</option>
              </select>
            </label>
            <label>
              Месяц / год
              <select value={filters.month} onChange={(e) => filter('month', e.target.value)}>
                <option value="">Все месяцы</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {monthLabel(month)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Срочность
              <select value={filters.urgency} onChange={(e) => filter('urgency', e.target.value)}>
                <option value="">Любая срочность</option>
                {Object.entries(urgencyLabels).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
