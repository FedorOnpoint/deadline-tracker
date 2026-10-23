import { createRoot } from 'react-dom/client';
import AuthenticatedApp from './app/AuthGate';
import '@fontsource-variable/golos-text/index.css';
import './app/styles/index.css';
import { PreferencesProvider } from './shared/preferences';

createRoot(document.getElementById('root')!).render(
  <PreferencesProvider>
    <AuthenticatedApp />
  </PreferencesProvider>,
);
