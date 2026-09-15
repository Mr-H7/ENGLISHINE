import { createContext } from 'react';

export type ThemeName = 'englishine-dark';
export const ThemeContext = createContext<ThemeName>('englishine-dark');
