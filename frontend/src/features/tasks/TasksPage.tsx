import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Brand } from '../../shared/ui/Brand';
import { Modal } from '../../shared/ui/Modal';
import { type CatalogKind, type Task, type TaskSection } from '../../shared/types';
import { CatalogManager } from '../catalog/CatalogManager';
import { TaskFilters } from './TaskFilters';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';
import { TaskStats } from './TaskStats';
import { emptyFilters, monthKey, selectTasks, type Filters } from './model';
import { useTaskData } from './useTaskData';
import { CardBuilder } from '../card-builder/CardBuilder';
import { SectionManager } from '../card-builder/SectionManager';

export default function TasksPage({ account }: { account: ReactNode }) {
  const {
    tasks,
    catalog,
    sections,
    loading,
    error,
    dismissError,
    notice,
    dismissNotice,
    busyIDs,
    saving,
    deleting: isDeleting,
    creatingExamples,
    refresh,
    retry,
    createTask,
    updateTask,
    patchTask,
    deleteTask,
    createExamples,
  } = useTaskData();
  const [now, setNow] = useState(Date.now());
  const [selectedSection, setSection] = useState<TaskSection>('medznat');
  const section = sections.some((entry) => entry.key === selectedSection)
    ? selectedSection
    : (sections[0]?.key ?? '');
  const [filtersBySection, setFiltersBySection] = useState<Record<TaskSection, Filters>>({});
  const filters = filtersBySection[section] ?? emptyFilters;
  function setFilters(next: Filters | ((previous: Filters) => Filters)) {
    setFiltersBySection((previous) => ({
      ...previous,
      [section]: typeof next === 'function' ? next(previous[section] ?? emptyFilters) : next,
    }));
  }
  const [sort, setSort] = useState('deadline-asc');
  const [grouped, setGrouped] = useState(false);
  const [form, setForm] = useState<Task | 'new' | null>(null);
  const [manage, setManage] = useState<CatalogKind | null>(null);
  const [manageSections, setManageSections] = useState(false);
  const [buildCard, setBuildCard] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const sectionPlatforms = useMemo(
    () => catalog.filter((item) => item.kind === 'platform' && item.section === section),
    [catalog, section],
  );
  const sectionTasks = useMemo(() => {
    const platformIDs = new Set(sectionPlatforms.map((item) => item.id));
    return tasks.filter((task) => platformIDs.has(task.platform_id));
  }, [tasks, sectionPlatforms]);
  const hasActivePlatform = sectionPlatforms.some((platform) => !platform.archived);
  const visible = useMemo(
    () => selectTasks(sectionTasks, filters, sort, now),
    [sectionTasks, filters, sort, now],
  );
  const months = [...new Set(sectionTasks.map(monthKey))].sort();
  const sectionDefinition = sections.find((entry) => entry.key === section);
  const sectionLabel = sectionDefinition?.label ?? 'Записи';
  async function remove() {
    if (deleting && (await deleteTask(deleting.id))) setDeleting(null);
  }
  return (
    <>
      <a className="skip-link" href="#records">
        К записям
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <div className="topbar-actions">
            <button
              className="settings"
              disabled={loading || !sections.length}
              onClick={() => setManage('status')}
            >
              <span aria-hidden="true">⚙</span> Справочники
            </button>
            {account}
          </div>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">МАТЕРИАЛЫ И РАССЫЛКИ</div>
            <h1>
              Всё в своё время<span className="accent">.</span>
            </h1>
            <p className="subtitle">
              От подготовки материала до размещения — все сроки в одном месте.
            </p>
          </div>
          <button
            className="primary add-button"
            disabled={loading || !sectionDefinition || !hasActivePlatform}
            onClick={() => setForm('new')}
          >
            <span aria-hidden="true">＋</span> Новая запись
          </button>
        </div>
        <nav className="section-tabs" aria-label="Разделы задач">
          {sections.map((taskSection) => {
            const ids = new Set(
              catalog
                .filter((item) => item.kind === 'platform' && item.section === taskSection.key)
                .map((item) => item.id),
            );
            return (
              <button
                key={taskSection.key}
                aria-pressed={section === taskSection.key}
                className={section === taskSection.key ? 'active' : ''}
                onClick={() => setSection(taskSection.key)}
              >
                {taskSection.label}
                <span className="count">
                  {tasks.filter((task) => ids.has(task.platform_id)).length}
                </span>
              </button>
            );
          })}
          <button
            className="section-manage"
            disabled={loading || !sections.length}
            onClick={() => setManageSections(true)}
          >
            <span aria-hidden="true">＋</span> Разделы
          </button>
        </nav>
        <TaskStats
          tasks={sectionTasks}
          now={now}
          loading={loading}
          sectionLabel={sectionLabel}
          selectedUrgency={filters.urgency}
          onSelect={(urgency) => setFilters({ ...emptyFilters, urgency })}
        />
        {error && (
          <div className="error banner" role="alert">
            <span>{error}</span>
            <button onClick={() => void retry()}>Повторить</button>
          </div>
        )}
        {notice && (
          <div className="notice banner" role="status">
            <span>{notice}</span>
            <button onClick={dismissNotice} aria-label="Скрыть сообщение">
              ×
            </button>
          </div>
        )}
        <TaskFilters
          catalog={catalog}
          sectionPlatforms={sectionPlatforms}
          sectionLabel={sectionLabel}
          months={months}
          filters={filters}
          onChange={setFilters}
        />
        <div className="list-toolbar">
          <h2 id="records" tabIndex={-1}>
            {sectionLabel} <span className="count">{visible.length}</span>
          </h2>
          <div className="view-controls">
            <button
              className="builder-button"
              disabled={loading || !sectionDefinition}
              onClick={() => setBuildCard(true)}
            >
              Конструктор карточки
            </button>
            <div className="tabs" role="group" aria-label="Режим списка">
              <button
                aria-pressed={!grouped}
                className={!grouped ? 'active' : ''}
                onClick={() => setGrouped(false)}
              >
                Общий список
              </button>
              <button
                aria-pressed={grouped}
                className={grouped ? 'active' : ''}
                onClick={() => setGrouped(true)}
              >
                По группам
              </button>
            </div>
            <select aria-label="Сортировка" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="deadline-asc">Дедлайн: сначала ближайшие ↑</option>
              <option value="deadline-desc">Дедлайн: сначала дальние ↓</option>
              <option value="email-asc">Дата e-mail: по возрастанию ↑</option>
              <option value="email-desc">Дата e-mail: по убыванию ↓</option>
            </select>
          </div>
        </div>
        <p className="list-note">
          Сначала незавершённые · месяц определяется по дате e-mail, при её отсутствии — по дедлайну
        </p>
        {loading ? (
          <div className="empty" role="status">
            Загружаем редакционный план…
          </div>
        ) : !visible.length ? (
          <div className="empty">
            <span className="empty-symbol" aria-hidden="true">
              ▤
            </span>
            <h3>{sectionTasks.length ? 'Ничего не нашлось' : 'В разделе пока нет записей'}</h3>
            <p>
              {sectionTasks.length && 'Измените запрос или сбросьте фильтры.'}
              {!sectionTasks.length &&
                hasActivePlatform &&
                `Добавьте первую запись в раздел «${sectionLabel}».`}
              {!sectionTasks.length &&
                !hasActivePlatform &&
                `Добавьте площадку в раздел «${sectionLabel}», чтобы создавать записи.`}
            </p>
            <div className="empty-actions">
              {sectionTasks.length ? (
                <button onClick={() => setFilters(emptyFilters)}>Сбросить фильтры</button>
              ) : (
                <>
                  {hasActivePlatform ? (
                    <button className="primary" onClick={() => setForm('new')}>
                      Новая запись
                    </button>
                  ) : (
                    <button className="primary" onClick={() => setManage('platform')}>
                      Добавить площадку
                    </button>
                  )}
                  {!tasks.length && hasActivePlatform && (
                    <button disabled={creatingExamples} onClick={() => void createExamples()}>
                      {creatingExamples ? 'Создание…' : 'Добавить примеры'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <TaskList
            tasks={visible}
            catalog={catalog}
            fields={sectionDefinition?.fields ?? []}
            grouped={grouped}
            now={now}
            busyIDs={busyIDs}
            onEdit={setForm}
            onDelete={(task) => {
              dismissError();
              setDeleting(task);
            }}
            onPatch={patchTask}
          />
        )}
        <footer>
          <span>
            <span className="online-dot" />
            Срочность обновляется автоматически
          </span>
          <span>Время браузера · {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
        </footer>
      </main>
      {form && (
        <TaskForm
          defaultPlatformID={sectionPlatforms.find((item) => !item.archived)?.id || 0}
          task={form === 'new' ? null : form}
          catalog={catalog}
          sections={sections}
          onClose={() => setForm(null)}
          onSave={(input) => (form === 'new' ? createTask(input) : updateTask(form.id, input))}
          saving={saving}
        />
      )}
      {manage && (
        <CatalogManager
          catalog={catalog}
          sections={sections}
          defaultSection={section}
          initialKind={manage}
          onClose={() => setManage(null)}
          onSaved={refresh}
        />
      )}
      {manageSections && (
        <SectionManager
          sections={sections}
          catalog={catalog}
          defaultSection={section}
          onClose={() => setManageSections(false)}
          onSaved={refresh}
        />
      )}
      {buildCard && sectionDefinition && (
        <CardBuilder
          section={sectionDefinition}
          catalog={catalog}
          onClose={() => setBuildCard(false)}
          onSaved={refresh}
        />
      )}
      {deleting && (
        <Modal
          title="Удалить запись?"
          onClose={() => {
            if (!isDeleting) setDeleting(null);
          }}
        >
          <p className="delete-topic">{deleting.topic}</p>
          <p className="muted">
            Запись и история её уведомлений будут удалены. Это действие нельзя отменить.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button disabled={isDeleting} onClick={() => setDeleting(null)}>
              Отмена
            </button>
            <button className="danger" disabled={isDeleting} onClick={() => void remove()}>
              {isDeleting ? 'Удаление…' : 'Удалить запись'}
            </button>
          </div>
        </Modal>
      )}
      <div className="sr-only" aria-live="polite">
        {!loading && `Найдено записей: ${visible.length}`}
      </div>
    </>
  );
}
