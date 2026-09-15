import { createContext } from 'react';
import type { StageOption, StudentProfile } from '@/services/student-platform';

export interface StudentPlatformContextValue {
  profile: StudentProfile | null;
  stages: StageOption[];
  loading: boolean;
  error: string | null;
  updateGrade(gradeId: string): Promise<void>;
  reload(): Promise<void>;
}

export const StudentPlatformContext =
  createContext<StudentPlatformContextValue | null>(null);
