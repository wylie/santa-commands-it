import type { APIRoute } from 'astro';

import { getSiteUrl } from '@/server/env';
import { buildCanonicalUrl } from '@/utils/rulingPages';

const STATIC_PUBLIC_PATHS = ['/', '/commands'] as const;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = ({ request }) => {
  const urls = STATIC_PUBLIC_PATHS.map((publicPath) =>
    buildCanonicalUrl(publicPath, {
      siteUrl: getSiteUrl(),
      requestUrl: request.url,
    }),
  ).filter((url): url is string => Boolean(url));

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
