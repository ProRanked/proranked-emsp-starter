import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PhevnixProvider } from './context/PhevnixProvider.tsx';
import { App } from './App.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PhevnixProvider>
        <App />
      </PhevnixProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Register the PWA service worker in production only (avoid fighting Vite dev HMR).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW registration is best-effort; the app works fine without it */
    });
  });
}
