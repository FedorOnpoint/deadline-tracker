import { createRoot } from 'react-dom/client';
import AuthenticatedApp from './app/AuthGate';
import '@fontsource-variable/golos-text/index.css';
import './app/styles/index.css';

createRoot(document.getElementById('root')!).render(<AuthenticatedApp />);
