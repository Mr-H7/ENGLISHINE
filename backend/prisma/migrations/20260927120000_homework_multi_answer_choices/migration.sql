-- Additive: legacy selectedChoiceId answers remain unchanged.
CREATE TABLE "HomeworkAnswerChoice" (
    "answerId" UUID NOT NULL,
    "choiceId" UUID NOT NULL,
    CONSTRAINT "HomeworkAnswerChoice_pkey" PRIMARY KEY ("answerId", "choiceId")
);
CREATE INDEX "HomeworkAnswerChoice_choiceId_idx" ON "HomeworkAnswerChoice"("choiceId");
ALTER TABLE "HomeworkAnswerChoice" ADD CONSTRAINT "HomeworkAnswerChoice_answerId_fkey"
    FOREIGN KEY ("answerId") REFERENCES "HomeworkAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeworkAnswerChoice" ADD CONSTRAINT "HomeworkAnswerChoice_choiceId_fkey"
    FOREIGN KEY ("choiceId") REFERENCES "HomeworkChoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
