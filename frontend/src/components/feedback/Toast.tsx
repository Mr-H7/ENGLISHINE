import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ToastContext } from '@/contexts/toast';
import type { ToastKind } from '@/contexts/toast';

interface ToastMessage {
  id: number;
  message: string;
  kind: ToastKind;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const notify = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now();
    setMessages((current) => [...current, { id, message, kind }]);
    window.setTimeout(
      () => setMessages((current) => current.filter((item) => item.id !== id)),
      4000,
    );
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toast-region" aria-live="polite" aria-atomic="false">
        {messages.map((item) => (
          <div className={`ui-toast is-${item.kind}`} key={item.id}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
