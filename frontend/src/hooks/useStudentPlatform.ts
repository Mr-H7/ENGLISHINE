import { useContext } from 'react';
import { StudentPlatformContext } from '@/contexts/student-platform';

export function useStudentPlatform() {
  const value = useContext(StudentPlatformContext);
  if (!value) throw new Error('useStudentPlatform must be used inside StudentPlatformProvider.');
  return value;
}
