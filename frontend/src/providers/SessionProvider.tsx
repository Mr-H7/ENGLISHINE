import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { SessionContext } from '@/contexts/session';
import { authApi, type ApiUser } from '@/services/api';
import type { SessionState, StudentIdentity } from '@/services/contracts';

function toIdentity(user: ApiUser): StudentIdentity {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({
    status: 'loading',
    user: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    void authApi.refresh().then(
      ({ user }) => {
        if (!controller.signal.aborted) {
          setSession({ status: 'authenticated', user: toIdentity(user) });
        }
      },
      () => {
        if (!controller.signal.aborted)
          setSession({ status: 'anonymous', user: null });
      },
    );
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (session.status !== 'authenticated') return undefined;
    const timer = window.setInterval(() => {
      void authApi.refresh().then(
        ({ user }) => setSession({ status: 'authenticated', user: toIdentity(user) }),
        () => setSession({ status: 'anonymous', user: null }),
      );
    }, 8 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [session.status]);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const { user } = await authApi.login(input);
      const identity = toIdentity(user);
      setSession({ status: 'authenticated', user: identity });
      return identity;
    },
    [],
  );

  const signup = useCallback(
    async (input: {
      fullName: string;
      email: string;
      password: string;
      parentPhone?: string;
    }) => {
      const { user } = await authApi.signup(input);
      const identity = toIdentity(user);
      setSession({ status: 'authenticated', user: identity });
      return identity;
    },
    [],
  );

  const signOut = useCallback(async () => {
    await authApi.logout();
    setSession({ status: 'anonymous', user: null });
  }, []);

  const value = useMemo(
    () => ({ ...session, login, signup, signOut }),
    [session, login, signup, signOut],
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
