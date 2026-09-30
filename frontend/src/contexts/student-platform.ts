import { createContext } from 'react';
import type { StageOption, StudentProfile } from '@/services/student-platform';

export interface StudentPlatformContextValue {
  profile: StudentProfile | null;
  stages: StageOption[];
  loading: boolean;
  error: string | null;
  updateGrade(_gradeId: string): Promise<void>;
  updateProfile(input: {
    fullName?: string;
    studentPhone?: string;
    guardianPhone?: string;
    email?: string | null;
  }): Promise<StudentProfile>;
  reload(): Promise<void>;
}

export const StudentPlatformContext =
  createContext<StudentPlatformContextValue | null>(null);
