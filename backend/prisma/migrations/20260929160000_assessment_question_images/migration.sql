-- Optional private images; existing text-only questions remain unchanged.
ALTER TABLE "HomeworkQuestion" ADD COLUMN "imageAssetId" UUID;
ALTER TABLE "ExamQuestion" ADD COLUMN "imageAssetId" UUID;
CREATE INDEX "HomeworkQuestion_imageAssetId_idx" ON "HomeworkQuestion"("imageAssetId");
CREATE INDEX "ExamQuestion_imageAssetId_idx" ON "ExamQuestion"("imageAssetId");
ALTER TABLE "HomeworkQuestion" ADD CONSTRAINT "HomeworkQuestion_imageAssetId_fkey"
  FOREIGN KEY ("imageAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_imageAssetId_fkey"
  FOREIGN KEY ("imageAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
