ALTER TABLE "CourseUnit"
  ADD COLUMN "coverAssetId" UUID,
  ADD COLUMN "accessLevel" "AccessLevel" NOT NULL DEFAULT 'ENROLLED';

ALTER TABLE "Homework"
  ADD COLUMN "coverAssetId" UUID;

CREATE UNIQUE INDEX "CourseUnit_coverAssetId_key" ON "CourseUnit"("coverAssetId");
CREATE UNIQUE INDEX "Homework_coverAssetId_key" ON "Homework"("coverAssetId");

ALTER TABLE "CourseUnit" ADD CONSTRAINT "CourseUnit_coverAssetId_fkey"
  FOREIGN KEY ("coverAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_coverAssetId_fkey"
  FOREIGN KEY ("coverAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
