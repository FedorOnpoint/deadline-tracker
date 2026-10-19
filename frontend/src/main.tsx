import { createRoot } from 'react-dom/client';
import AuthenticatedApp from './Auth';
import '@fontsource-variable/golos-text/index.css';
import './style.css';
import './auth.css';

createRoot(document.getElementById('root')!).render(<AuthenticatedApp />);
