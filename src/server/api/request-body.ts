function isJsonContentType(contentType: string | null): boolean {
  return Boolean(contentType?.includes('application/json'));
}

export type ParsedJsonRequest =
  | {
      ok: true;
      data: unknown;
    }
  | {
      ok: false;
      status: 'unsupported-media' | 'payload-too-large' | 'invalid';
    };

export async function parseJsonRequest(
  request: Request,
  bodyLimitBytes: number,
): Promise<ParsedJsonRequest> {
  if (!isJsonContentType(request.headers.get('content-type'))) {
    return {
      ok: false,
      status: 'unsupported-media',
    };
  }

  const contentLengthHeader = request.headers.get('content-length');
  const contentLength = contentLengthHeader
    ? Number.parseInt(contentLengthHeader, 10)
    : Number.NaN;

  if (Number.isFinite(contentLength) && contentLength > bodyLimitBytes) {
    return {
      ok: false,
      status: 'payload-too-large',
    };
  }

  let text: string;

  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      status: 'invalid',
    };
  }

  const measuredLength = new TextEncoder().encode(text).byteLength;

  if (measuredLength > bodyLimitBytes) {
    return {
      ok: false,
      status: 'payload-too-large',
    };
  }

  try {
    return {
      ok: true,
      data: JSON.parse(text),
    };
  } catch {
    return {
      ok: false,
      status: 'invalid',
    };
  }
}
