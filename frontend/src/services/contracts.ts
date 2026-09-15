// Interfaces only. Never infer server authorization from browser state.
export interface StudentIdentity {
  id: string;
  email: string;
  displayName: string;
  roles: Array<'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT'>;
}
export type SessionState =
  | { status: 'unconfigured' | 'loading' | 'anonymous'; user: null }
  | { status: 'authenticated'; user: StudentIdentity };
export interface AuthService {
  getSession(signal?: AbortSignal): Promise<SessionState>;
  signOut(): Promise<void>;
}
export type SessionContextValue = SessionState & {
  login(input: { email: string; password: string }): Promise<StudentIdentity>;
  signup(input: {
    fullName: string;
    email: string;
    password: string;
    parentPhone?: string;
  }): Promise<StudentIdentity>;
  signOut(): Promise<void>;
};
