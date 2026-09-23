import type { PrismaClient } from '../generated/prisma/client.js';
import type { StorageService } from './storage.service.js';

export async function retireAssetIfUnreferenced(
  prisma: PrismaClient, storage: StorageService, assetId: string,
): Promise<void> {
  const asset = await prisma.fileAsset.findUnique({
    where: { id: assetId },
    include: {
      courseCover: { select: { id: true } },
      unitCover: { select: { id: true } },
      homeworkCover: { select: { id: true } },
      videoFile: { select: { id: true } },
      videoThumbnails: { select: { id: true } },
      lessonResources: { select: { id: true } },
      assignmentSubmissions: { select: { id: true } },
      certificates: { select: { id: true } },
    },
  });
  if (!asset || asset.deletedAt || asset.courseCover || asset.unitCover || asset.homeworkCover ||
      asset.videoFile || asset.videoThumbnails.length || asset.lessonResources.length ||
      asset.assignmentSubmissions.length || asset.certificates.length) return;
  // Keep an active FileAsset record if storage deletion fails, so a cleanup job can retry.
  await storage.remove(asset.storageKey, asset.storageProvider);
  await prisma.fileAsset.update({ where: { id: assetId }, data: { deletedAt: new Date() } });
}
