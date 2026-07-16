import { createHmac } from 'node:crypto';

import { getRateLimitSecret } from '@/server/env';

function firstForwardedValue(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }

  const [firstValue] = headerValue.split(',');
  const trimmed = firstValue?.trim();

  return trimmed ? trimmed : null;
}

function getRawClientIdentifier(headers: Headers): string {
  const testClientId = headers.get('x-santa-test-client-id');

  if (testClientId) {
    return `test:${testClientId}`;
  }

  const forwardedIp =
    firstForwardedValue(headers.get('x-forwarded-for')) ??
    headers.get('x-real-ip') ??
    headers.get('cf-connecting-ip') ??
    headers.get('x-vercel-forwarded-for');

  if (forwardedIp) {
    return `ip:${forwardedIp}`;
  }

  return 'local-development-client';
}

export function hashClientIdentifier(headers: Headers): string {
  return createHmac('sha256', getRateLimitSecret())
    .update(getRawClientIdentifier(headers))
    .digest('hex');
}
