-- Stage 2 additive identity, progress, exam unit scope, and homework import jobs.

ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "phone" VARCHAR(32);
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE INDEX "User_phone_idx" ON "User"("phone");

ALTER TABLE "StudentProfile"
  ADD COLUMN "avatarAssetId" UUID,
  ADD COLUMN "studentPhone" VARCHAR(32);
CREATE UNIQUE INDEX "StudentProfile_avatarAssetId_key" ON "StudentProfile"("avatarAssetId");
CREATE UNIQUE INDEX "StudentProfile_studentPhone_key" ON "StudentProfile"("studentPhone");
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_avatarAssetId_fkey"
  FOREIGN KEY ("avatarAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Exam" ADD COLUMN "unitId" UUID;
CREATE INDEX "Exam_unitId_idx" ON "Exam"("unitId");
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "CourseUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudentLessonProgress" (
  "id" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "lessonId" UUID NOT NULL,
  "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "startedAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "lastAccessedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "StudentLessonProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentLessonProgress_studentId_lessonId_key" ON "StudentLessonProgress"("studentId", "lessonId");
CREATE INDEX "StudentLessonProgress_lessonId_status_idx" ON "StudentLessonProgress"("lessonId", "status");
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudentVideoProgress" (
  "id" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "videoId" UUID NOT NULL,
  "watchedSeconds" INTEGER NOT NULL DEFAULT 0,
  "durationSeconds" INTEGER,
  "progressPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMPTZ(3),
  "lastWatchedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "StudentVideoProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentVideoProgress_studentId_videoId_key" ON "StudentVideoProgress"("studentId", "videoId");
CREATE INDEX "StudentVideoProgress_videoId_completedAt_idx" ON "StudentVideoProgress"("videoId", "completedAt");
ALTER TABLE "StudentVideoProgress" ADD CONSTRAINT "StudentVideoProgress_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentVideoProgress" ADD CONSTRAINT "StudentVideoProgress_videoId_fkey"
  FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "ProgressionRequirementType" AS ENUM (
  'PREVIOUS_UNIT_COMPLETE',
  'VIDEO_COMPLETE',
  'HOMEWORK_SUBMITTED',
  'HOMEWORK_PASSED',
  'EXAM_SUBMITTED',
  'EXAM_PASSED',
  'LESSON_COMPLETE'
);

CREATE TABLE "ProgressionRequirement" (
  "id" UUID NOT NULL,
  "unitId" UUID,
  "lessonId" UUID,
  "type" "ProgressionRequirementType" NOT NULL,
  "targetId" UUID,
  "passingPercent" DECIMAL(5,2),
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ProgressionRequirement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProgressionRequirement_unitId_position_idx" ON "ProgressionRequirement"("unitId", "position");
CREATE INDEX "ProgressionRequirement_lessonId_position_idx" ON "ProgressionRequirement"("lessonId", "position");
ALTER TABLE "ProgressionRequirement" ADD CONSTRAINT "ProgressionRequirement_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressionRequirement" ADD CONSTRAINT "ProgressionRequirement_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "CourseUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "ImportJobStatus" AS ENUM ('UPLOADED', 'EXTRACTING', 'DRAFT_READY', 'FAILED', 'CANCELLED');

CREATE TABLE "HomeworkImportJob" (
  "id" UUID NOT NULL,
  "homeworkId" UUID,
  "createdById" UUID NOT NULL,
  "sourceAssetId" UUID NOT NULL,
  "status" "ImportJobStatus" NOT NULL DEFAULT 'UPLOADED',
  "extractedDraft" JSONB,
  "errorMessage" TEXT,
  "reviewedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "HomeworkImportJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HomeworkImportJob_homeworkId_status_idx" ON "HomeworkImportJob"("homeworkId", "status");
CREATE INDEX "HomeworkImportJob_createdById_createdAt_idx" ON "HomeworkImportJob"("createdById", "createdAt");
ALTER TABLE "HomeworkImportJob" ADD CONSTRAINT "HomeworkImportJob_homeworkId_fkey"
  FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HomeworkImportJob" ADD CONSTRAINT "HomeworkImportJob_sourceAssetId_fkey"
  FOREIGN KEY ("sourceAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
