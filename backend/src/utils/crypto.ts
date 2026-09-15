import { createHash, randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';

const passwordOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, passwordOptions);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function createOpaqueToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createTokenFamilyId(): string {
  return randomUUID();
}

export function createDeviceHash(input: {
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
  deviceId?: string | undefined;
}): string {
  const fingerprint = input.deviceId
    ? `${input.deviceId}|${input.userAgent ?? ''}`
    : `${input.userAgent ?? ''}|${input.ipAddress ?? ''}`;
  return createHash('sha256').update(fingerprint).digest('hex');
}
