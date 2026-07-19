import type { APIRoute } from 'astro';

import { methodNotAllowed } from '@/server/api/responses';
import {
  buildShareImageErrorResponse,
  renderRulingShareImage,
  RULING_SHARE_IMAGE_PRIVATE_CACHE_CONTROL,
} from '@/server/rulings/share-image';
import { requireWorkshopPageSession } from '@/server/workshop/auth';
import { getWorkshopRulingDetailData } from '@/server/workshop/service';
import type { PublicRuling } from '@/utils/rulings';

export const GET: APIRoute = async (context) => {
  const session = await requireWorkshopPageSession(context);

  if (session instanceof Response) {
    return session;
  }

  const publicId = context.params.publicId ?? '';
  const detail = await getWorkshopRulingDetailData(
    publicId,
    context.request.headers,
  );

  if (!detail) {
    return buildShareImageErrorResponse(404, 'Share image unavailable.');
  }

  const ruling: PublicRuling = {
    publicId: detail.ruling.publicId,
    displayName: detail.ruling.displayName,
    requestText: detail.ruling.requestText,
    decision: detail.ruling.decision,
    santaResponse: detail.ruling.santaResponse,
    isFeatured: detail.ruling.isFeatured,
    createdAt: detail.ruling.createdAt,
  };

  try {
    return await renderRulingShareImage(ruling, {
      visibility: detail.ruling.visibility,
      cacheControl: RULING_SHARE_IMAGE_PRIVATE_CACHE_CONTROL,
    });
  } catch (error) {
    console.error(
      '[santa-commands-it] Failed to render workshop ruling preview image.',
      error,
    );

    return buildShareImageErrorResponse(503, 'Share image unavailable.');
  }
};

export const ALL: APIRoute = async () => methodNotAllowed('GET');
