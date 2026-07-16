import { defineMiddleware } from 'astro/middleware';

import { applySecurityHeaders } from '@/server/security/headers';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  return applySecurityHeaders(response, {
    requestUrl: context.url.toString(),
    isApiRoute: context.url.pathname.startsWith('/api/'),
  });
});
