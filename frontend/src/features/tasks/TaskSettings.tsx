import { russianCalendarPeriod } from './russianCalendar';
import { useState } from 'react';
import { sortOptions, usePreferences } from '../../shared/preferences';
import type { CatalogKind, SectionDefinition } from '../../shared/types';
import { AppearanceSettings } from '../../shared/ui/AppearanceSettings';
import { Modal } from '../../shared/ui/Modal';

export function TaskSettings({
  sections,
  section,
  onClose,
  onCatalog,
  onSections,
  onTemplate,
}: {
  sections: SectionDefinition[];
  section: string;
  onClose: () => void;
  onCatalog: (kind: CatalogKind) => void;
  onSections: () => void;
  onTemplate: (section: string) => void;
}) {
  const { preferences, updatePreferences } = usePreferences();
  const [templateSection, setTemplateSection] = useState(
    sections.some((entry) => entry.key === section) ? section : (sections[0]?.key ?? ''),
  );
  return (
    <Modal title="Настройки" onClose={onClose}>
      <div className="task-settings">
        <p className="muted">
          Параметры интерфейса применяются сразу и сохраняются в этом браузере
        </p>
        <AppearanceSettings />
        <section className="settings-section" aria-labelledby="deadline-settings-heading">
          <h3 id="deadline-settings-heading">Сроки</h3>
          <label>
            Подсчёт дней до срока
            <select
              aria-label="Подсчёт дней до срока"
              value={preferences.deadlineCalendar}
              onChange={(event) =>
                updatePreferences({
                  deadlineCalendar: event.target.value === 'ru' ? 'ru' : 'calendar',
                })
              }
            >
              <option value="calendar">Календарные дни</option>
              <option value="ru">Рабочие дни — календарь РФ</option>
            </select>
          </label>
          <p className="hint">
            Федеральная пятидневка с праздниками и переносами на {russianCalendarPeriod} годы. Дата
            дедлайна не переносится. Для других лет показываем календарные дни.
          </p>
        </section>
        <section className="settings-section" aria-labelledby="list-settings-heading">
          <h3 id="list-settings-heading">Список карточек</h3>
          <label className="check">
            <input
              type="checkbox"
              checked={preferences.showStats}
              onChange={(event) => updatePreferences({ showStats: event.target.checked })}
            />
            Показывать сводку
          </label>
          <label>
            Сортировка по умолчанию
            <select
              value={preferences.defaultSort}
              onChange={(event) => {
                const option = sortOptions.find((option) => option.value === event.target.value);
                if (option) updatePreferences({ defaultSort: option.value });
              }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Режим списка по умолчанию
            <select
              value={preferences.defaultGrouped ? 'grouped' : 'list'}
              onChange={(event) =>
                updatePreferences({ defaultGrouped: event.target.value === 'grouped' })
              }
            >
              <option value="list">Общий список</option>
              <option value="grouped">По группам</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={preferences.showCompleted}
              onChange={(event) => updatePreferences({ showCompleted: event.target.checked })}
            />
            Показывать выполненные карточки по умолчанию
          </label>
          <p className="hint">В списке можно временно изменить фильтры</p>
        </section>
        <section className="settings-section" aria-labelledby="catalog-settings-heading">
          <h3 id="catalog-settings-heading">Справочники и разделы</h3>
          <div className="settings-links">
            <button onClick={() => onCatalog('status')}>Статусы</button>
            <button onClick={() => onCatalog('platform')}>Площадки</button>
            <button onClick={() => onCatalog('specialty')}>Аудитории</button>
            <button onClick={onSections}>Разделы</button>
          </div>
        </section>
        <section className="settings-section" aria-labelledby="template-settings-heading">
          <h3 id="template-settings-heading">Шаблоны карточек</h3>
          <label>
            Раздел для настройки шаблона
            <select
              value={templateSection}
              onChange={(event) => setTemplateSection(event.target.value)}
            >
              {sections.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <button disabled={!templateSection} onClick={() => onTemplate(templateSection)}>
            Открыть конструктор карточки
          </button>
          <p className="hint">Шаблон применяется к новым карточкам выбранного раздела</p>
        </section>
        <div className="modal-actions">
          <button onClick={onClose}>Готово</button>
        </div>
      </div>
    </Modal>
  );
}
