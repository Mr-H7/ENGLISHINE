import { AppError } from './app-error.js';

export function normalizeEgyptianPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  let national = digits;
  if (national.startsWith('0020')) national = national.slice(4);
  else if (national.startsWith('20') && national.length >= 12) national = national.slice(2);
  if (national.startsWith('0')) national = national.slice(1);
  if (!/^1[0125]\d{8}$/.test(national)) {
    throw new AppError('Enter a valid Egyptian mobile number.', {
      statusCode: 400,
      code: 'INVALID_PHONE',
    });
  }
  return `+20${national}`;
}

export function looksLikeEmail(value: string): boolean {
  return value.includes('@');
}

export function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 14 && !value.includes('@');
}
