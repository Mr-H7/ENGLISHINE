import type { FastifyInstance } from 'fastify';

export function testPhone(): string {
  const n = Number.parseInt(crypto.randomUUID().replace(/-/g, '').slice(0, 8), 16)
    .toString()
    .padStart(8, '1')
    .slice(0, 8);
  return `010${n}`;
}

export async function registerStudent(
  app: FastifyInstance,
  input: { fullName: string; email?: string; password: string; headers?: Record<string, string> },
) {
  const grade = await app.prisma.grade.findUniqueOrThrow({ where: { code: 'PREP_1' } });
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    headers: { 'content-type': 'application/json', 'x-device-id': crypto.randomUUID(), ...input.headers },
    payload: {
      fullName: input.fullName,
      email: input.email,
      password: input.password,
      studentPhone: testPhone(),
      guardianPhone: testPhone(),
      gradeId: grade.id,
    },
  });
}
