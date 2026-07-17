import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

import { getSessionSecret } from '@/server/env';

const PASSWORD_HASH_PREFIX = 'scrypt';
const PASSWORD_KEY_LENGTH = 64;

type ParsedPasswordHash = {
  cost: number;
  blockSize: number;
  parallelization: number;
  salt: Buffer;
  derivedKey: Buffer;
};

function parsePasswordHash(value: string): ParsedPasswordHash | null {
  const parts = value.split('$');

  if (parts.length !== 6 || parts[0] !== PASSWORD_HASH_PREFIX) {
    return null;
  }

  const cost = Number.parseInt(parts[1] ?? '', 10);
  const blockSize = Number.parseInt(parts[2] ?? '', 10);
  const parallelization = Number.parseInt(parts[3] ?? '', 10);
  const salt = parts[4] ? Buffer.from(parts[4], 'base64url') : null;
  const derivedKey = parts[5] ? Buffer.from(parts[5], 'base64url') : null;

  if (
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelization) ||
    !salt ||
    !derivedKey ||
    !salt.length ||
    !derivedKey.length
  ) {
    return null;
  }

  return {
    cost,
    blockSize,
    parallelization,
    salt,
    derivedKey,
  };
}

export async function createWorkshopPasswordHash(
  password: string,
): Promise<string> {
  const salt = randomBytes(16);
  const cost = 16384;
  const blockSize = 8;
  const parallelization = 1;
  const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH, {
    N: cost,
    r: blockSize,
    p: parallelization,
  });

  return [
    PASSWORD_HASH_PREFIX,
    String(cost),
    String(blockSize),
    String(parallelization),
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyWorkshopPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parsed = parsePasswordHash(storedHash);

  if (!parsed) {
    return false;
  }

  const computed = scryptSync(password, parsed.salt, parsed.derivedKey.length, {
    N: parsed.cost,
    r: parsed.blockSize,
    p: parsed.parallelization,
  });

  if (computed.length !== parsed.derivedKey.length) {
    return false;
  }

  return timingSafeEqual(computed, parsed.derivedKey);
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashWorkshopToken(token: string): string {
  return createHmac('sha256', getSessionSecret()).update(token).digest('hex');
}
