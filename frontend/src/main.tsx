import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from './components/ui/tooltip.tsx';
import { DesktopOnly } from './components/layout/DesktopOnly.tsx';

import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesktopOnly>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </DesktopOnly>
  </StrictMode>,
);
