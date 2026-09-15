import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/useToast';

export function LogoutButton({
  className,
  children,
  onComplete,
}: {
  className?: string;
  children: ReactNode;
  onComplete?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const session = useSession();
  const navigate = useNavigate();
  const toast = useToast();

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      aria-busy={busy}
      onClick={() => {
        setBusy(true);
        void session.signOut().then(
          () => {
            onComplete?.();
            void navigate('/login/', { replace: true });
          },
          () => {
            setBusy(false);
            toast.notify('تعذر تسجيل الخروج. حاول مرة أخرى.');
          },
        );
      }}
    >
      {children}
    </button>
  );
}
