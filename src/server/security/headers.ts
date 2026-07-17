import { getSiteUrl } from '@/server/env';

function shouldUseStrictTransportSecurity(requestUrl: string): boolean {
  const configuredSiteUrl = getSiteUrl();
  const origin = configuredSiteUrl ?? requestUrl;

  return origin.startsWith('https://');
}

export function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function applySecurityHeaders(
  response: Response,
  options: {
    requestUrl: string;
    isApiRoute: boolean;
  },
): Response {
  const pathname = new URL(options.requestUrl).pathname;
  const isWorkshopRoute =
    pathname.startsWith('/workshop') || pathname.startsWith('/api/workshop');

  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy());
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), geolocation=(), microphone=(), payment=(), usb=(), web-share=(self), browsing-topics=()',
  );
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  if (shouldUseStrictTransportSecurity(options.requestUrl)) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }

  if (options.isApiRoute || response.status >= 400 || isWorkshopRoute) {
    response.headers.set('Cache-Control', 'no-store');
  }

  if (isWorkshopRoute) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}
