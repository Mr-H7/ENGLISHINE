import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from '@/router/publicRouter';
import { AppProviders } from '@/providers/AppProviders';
import '@/styles/legacy.css';
import '../../styles.css';
import '../../home-editorial.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
