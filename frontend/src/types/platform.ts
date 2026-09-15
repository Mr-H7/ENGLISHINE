// Ported from models/platform-models.js; server enforcement remains required.
export interface ActivationCode {
  code: string;
  unlockType: 'course' | 'unit' | 'lesson' | 'bundle';
  targetId: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  assignedStudentId?: string | null;
}
export interface CourseProduct {
  id: string;
  stageId: string;
  gradeId: string;
  termId: string;
  bundleType: 'unit' | 'monthly' | 'term' | 'annual';
  priceMinorUnits: number | null;
  discountMinorUnits: number | null;
  accessStatus: 'locked' | 'preview' | 'unlocked';
}
export interface HomeworkSubmission {
  id: string;
  studentId: string;
  lessonId: string;
  status: 'not-opened' | 'in-progress' | 'submitted';
  textAnswer: string | null;
  uploadObjectKey: string | null;
}
export interface NavigationItem {
  href: string;
  label: string;
}
