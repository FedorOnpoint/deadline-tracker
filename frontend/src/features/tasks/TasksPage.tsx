import { createPortal } from 'react-dom';
import { useDragNavigation } from './useDragNavigation';
import { useTaskDrag } from './useTaskDrag';
import { moveDestination } from './taskMove';
import { Guide } from '../guide/Guide';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePreferences } from '../../shared/preferences';
import { TaskSettings } from './TaskSettings';
import { Brand } from '../../shared/ui/Brand';
import { Modal } from '../../shared/ui/Modal';
import {
  type CatalogKind,
  type Task,
  type TaskSection,
  type SectionDefinition,
} from '../../shared/types';
import { CatalogManager } from '../catalog/CatalogManager';
import { TaskFilters } from './TaskFilters';
import { TaskForm } from './TaskForm';
import { SharedTasks } from './SharedTasks';
import { TaskList } from './TaskList';
import { TaskStats } from './TaskStats';
import { emptyFilters, monthKey, selectTasks, type Filters } from './model';
import { useTaskData } from './useTaskData';
import { CardBuilder } from '../card-builder/CardBuilder';
import { leafSections, resolveSection } from '../card-builder/sections';
import { SectionTabs } from './SectionTabs';
import { CreateSection } from '../card-builder/CreateSection';
import { SectionManager } from '../card-builder/SectionManager';

