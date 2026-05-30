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
