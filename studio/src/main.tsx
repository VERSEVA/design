import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initTheme } from './theme';
import './studio.css';

initTheme();
createRoot(document.getElementById('studio-root')!).render(<StrictMode><App /></StrictMode>);