export default function TasksPage({ account }: { account: ReactNode }) {
  const {
    tasks,
    sharedTasks,
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
    updateTaskMembers,
    patchTask,
    deleteTask,
    createExamples,
  } = useTaskData();
  const { drag, start: startDrag } = useTaskDrag((task, destination) => {
    if (!sections.some((entry) => entry.key === destination && entry.parent_key)) return;
    void patchTask(task.id, { destination: moveDestination(task, destination, catalog) });
  });
  const dragNavigationRef = useDragNavigation(Boolean(drag));
  const { preferences } = usePreferences();
  const defaultFilters = { ...emptyFilters, completion: preferences.showCompleted ? '' : 'open' };
  const [showShared, setShowShared] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [selectedSection, setSection] = useState<TaskSection>('medznat');
  const section = resolveSection(sections, selectedSection)?.key ?? '';
  const selectableSections = leafSections(sections);
  const [filtersBySection, setFiltersBySection] = useState<Record<TaskSection, Filters>>({});
  const filters = filtersBySection[section] ?? defaultFilters;
  function setFilters(next: Filters | ((previous: Filters) => Filters)) {
    setFiltersBySection((previous) => ({
      ...previous,
      [section]: typeof next === 'function' ? next(previous[section] ?? defaultFilters) : next,
    }));
  }
  const sort = preferences.defaultSort;
  const grouped = preferences.defaultGrouped;
  useEffect(() => {
    setFiltersBySection((previous) =>
      Object.fromEntries(
        Object.entries(previous).map(([key, filters]) => [
          key,
          {
            ...filters,
            completion: preferences.showCompleted ? '' : 'open',
            urgency: filters.urgency === 'done' ? '' : filters.urgency,
          },
        ]),
      ),
    );
  }, [preferences.showCompleted]);
  const [form, setForm] = useState<Task | 'new' | null>(null);
  const sharedForm =
    form && form !== 'new' ? sharedTasks.find((entry) => entry.task.id === form.id) : undefined;
  useEffect(() => {
    if (
      form &&
      form !== 'new' &&
      !loading &&
      !tasks.some((task) => task.id === form.id) &&
      !sharedTasks.some((entry) => entry.task.id === form.id)
    )
      setForm(null);
  }, [form, tasks, sharedTasks, loading]);
  const [newPlatformID, setNewPlatformID] = useState(0);
  function newRecord(platformID = 0) {
    setNewPlatformID(platformID);
    setForm('new');
  }
  const [manage, setManage] = useState<CatalogKind | null>(null);
  const [manageSections, setManageSections] = useState(false);
  const [creatingSection, setCreatingSection] = useState<{
    parent: SectionDefinition | null;
  } | null>(null);
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
    return tasks.filter((task) => task.section === section);
  }, [tasks, section]);
  const hasActivePlatform = sectionPlatforms.some((platform) => !platform.archived);
  const visible = useMemo(
    () => selectTasks(sectionTasks, filters, sort, now, preferences.deadlineCalendar),
    [sectionTasks, filters, sort, now, preferences.deadlineCalendar],
  );
  const months = [...new Set(sectionTasks.map(monthKey))].sort();
  const sectionDefinition = sections.find((entry) => entry.key === section);
  const sectionLabel = sectionDefinition?.label ?? 'Записи';
  const moveTarget = sections.find((entry) => entry.key === drag?.target && entry.parent_key);
  const moveParent = sections.find((entry) => entry.key === moveTarget?.parent_key);
  const moveLabel =
    moveTarget && moveTarget.key !== drag?.task.section
      ? `Перенести в: ${moveParent?.label ?? ''} → ${moveTarget.label}`
      : 'Отпустите над подразделом · Esc — отмена';
  async function remove() {
    if (deleting && (await deleteTask(deleting.id))) setDeleting(null);
  }
  return (
    <>
      {drag &&
        createPortal(
          <>
            <div
              className="task-drag-preview"
              style={{ left: drag.x, top: drag.y }}
              aria-hidden="true"
            >
              <span className="record-id">#{drag.task.id}</span>
              <strong>{drag.task.topic}</strong>
              <span>{moveLabel}</span>
            </div>
          </>,
          document.body,
        )}
      <a className="skip-link" href="#records">
        К записям
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <div className="topbar-actions">
            <button className="settings" disabled={loading} onClick={() => setSettingsOpen(true)}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 17h16M9 4v6m6 4v6" />
              </svg>
              Настройки
            </button>
            <button
              type="button"
              className="settings"
              aria-haspopup="dialog"
              onClick={() => setGuideOpen(true)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M12 5v15m0-15C9 3 5 3 2 4v15c3-1 7-1 10 1m0-15c3-2 7-2 10-1v15c-3-1-7-1-10 1" />
              </svg>
              Справочник
            </button>
            {account}
          </div>
        </div>
      </header>
      <main>
        <div ref={dragNavigationRef} className={`task-navigation${drag ? ' is-dragging' : ''}`}>
          <div className="collaboration-tabs" role="group" aria-label="Доступ к карточкам">
            <button aria-pressed={!showShared} onClick={() => setShowShared(false)}>
              Мои карточки
            </button>
            <button aria-pressed={showShared} onClick={() => setShowShared(true)}>
              Совместные · {sharedTasks.length}
            </button>
          </div>
          {!showShared && (
            <SectionTabs
              sections={sections}
              catalog={catalog}
              onDeleted={refresh}
              dragTarget={drag ? drag.target : undefined}
              tasks={tasks}
              selected={section}
              onSelect={setSection}
              onCreate={(parent) => setCreatingSection({ parent })}
              disabled={loading}
            />
          )}
        </div>
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
        {showShared ? (
          <SharedTasks
            entries={sharedTasks}
            loading={loading}
            now={now}
            busyIDs={busyIDs}
            onEdit={setForm}
            onPatch={patchTask}
          />
        ) : sectionDefinition?.parent_key ? (
          <>
            {preferences.showStats && (
              <TaskStats
                tasks={sectionTasks}
                now={now}
                loading={loading}
                sectionLabel={sectionLabel}
                selectedUrgency={filters.urgency}
                onSelect={(urgency) => setFilters({ ...emptyFilters, urgency })}
              />
            )}
            <h1 className="sr-only" id="records" tabIndex={-1}>
              {sectionLabel}
            </h1>
            <TaskFilters
              catalog={catalog}
              sectionPlatforms={sectionPlatforms}
              months={months}
              filters={filters}
              onChange={setFilters}
              action={
                <button
                  className="primary add-button"
                  disabled={loading || !sectionDefinition}
                  onClick={() => newRecord()}
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
                  Новая запись
                </button>
              }
            />
            {loading ? (
              <div className="empty" role="status">
                Загружаем редакционный план…
              </div>
            ) : !visible.length && !grouped ? (
              <div className="empty">
                <span className="empty-symbol" aria-hidden="true">
                  ▤
                </span>
                <h3>{sectionTasks.length ? 'Ничего не нашлось' : 'В разделе пока нет записей'}</h3>
                <p>
                  {sectionTasks.length && 'Измените запрос или сбросьте фильтры.'}
                  {!sectionTasks.length && `Добавьте первую карточку в раздел «${sectionLabel}».`}
                </p>
                <div className="empty-actions">
                  {sectionTasks.length ? (
                    <button onClick={() => setFilters(emptyFilters)}>Сбросить фильтры</button>
                  ) : (
                    <>
                      <button className="primary" onClick={() => newRecord()}>
                        Новая карточка
                      </button>
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
                draggingID={drag?.task.id}
                onDragStart={startDrag}
                platforms={sectionPlatforms.filter(
                  (platform) => !filters.platform || String(platform.id) === filters.platform,
                )}
                onCreate={newRecord}
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
          </>
        ) : (
          <div className="empty">
            <h3 id="records" tabIndex={-1}>
              {sections.length ? 'Добавьте дочерний раздел' : 'Создайте первый раздел'}
            </h3>
            <p>
              {sectionDefinition
                ? `В разделе «${sectionDefinition.label}» будут дочерние разделы с карточками`
                : 'Создайте основной раздел, а затем добавьте в него дочерние'}
            </p>
            <button
              className="primary"
              disabled={loading}
              onClick={() => setCreatingSection({ parent: sectionDefinition ?? null })}
            >
              {sectionDefinition ? 'Добавить дочерний' : 'Новый раздел'}
            </button>
          </div>
        )}
      </main>
      {form && (
        <TaskForm
          defaultSection={section}
          defaultPlatformID={newPlatformID}
          task={form === 'new' ? null : form}
          catalog={sharedForm?.catalog ?? catalog}
          sections={sharedForm ? [sharedForm.section] : selectableSections}
          canManage={!sharedForm}
          onClose={() => setForm(null)}
          onSave={(input) => (form === 'new' ? createTask(input) : updateTask(form.id, input))}
          saving={saving}
          onTemplateSaved={refresh}
          onMembersChange={updateTaskMembers}
        />
      )}
      {guideOpen && (
        <Guide
          onClose={() => setGuideOpen(false)}
          onSettings={() => {
            setGuideOpen(false);
            setSettingsOpen(true);
          }}
        />
      )}
      {settingsOpen && (
        <TaskSettings
          sections={selectableSections}
          section={section}
          onClose={() => setSettingsOpen(false)}
          onCatalog={(kind) => {
            setSettingsOpen(false);
            setManage(kind);
          }}
          onSections={() => {
            setSettingsOpen(false);
            setManageSections(true);
          }}
          onTemplate={(key) => {
            setSettingsOpen(false);
            setSection(key);
            setBuildCard(true);
          }}
        />
      )}
      {manage && (
        <CatalogManager
          catalog={catalog}
          sections={selectableSections}
          defaultSection={section}
          initialKind={manage}
          onClose={() => setManage(null)}
          onSaved={refresh}
        />
      )}
      {creatingSection && (
        <CreateSection
          parent={creatingSection.parent}
          onClose={() => setCreatingSection(null)}
          onCreated={async (created) => {
            await refresh();
            setSection(created.key);
            setCreatingSection(null);
          }}
        />
      )}
      {manageSections && (
        <SectionManager
          sections={sections}
          catalog={catalog}
          defaultSection={section}
          onClose={() => setManageSections(false)}
          onCreateChild={(parent) => {
            setManageSections(false);
            setCreatingSection({ parent });
          }}
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
        {!loading && `Найдено записей: ${showShared ? sharedTasks.length : visible.length}`}
      </div>
    </>
  );
}
