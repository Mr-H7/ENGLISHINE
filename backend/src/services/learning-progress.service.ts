import { ContentStatus, ProgressStatus, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { hasScopedEntitlement } from './content-access.service.js';
import { ProgressionService, VIDEO_COMPLETION_THRESHOLD } from './progression.service.js';

export class LearningProgressService {
  constructor(private readonly prisma: PrismaClient) {}

  async recordVideoProgress(
    userId: string,
    videoId: string,
    watchedSeconds: number,
    durationSeconds?: number,
  ) {
    const video = await this.prisma.video.findFirst({
      where: { id: videoId, deletedAt: null },
      include: { lesson: { include: { unit: { include: { course: true } } } } },
    });
    if (!video) throw new AppError(404, 'Video not found', 'VIDEO_NOT_FOUND');
    const student = await this.student(userId);
    const duration = durationSeconds ?? video.durationSeconds ?? null;
    const percent =
      duration && duration > 0 ? Math.min(100, Math.round((watchedSeconds / duration) * 10_000) / 100) : 0;
    const completed = percent >= VIDEO_COMPLETION_THRESHOLD;
    const row = await this.prisma.studentVideoProgress.upsert({
      where: { studentId_videoId: { studentId: student.id, videoId } },
      create: {
        studentId: student.id,
        videoId,
        watchedSeconds,
        durationSeconds: duration,
        progressPercent: percent,
        lastWatchedAt: new Date(),
        completedAt: completed ? new Date() : null,
      },
      update: {
        watchedSeconds,
        durationSeconds: duration,
        progressPercent: percent,
        lastWatchedAt: new Date(),
        completedAt: completed ? new Date() : null,
      },
    });
    const enrollment = await this.prisma.courseEnrollment.findFirst({
      where: { studentId: student.id, courseId: video.lesson.unit.courseId, status: 'ACTIVE' },
    });
    if (enrollment) {
      await this.prisma.videoWatchProgress.upsert({
        where: { enrollmentId_videoId: { enrollmentId: enrollment.id, videoId } },
        create: {
          enrollmentId: enrollment.id,
          videoId,
          watchedSeconds,
          durationSeconds: duration,
          progressPercent: percent,
          lastWatchedAt: new Date(),
          completedAt: completed ? new Date() : null,
        },
        update: {
          watchedSeconds,
          durationSeconds: duration,
          progressPercent: percent,
          lastWatchedAt: new Date(),
          completedAt: completed ? new Date() : null,
        },
      });
    }
    if (completed) await this.syncLessonCompletion(student.id, video.lessonId);
    return row;
  }

  async recordLessonAccess(userId: string, lessonId: string, status?: ProgressStatus) {
    const student = await this.student(userId);
    const now = new Date();
    const next = status ?? ProgressStatus.IN_PROGRESS;
    return this.prisma.studentLessonProgress.upsert({
      where: { studentId_lessonId: { studentId: student.id, lessonId } },
      create: {
        studentId: student.id,
        lessonId,
        status: next,
        startedAt: now,
        lastAccessedAt: now,
        completedAt: next === ProgressStatus.COMPLETED ? now : null,
      },
      update: {
        status: next === ProgressStatus.COMPLETED ? ProgressStatus.COMPLETED : ProgressStatus.IN_PROGRESS,
        lastAccessedAt: now,
        ...(next === ProgressStatus.COMPLETED ? { completedAt: now } : {}),
      },
    });
  }

  private async syncLessonCompletion(studentId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
      include: { videos: { where: { deletedAt: null, status: ContentStatus.PUBLISHED } } },
    });
    if (!lesson || !lesson.videos.length) return;
    const completed = await this.prisma.studentVideoProgress.count({
      where: {
        studentId,
        videoId: { in: lesson.videos.map((video) => video.id) },
        OR: [{ completedAt: { not: null } }, { progressPercent: { gte: VIDEO_COMPLETION_THRESHOLD } }],
      },
    });
    if (completed < lesson.videos.length) return;
    await this.prisma.studentLessonProgress.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: {
        studentId,
        lessonId,
        status: ProgressStatus.COMPLETED,
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        completedAt: new Date(),
      },
      update: {
        status: ProgressStatus.COMPLETED,
        lastAccessedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  private async student(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) throw new AppError(403, 'Student profile is required', 'STUDENT_PROFILE_REQUIRED');
    return student;
  }
}

export { hasScopedEntitlement, ProgressionService };
