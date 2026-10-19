import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Brand } from '../../shared/ui/Brand';
import { Modal } from '../../shared/ui/Modal';
import { taskSections, type Task, type TaskSection } from '../../shared/types';
import { CatalogManager } from '../catalog/CatalogManager';
import { TaskFilters } from './TaskFilters';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';
import { TaskStats } from './TaskStats';
import { emptyFilters, monthKey, selectTasks, type Filters } from './model';
import { useTaskData } from './useTaskData';

export default function TasksPage({ account }: { account: ReactNode }) {
  const {
    tasks,
    catalog,
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
  const [section, setSection] = useState<TaskSection>('medznat');
  const [filtersBySection, setFiltersBySection] = useState<Record<TaskSection, Filters>>({
    medznat: { ...emptyFilters },
    onpoint: { ...emptyFilters },
    medpoint: { ...emptyFilters },
    special: { ...emptyFilters },
  });
  const filters = filtersBySection[section];
  function setFilters(next: Filters | ((previous: Filters) => Filters)) {
    setFiltersBySection((previous) => ({
      ...previous,
      [section]: typeof next === 'function' ? next(previous[section]) : next,
    }));
  }
  const [sort, setSort] = useState('deadline-asc');
  const [grouped, setGrouped] = useState(false);
  const [form, setForm] = useState<Task | 'new' | null>(null);
  const [manage, setManage] = useState(false);
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
  const visible = useMemo(
    () => selectTasks(sectionTasks, filters, sort, now),
    [sectionTasks, filters, sort, now],
  );
  const months = [...new Set(sectionTasks.map(monthKey))].sort();
  const sectionLabel = taskSections.find((taskSection) => taskSection.key === section)!.label;
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
            <button className="settings" onClick={() => setManage(true)}>
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
          <button className="primary add-button" onClick={() => setForm('new')}>
            <span aria-hidden="true">＋</span> Новая запись
          </button>
        </div>
        <nav className="section-tabs" aria-label="Разделы задач">
          {taskSections.map((taskSection) => {
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
              {sectionTasks.length
                ? 'Измените запрос или сбросьте фильтры.'
                : `Добавьте первую запись в раздел «${sectionLabel}».`}
            </p>
            <div className="empty-actions">
              {sectionTasks.length ? (
                <button onClick={() => setFilters(emptyFilters)}>Сбросить фильтры</button>
              ) : (
                <>
                  <button className="primary" onClick={() => setForm('new')}>
                    Новая запись
                  </button>
                  {!tasks.length && (
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
          onClose={() => setForm(null)}
          onSave={(input) => (form === 'new' ? createTask(input) : updateTask(form.id, input))}
          saving={saving}
        />
      )}
      {manage && (
        <CatalogManager catalog={catalog} onClose={() => setManage(false)} onSaved={refresh} />
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
