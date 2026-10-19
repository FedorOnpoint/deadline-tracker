import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { CatalogManager } from './CatalogManager';
import { Modal } from './Modal';
import { TaskCard } from './TaskCard';
import { TaskForm } from './TaskForm';
import { emptyFilters, monthKey, monthLabel, selectTasks, taskSections, urgency, urgencyLabels, type Catalog, type Filters, type Task, type TaskSection } from './model';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [catalog, setCatalog] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const [section, setSection] = useState<TaskSection>('medznat');
  const [filtersBySection, setFiltersBySection] = useState<Record<TaskSection, Filters>>({ medznat: { ...emptyFilters }, onpoint: { ...emptyFilters }, medpoint: { ...emptyFilters }, special: { ...emptyFilters } });
  const filters = filtersBySection[section];
  function setFilters(next: Filters | ((previous: Filters) => Filters)) {
    setFiltersBySection(previous => ({ ...previous, [section]: typeof next === 'function' ? next(previous[section]) : next }));
  }
  const [sort, setSort] = useState('deadline-asc');
  const [grouped, setGrouped] = useState(false);
  const [form, setForm] = useState<Task | 'new' | null>(null);
  const [manage, setManage] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [busyIDs, setBusyIDs] = useState<Set<number>>(new Set());
  const [working, setWorking] = useState(false);
  const load = useCallback(async () => {
    const [ts, cs] = await Promise.all([api<Task[]>('/tasks'), api<Catalog[]>('/catalog')]);
    setTasks(ts); setCatalog(cs);
  }, []);
  useEffect(() => { void load().catch(e => setError((e as Error).message)).finally(() => setLoading(false)); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const sectionPlatforms = useMemo(() => catalog.filter(c => c.kind === 'platform' && c.section === section), [catalog, section]);
  const sectionTasks = useMemo(() => {
    const platformIDs = new Set(sectionPlatforms.map(c => c.id));
    return tasks.filter(t => platformIDs.has(t.platform_id));
  }, [tasks, sectionPlatforms]);
  const visible = useMemo(() => selectTasks(sectionTasks, filters, sort, now), [sectionTasks, filters, sort, now]);
  const months = [...new Set(sectionTasks.map(monthKey))].sort();
  const sectionLabel = taskSections.find(s => s.key === section)!.label;
  const activeFilters = Object.values(filters).filter(Boolean).length;
  function filter<K extends keyof Filters>(key: K, value: Filters[K]) { setFilters(f => ({ ...f, [key]: value })); }
  async function patch(id: number, data: Partial<Task>) {
    setBusyIDs(prev => new Set(prev).add(id)); setError('');
    try { const updated = await api<Task>(`/tasks/${id}`, 'PATCH', data); setTasks(ts => ts.map(t => t.id === id ? updated : t)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusyIDs(prev => { const next = new Set(prev); next.delete(id); return next; }); }
  }
  async function remove() {
    if (!deleting) return;
    setWorking(true); setError('');
    try { await api(`/tasks/${deleting.id}`, 'DELETE'); setTasks(ts => ts.filter(t => t.id !== deleting.id)); setDeleting(null); }
    catch (e) { setError((e as Error).message); } finally { setWorking(false); }
  }
  async function demo() {
    setWorking(true); setError('');
    try { const result = await api<{ message: string }>('/demo', 'POST', {}); await load(); setNotice(result.message); }
    catch (e) { setError((e as Error).message); } finally { setWorking(false); }
  }
  const stats = [
    { label: 'Всего записей', value: sectionTasks.length, key: '', className: '' },
    { label: 'Просрочено', value: sectionTasks.filter(t => urgency(t, now) === 'overdue').length, key: 'overdue', className: 'red' },
    { label: 'Дедлайн меньше недели', value: sectionTasks.filter(t => urgency(t, now) === 'urgent').length, key: 'urgent', className: 'red' },
    { label: 'Выполнено', value: sectionTasks.filter(t => t.completed).length, key: 'done', className: 'green' },
  ];
  const groups: { key: string; label: string; tasks: Task[] }[] = [];
  if (grouped) {
    for (const p of catalog.filter(c => c.kind === 'platform')) {
      const subset = visible.filter(t => t.platform_id === p.id);
      for (const month of [...new Set(subset.map(monthKey))].sort()) groups.push({ key: `${p.id}-${month}`, label: `${p.name} / ${monthLabel(month)}`, tasks: subset.filter(t => monthKey(t) === month) });
    }
  } else groups.push({ key: 'all', label: '', tasks: visible });
  function catalogOptions(kind: Catalog['kind']) {
    return (kind === 'platform' ? sectionPlatforms : catalog.filter(c => c.kind === kind)).map(c => <option key={c.id} value={c.id}>{c.name}{c.archived ? ' (архив)' : ''}</option>);
  }
  return <>
    <a className="skip-link" href="#records">К записям</a>
    <header className="topbar"><div className="topbar-inner"><a href="/" className="brand"><img className="brand-mark" src="/varenik.svg" alt="" width="42" height="42" />дедлайнишная<span className="brand-caption">время подавать дедлайны</span></a><button className="settings" onClick={() => setManage(true)}><span aria-hidden="true">⚙</span> Справочники</button></div></header>
    <main>
      <div className="page-heading"><div><div className="eyebrow">МАТЕРИАЛЫ И РАССЫЛКИ</div><h1>Всё в своё время<span className="accent">.</span></h1><p className="subtitle">От подготовки материала до размещения — все сроки в одном месте.</p></div><button className="primary add-button" onClick={() => setForm('new')}><span aria-hidden="true">＋</span> Новая запись</button></div>
      <nav className="section-tabs" aria-label="Разделы задач">{taskSections.map(s => {
        const ids = new Set(catalog.filter(c => c.kind === 'platform' && c.section === s.key).map(c => c.id));
        return <button key={s.key} aria-pressed={section === s.key} className={section === s.key ? 'active' : ''} onClick={() => setSection(s.key)}>{s.label}<span className="count">{tasks.filter(t => ids.has(t.platform_id)).length}</span></button>;
      })}</nav>
      <section className="stats" aria-label={`Сводка: ${sectionLabel}`}>{stats.map(s => <button key={s.label} className={`stat ${s.className} ${filters.urgency === s.key && s.key ? 'selected' : ''}`} onClick={() => setFilters({ ...emptyFilters, urgency: s.key })}><span>{s.label}</span><strong>{loading ? '—' : s.value.toString().padStart(2, '0')}</strong><span className="stat-arrow" aria-hidden="true">↗</span></button>)}</section>
      {error && <div className="error banner" role="alert"><span>{error}</span><button onClick={() => { setError(''); void load().catch(e => setError((e as Error).message)); }}>Повторить</button></div>}
      {notice && <div className="notice banner" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Скрыть сообщение">×</button></div>}
      <section className="filter-panel" aria-label="Поиск и фильтры">
        <div className="search-row"><label className="search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Найти тему, материал, текст или ответственного…" aria-label="Поиск записей" value={filters.query} onChange={e => filter('query', e.target.value)} /></label><span className="filter-caption">{activeFilters ? `Фильтров: ${activeFilters}` : sectionLabel}</span><button className="reset" disabled={!activeFilters} onClick={() => setFilters(emptyFilters)}>Сбросить</button></div>
        <div className="filters">
          <label>Площадка<select value={filters.platform} onChange={e => filter('platform', e.target.value)}><option value="">Все площадки</option>{catalogOptions('platform')}</select></label>
          <label>Специальность<select value={filters.specialty} onChange={e => filter('specialty', e.target.value)}><option value="">Все специальности</option>{catalogOptions('specialty')}</select></label>
          <label>Рабочий статус<select value={filters.status} onChange={e => filter('status', e.target.value)}><option value="">Все статусы</option><option value="unset">Не задан</option>{catalogOptions('status')}</select></label>
          <label>Выполнение<select value={filters.completion} onChange={e => filter('completion', e.target.value)}><option value="">Все записи</option><option value="open">Не выполнено</option><option value="done">Выполнено</option></select></label>
          <label>Месяц / год<select value={filters.month} onChange={e => filter('month', e.target.value)}><option value="">Все месяцы</option>{months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>
          <label>Срочность<select value={filters.urgency} onChange={e => filter('urgency', e.target.value)}><option value="">Любая срочность</option>{Object.entries(urgencyLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        </div>
      </section>
      <div className="list-toolbar"><h2 id="records" tabIndex={-1}>{sectionLabel} <span className="count">{visible.length}</span></h2><div className="view-controls"><div className="tabs" role="group" aria-label="Режим списка"><button aria-pressed={!grouped} className={!grouped ? 'active' : ''} onClick={() => setGrouped(false)}>Общий список</button><button aria-pressed={grouped} className={grouped ? 'active' : ''} onClick={() => setGrouped(true)}>По группам</button></div><select aria-label="Сортировка" value={sort} onChange={e => setSort(e.target.value)}><option value="deadline-asc">Дедлайн: сначала ближайшие ↑</option><option value="deadline-desc">Дедлайн: сначала дальние ↓</option><option value="email-asc">Дата e-mail: по возрастанию ↑</option><option value="email-desc">Дата e-mail: по убыванию ↓</option></select></div></div>
      <p className="list-note">Сначала незавершённые · месяц определяется по дате e-mail, при её отсутствии — по дедлайну</p>
      {loading ? <div className="empty" role="status">Загружаем редакционный план…</div> : !visible.length ? <div className="empty"><span className="empty-symbol" aria-hidden="true">▤</span><h3>{sectionTasks.length ? 'Ничего не нашлось' : 'В разделе пока нет записей'}</h3><p>{sectionTasks.length ? 'Измените запрос или сбросьте фильтры.' : `Добавьте первую запись в раздел «${sectionLabel}».`}</p><div className="empty-actions">{sectionTasks.length ? <button onClick={() => setFilters(emptyFilters)}>Сбросить фильтры</button> : <><button className="primary" onClick={() => setForm('new')}>Новая запись</button>{!tasks.length && <button disabled={working} onClick={() => void demo()}>{working ? 'Создание…' : 'Добавить примеры'}</button>}</>}</div></div> : <div className="task-list">{groups.map(g => <Fragment key={g.key}>{g.label && <h2 className="group-heading">{g.label}<span className="count">{g.tasks.length}</span></h2>}{g.tasks.map(t => <TaskCard key={t.id} task={t} catalog={catalog} now={now} busy={busyIDs.has(t.id)} onEdit={() => setForm(t)} onDelete={() => { setError(''); setDeleting(t); }} onPatch={data => patch(t.id, data)} />)}</Fragment>)}</div>}
      <footer><span><span className="online-dot" />Срочность обновляется автоматически</span><span>Время браузера · {Intl.DateTimeFormat().resolvedOptions().timeZone}</span></footer>
    </main>
    {form && <TaskForm defaultPlatformID={sectionPlatforms.find(c => !c.archived)?.id || 0} task={form === 'new' ? null : form} catalog={catalog} onClose={() => setForm(null)} onSaved={load} />}
    {manage && <CatalogManager catalog={catalog} onClose={() => setManage(false)} onSaved={load} />}
    {deleting && <Modal title="Удалить запись?" onClose={() => { if (!working) setDeleting(null); }}><p className="delete-topic">{deleting.topic}</p><p className="muted">Запись и история её уведомлений будут удалены. Это действие нельзя отменить.</p>{error && <p role="alert" className="error">{error}</p>}<div className="modal-actions"><button disabled={working} onClick={() => setDeleting(null)}>Отмена</button><button className="danger" disabled={working} onClick={() => void remove()}>{working ? 'Удаление…' : 'Удалить запись'}</button></div></Modal>}
    <div className="sr-only" aria-live="polite">{!loading && `Найдено записей: ${visible.length}`}</div>
  </>;
}
