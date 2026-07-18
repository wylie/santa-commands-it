import { securitySettings } from '@/config/security';

const SUPPORTED_FORM_CONTENT_TYPES = [
  'application/x-www-form-urlencoded',
  'multipart/form-data',
] as const;

function hasSupportedWorkshopFormContentType(request: Request) {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  return SUPPORTED_FORM_CONTENT_TYPES.some((value) =>
    contentType.startsWith(value),
  );
}

export async function parseWorkshopFormRequest(request: Request) {
  const contentLengthHeader = request.headers.get('content-length');
  const contentLength = contentLengthHeader
    ? Number.parseInt(contentLengthHeader, 10)
    : null;

  if (
    Number.isInteger(contentLength) &&
    contentLength !== null &&
    contentLength > securitySettings.workshop.formBodyLimitBytes
  ) {
    return {
      ok: false as const,
      response: new Response(
        'Workshop access is not available for that request.',
        {
          status: 413,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      ),
    };
  }

  if (!hasSupportedWorkshopFormContentType(request)) {
    return {
      ok: false as const,
      response: new Response(
        'Workshop access is not available for that request.',
        {
          status: 415,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      ),
    };
  }

  try {
    return {
      ok: true as const,
      formData: await request.formData(),
    };
  } catch {
    return {
      ok: false as const,
      response: new Response(
        'Workshop access is not available for that request.',
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      ),
    };
  }
}
