import { createContext } from 'react';
import type { SessionContextValue } from '@/services/contracts';
export const SessionContext = createContext<SessionContextValue>({
  status: 'unconfigured',
  user: null,
  login: () => Promise.reject(new Error('Session provider is unavailable')),
  signup: () => Promise.reject(new Error('Session provider is unavailable')),
  signOut: () => Promise.resolve(),
});
