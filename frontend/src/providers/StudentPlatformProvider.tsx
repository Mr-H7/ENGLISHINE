import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StudentPlatformContext } from '@/contexts/student-platform';
import {
  studentPlatformApi,
  type StageOption,
  type StudentProfile,
} from '@/services/student-platform';

export function StudentPlatformProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProfile, nextStages] = await Promise.all([
        studentPlatformApi.profile(),
        studentPlatformApi.grades(),
      ]);
      setProfile(nextProfile);
      setStages(nextStages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تحميل بيانات الطالب.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      studentPlatformApi.profile(),
      studentPlatformApi.grades(),
    ]).then(
      ([nextProfile, nextStages]) => {
        if (!active) return;
        setProfile(nextProfile);
        setStages(nextStages);
        setLoading(false);
      },
      (reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'تعذر تحميل بيانات الطالب.');
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      profile,
      stages,
      loading,
      error,
      updateGrade: async () => {
        throw new Error('تغيير الصف متاح للإدارة فقط.');
      },
      updateProfile: async (input: {
        fullName?: string;
        studentPhone?: string;
        guardianPhone?: string;
        email?: string | null;
      }) => {
        const nextProfile = await studentPlatformApi.updateProfile(input);
        setProfile(nextProfile);
        return nextProfile;
      },
      reload,
    }),
    [profile, stages, loading, error, reload],
  );

  return (
    <StudentPlatformContext.Provider value={value}>
      {children}
    </StudentPlatformContext.Provider>
  );
}
