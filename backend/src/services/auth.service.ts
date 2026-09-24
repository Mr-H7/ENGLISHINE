import type { FastifyInstance } from 'fastify';
import { SystemRole, UserStatus, type PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { looksLikeEmail, looksLikePhone, normalizeEgyptianPhone } from '../utils/phone.js';
import {
  createDeviceHash,
  createOpaqueToken,
  createTokenFamilyId,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../utils/crypto.js';

export interface SignupInput {
  email?: string | undefined;
  studentPhone: string;
  guardianPhone: string;
  password: string;
  fullName: string;
  gradeId: string;
}

export interface LoginInput {
  email?: string | undefined;
  phone?: string | undefined;
  identifier?: string | undefined;
  password: string;
}

export interface DeviceContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  deviceId?: string | undefined;
}

interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  roles: SystemRole[];
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: AuthUser;
}

const userWithRoles = {
  roles: { include: { role: true } },
  studentProfile: true,
  teacherProfile: true,
  adminProfile: true,
} as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function displayName(user: {
  email: string | null;
  phone: string | null;
  studentProfile: { fullName: string } | null;
  teacherProfile: { fullName: string } | null;
  adminProfile: { fullName: string } | null;
}): string {
  return (
    user.studentProfile?.fullName ??
    user.teacherProfile?.fullName ??
    user.adminProfile?.fullName ??
    user.email ??
    user.phone ??
    'Englishine'
  );
}

