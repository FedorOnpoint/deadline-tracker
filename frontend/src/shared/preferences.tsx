import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';

type Preferences = {
  theme: 'dark' | 'light';
  filtersExpanded: boolean;
};

const storageKey = 'deadline-tracker:appearance';
const defaults: Preferences = { theme: 'dark', filtersExpanded: true };

function readPreferences(): { preferences: Preferences; error: string } {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return { preferences: defaults, error: '' };
    const value: unknown = JSON.parse(saved);
    if (
      !value ||
      typeof value !== 'object' ||
      !('theme' in value) ||
      (value.theme !== 'dark' && value.theme !== 'light') ||
      !('filtersExpanded' in value) ||
      typeof value.filtersExpanded !== 'boolean'
    ) {
      throw new Error('Invalid appearance preferences');
    }
    return {
      preferences: { theme: value.theme, filtersExpanded: value.filtersExpanded },
      error: '',
    };
  } catch {
    return { preferences: defaults, error: 'Не удалось прочитать настройки этого браузера.' };
  }
}

const PreferencesContext = createContext<{
  preferences: Preferences;
  updatePreferences: (changes: Partial<Preferences>) => void;
  error: string;
} | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readPreferences);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = state.preferences.theme;
  }, [state.preferences.theme]);

  function updatePreferences(changes: Partial<Preferences>) {
    const preferences = { ...state.preferences, ...changes };
    let error = '';
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {
      error = 'Настройки применены, но браузер не разрешил их сохранить.';
    }
    setState({ preferences, error });
  }

  return (
    <PreferencesContext.Provider value={{ ...state, updatePreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('PreferencesProvider is required');
  return context;
}
