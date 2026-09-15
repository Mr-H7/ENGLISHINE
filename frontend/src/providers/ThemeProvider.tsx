import { useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { ThemeContext } from '@/contexts/theme';

const theme = 'englishine-dark' as const;
export function ThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    document.documentElement.dataset.theme = theme;
  }, []);
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}
