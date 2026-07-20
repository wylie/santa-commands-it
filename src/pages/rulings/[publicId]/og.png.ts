import type { APIRoute } from 'astro';

import { methodNotAllowed } from '@/server/api/responses';
import { getPublicSeasonalPresentation } from '@/server/config/service';
import {
  buildShareImageErrorResponse,
  renderRulingShareImage,
  RULING_SHARE_IMAGE_PUBLIC_CACHE_CONTROL,
} from '@/server/rulings/share-image';
import { getPublicRulingForHeaders } from '@/server/rulings/service';

export const GET: APIRoute = async ({ params, request }) => {
  const publicId = params.publicId ?? '';
  const result = await getPublicRulingForHeaders(publicId, request.headers);

  if (result.status === 'not-found') {
    return buildShareImageErrorResponse(404, 'Share image unavailable.');
  }

  if (result.status === 'unavailable') {
    return buildShareImageErrorResponse(503, 'Share image unavailable.');
  }

  try {
    const seasonalPresentation = await getPublicSeasonalPresentation(
      request.headers,
    );

    return await renderRulingShareImage(result.ruling, {
      visibility: 'public',
      seasonalMode: seasonalPresentation.mode,
      cacheControl: RULING_SHARE_IMAGE_PUBLIC_CACHE_CONTROL,
    });
  } catch (error) {
    console.error(
      '[santa-commands-it] Failed to render public ruling share image.',
      error,
    );

    return buildShareImageErrorResponse(503, 'Share image unavailable.');
  }
};

export const ALL: APIRoute = async () => methodNotAllowed('GET');
