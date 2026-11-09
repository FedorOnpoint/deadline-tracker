import { usePreferences } from '../preferences';

export function AppearanceSettings() {
  const { preferences, updatePreferences, error } = usePreferences();
  return (
    <section className="appearance-settings" aria-labelledby="appearance-heading">
      <h3 id="appearance-heading">Интерфейс</h3>
      <label>
        Тема
        <select
          aria-label="Тема"
          value={preferences.theme}
          onChange={(event) =>
            updatePreferences({ theme: event.target.value === 'light' ? 'light' : 'dark' })
          }
        >
          <option value="dark">Тёмная</option>
          <option value="light">Светлая</option>
        </select>
      </label>
      <label>
        Фильтры при открытии приложения
        <select
          aria-label="Фильтры при открытии приложения"
          value={preferences.filtersExpanded ? 'expanded' : 'collapsed'}
          onChange={(event) =>
            updatePreferences({ filtersExpanded: event.target.value === 'expanded' })
          }
        >
          <option value="expanded">Развёрнуты</option>
          <option value="collapsed">Свёрнуты</option>
        </select>
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