export class AuthService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly app: FastifyInstance,
  ) {}

  public async signup(input: SignupInput, device: DeviceContext): Promise<AuthResult> {
    const email = input.email ? normalizeEmail(input.email) : null;
    const studentPhone = normalizeEgyptianPhone(input.studentPhone);
    const guardianPhone = normalizeEgyptianPhone(input.guardianPhone);
    if (email) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existingEmail)
        throw new AppError('An account already exists for this email.', {
          statusCode: 409,
          code: 'EMAIL_EXISTS',
        });
    }
    const existingPhone = await this.prisma.user.findUnique({ where: { phone: studentPhone }, select: { id: true } });
    if (existingPhone)
      throw new AppError('An account already exists for this phone number.', {
        statusCode: 409,
        code: 'PHONE_EXISTS',
      });
    const grade = await this.prisma.grade.findFirst({ where: { id: input.gradeId, isActive: true } });
    if (!grade) throw new AppError('Grade not found.', { statusCode: 404, code: 'GRADE_NOT_FOUND' });

    const studentRole = await this.prisma.role.findUnique({ where: { key: SystemRole.STUDENT } });
    if (!studentRole)
      throw new AppError('System roles are not initialized.', {
        statusCode: 503,
        code: 'ROLES_NOT_READY',
      });

    const passwordHash = await hashPassword(input.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        phone: studentPhone,
        passwordHash,
        status: UserStatus.ACTIVE,
        roles: { create: { roleId: studentRole.id } },
        studentProfile: {
          create: {
            fullName: input.fullName.trim(),
            studentPhone,
            parentPhone: guardianPhone,
            gradeId: grade.id,
          },
        },
      },
      include: userWithRoles,
    });

    return this.createSession(user, device);
  }

  public async login(input: LoginInput, device: DeviceContext): Promise<AuthResult> {
    const raw = (input.identifier ?? input.phone ?? input.email ?? '').trim();
    if (!raw) {
      throw new AppError('Invalid email or password.', { statusCode: 401, code: 'INVALID_CREDENTIALS' });
    }
    let user;
    try {
      user = looksLikeEmail(raw)
        ? await this.prisma.user.findUnique({ where: { email: normalizeEmail(raw) }, include: userWithRoles })
        : looksLikePhone(raw)
          ? await this.prisma.user.findUnique({
              where: { phone: normalizeEgyptianPhone(raw) },
              include: userWithRoles,
            })
          : await this.prisma.user.findUnique({ where: { email: normalizeEmail(raw) }, include: userWithRoles });
    } catch {
      throw new AppError('Invalid email or password.', { statusCode: 401, code: 'INVALID_CREDENTIALS' });
    }

    if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
      throw new AppError('Invalid email or password.', {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
      });
    }
    if (user.status !== UserStatus.ACTIVE || user.deletedAt) {
      throw new AppError('This account is not active.', {
        statusCode: 403,
        code: 'ACCOUNT_INACTIVE',
      });
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.createSession(user, device);
  }

  public async refresh(rawToken: string, device: DeviceContext): Promise<AuthResult> {
    const tokenHash = hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: { include: userWithRoles },
        deviceSession: true,
      },
    });

    if (!existing)
      throw new AppError('Refresh token is invalid.', {
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
      });
    if (existing.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AppError('Refresh token reuse was detected.', {
        statusCode: 401,
        code: 'REFRESH_TOKEN_REUSED',
      });
    }
    if (
      existing.expiresAt <= new Date() ||
      existing.user.status !== UserStatus.ACTIVE ||
      existing.user.deletedAt
    ) {
      throw new AppError('Refresh token has expired.', {
        statusCode: 401,
        code: 'REFRESH_TOKEN_EXPIRED',
      });
    }

    const expectedDeviceHash = createDeviceHash(device);
    if (
      !existing.deviceSession ||
      existing.deviceSession.deviceIdHash !== expectedDeviceHash ||
      existing.deviceSession.revokedAt
    ) {
      throw new AppError('Device session is invalid.', {
        statusCode: 401,
        code: 'INVALID_DEVICE_SESSION',
      });
    }

    const deviceSession = existing.deviceSession;
    const next = createOpaqueToken();
    const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86_400_000);
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedByHash: next.hash },
      });
      if (claimed.count !== 1) return false;
      await transaction.refreshToken.create({
        data: {
          userId: existing.userId,
          deviceSessionId: existing.deviceSessionId,
          tokenHash: next.hash,
          familyId: existing.familyId,
          expiresAt: refreshExpiresAt,
        },
      });
      await transaction.deviceSession.update({
        where: { id: deviceSession.id },
        data: { lastSeenAt: new Date(), expiresAt: refreshExpiresAt },
      });
      return true;
    });
    if (!rotated) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AppError('Refresh token reuse was detected.', {
        statusCode: 401,
        code: 'REFRESH_TOKEN_REUSED',
      });
    }

    return {
      accessToken: this.signAccessToken(existing.user, existing.deviceSession.id),
      refreshToken: next.token,
      refreshExpiresAt,
      user: this.toAuthUser(existing.user),
    };
  }

  public async logout(rawToken?: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);
    const token = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!token) return;
    await this.prisma.$transaction(async (transaction) => {
      await transaction.refreshToken.updateMany({
        where: {
          revokedAt: null,
          OR: [
            { familyId: token.familyId },
            ...(token.deviceSessionId ? [{ deviceSessionId: token.deviceSessionId }] : []),
          ],
        },
        data: { revokedAt: new Date() },
      });
      if (token.deviceSessionId) {
        await transaction.deviceSession.update({
          where: { id: token.deviceSessionId },
          data: { revokedAt: new Date() },
        });
      }
    });
  }

  public async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithRoles,
    });
    if (!user || user.deletedAt)
      throw new AppError('User was not found.', { statusCode: 404, code: 'USER_NOT_FOUND' });
    return this.toAuthUser(user);
  }

  private async createSession(
    user: Awaited<ReturnType<PrismaClient['user']['findUniqueOrThrow']>> & {
      roles: Array<{ role: { key: SystemRole } }>;
      studentProfile: { fullName: string } | null;
      teacherProfile: { fullName: string } | null;
      adminProfile: { fullName: string } | null;
    },
    device: DeviceContext,
  ): Promise<AuthResult> {
    const refresh = createOpaqueToken();
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86_400_000);
    const deviceIdHash = createDeviceHash(device);
    const session = await this.prisma.deviceSession.upsert({
      where: { userId_deviceIdHash: { userId: user.id, deviceIdHash } },
      update: {
        deviceName: device.deviceId ?? null,
        userAgent: device.userAgent ?? null,
        ipAddress: device.ipAddress ?? null,
        lastSeenAt: new Date(),
        expiresAt,
        revokedAt: null,
      },
      create: {
        userId: user.id,
        deviceIdHash,
        deviceName: device.deviceId ?? null,
        userAgent: device.userAgent ?? null,
        ipAddress: device.ipAddress ?? null,
        expiresAt,
      },
    });

    await this.prisma.$transaction(async (transaction) => {
      await transaction.refreshToken.updateMany({
        where: { deviceSessionId: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.refreshToken.create({
        data: {
          userId: user.id,
          deviceSessionId: session.id,
          tokenHash: refresh.hash,
          familyId: createTokenFamilyId(),
          expiresAt,
        },
      });
    });

    return {
      accessToken: this.signAccessToken(user, session.id),
      refreshToken: refresh.token,
      refreshExpiresAt: expiresAt,
      user: this.toAuthUser(user),
    };
  }

  private signAccessToken(
    user: { id: string; email: string | null; roles: Array<{ role: { key: SystemRole } }> },
    sessionId: string,
  ): string {
    return this.app.jwt.sign({
      sub: user.id,
      email: user.email ?? '',
      roles: user.roles.map(({ role }) => role.key),
      sessionId,
    });
  }

  private toAuthUser(user: {
    id: string;
    email: string | null;
    phone: string | null;
    roles: Array<{ role: { key: SystemRole } }>;
    studentProfile: { fullName: string } | null;
    teacherProfile: { fullName: string } | null;
    adminProfile: { fullName: string } | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      displayName: displayName(user),
      roles: user.roles.map(({ role }) => role.key),
    };
  }
}
