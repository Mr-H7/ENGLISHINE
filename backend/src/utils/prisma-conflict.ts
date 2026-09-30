import { Prisma } from '../generated/prisma/client.js';

export function isRetryableWriteConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2002' || error.code === 'P2034';
  }
  if (!error || typeof error !== 'object') return false;
  const record = error as {
    name?: string;
    message?: string;
    code?: string;
    cause?: { kind?: string; originalCode?: string };
  };
  if (record.code === 'P2002' || record.code === 'P2034') return true;
  return (
    record.message === 'TransactionWriteConflict' ||
    record.cause?.kind === 'TransactionWriteConflict' ||
    record.cause?.originalCode === '40001'
  );
}
