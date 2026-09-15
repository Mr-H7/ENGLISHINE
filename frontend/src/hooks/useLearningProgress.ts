import { useCallback, useState } from 'react';

const STORAGE_KEY = 'englishine.learning.v1';

interface LearningProgressState {
  lessons: Record<string, number>;
  notes: Record<string, string>;
  homework: Record<string, 'in-progress' | 'submitted'>;
}

const emptyState: LearningProgressState = {
  lessons: {},
  notes: {},
  homework: {},
};

function readState(): LearningProgressState {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as Partial<LearningProgressState> | null;
    return parsed
      ? {
          lessons: parsed.lessons ?? {},
          notes: parsed.notes ?? {},
          homework: parsed.homework ?? {},
        }
      : emptyState;
  } catch {
    return emptyState;
  }
}

export function useLearningProgress() {
  const [state, setState] = useState<LearningProgressState>(readState);
  const update = useCallback(
    (recipe: (current: LearningProgressState) => LearningProgressState) => {
      setState((current) => {
        const next = recipe(current);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );
  const saveLessonProgress = useCallback(
    (lessonId: string, value: number) => {
      const safe = Math.min(100, Math.max(0, Math.round(value)));
      update((current) => ({
        ...current,
        lessons: { ...current.lessons, [lessonId]: safe },
      }));
    },
    [update],
  );
  const saveNote = useCallback(
    (lessonId: string, value: string) => {
      update((current) => ({
        ...current,
        notes: { ...current.notes, [lessonId]: value },
      }));
    },
    [update],
  );
  const saveHomework = useCallback(
    (lessonId: string, status: 'in-progress' | 'submitted') => {
      update((current) => ({
        ...current,
        homework: { ...current.homework, [lessonId]: status },
      }));
    },
    [update],
  );
  return { state, saveLessonProgress, saveNote, saveHomework };
}
