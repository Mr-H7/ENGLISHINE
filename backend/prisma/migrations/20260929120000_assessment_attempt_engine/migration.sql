-- Additive only: retain legacy answers/results and their existing pass configuration.
ALTER TABLE "Homework" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "passingPercentage" DECIMAL(5,2);
ALTER TABLE "HomeworkSubmission" ADD COLUMN "maxScore" DECIMAL(10,2),
  ADD COLUMN "percentage" DECIMAL(5,2), ADD COLUMN "passed" BOOLEAN;
ALTER TABLE "Exam" ALTER COLUMN "maxAttempts" SET DEFAULT 3;
ALTER TABLE "HomeworkImportJob" ADD COLUMN "examId" UUID;
ALTER TABLE "HomeworkImportJob" ADD CONSTRAINT "HomeworkImportJob_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "AssessmentAttemptGrant" (
  "id" UUID NOT NULL, "homeworkId" UUID, "examId" UUID,
  "studentId" UUID NOT NULL, "grantedById" UUID NOT NULL,
  "amount" INTEGER NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentAttemptGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentAttemptGrant_target_check" CHECK (("homeworkId" IS NULL) <> ("examId" IS NULL)),
  CONSTRAINT "AssessmentAttemptGrant_amount_check" CHECK ("amount" IN (1, 2)),
  CONSTRAINT "AssessmentAttemptGrant_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AssessmentAttemptGrant_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AssessmentAttemptGrant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AssessmentAttemptGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AssessmentAttemptGrant_homeworkId_studentId_idx" ON "AssessmentAttemptGrant"("homeworkId", "studentId");
CREATE INDEX "AssessmentAttemptGrant_examId_studentId_idx" ON "AssessmentAttemptGrant"("examId", "studentId");
