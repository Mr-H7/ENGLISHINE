import { createContext } from 'react';

export type ToastKind = 'info' | 'success' | 'error';
export interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void;
}
export const ToastContext = createContext<ToastContextValue | null>(null);
