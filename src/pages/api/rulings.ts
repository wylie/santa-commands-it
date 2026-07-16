import type { APIRoute } from 'astro';

import {
  buildSubmitDependencies,
  GENERIC_ERROR_MESSAGE,
  submitSantaRequest,
} from '@/server/rulings/service';

function json(body: Record<string, unknown>, init: ResponseInit): Response {
  return Response.json(body, init);
}

export const POST: APIRoute = async ({ request }) => {
  // This public endpoint needs rate limiting before launch hardening in v0.1.5.
  const contentType = request.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    return json(
      {
        status: 'invalid',
        fieldErrors: {
          name: 'Please tell Santa what to call you.',
          request: 'Please tell Santa what you would like.',
        },
      },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        status: 'invalid',
        fieldErrors: {
          name: 'Please tell Santa what to call you.',
          request: 'Please tell Santa what you would like.',
        },
      },
      { status: 400 },
    );
  }

  try {
    const response = await submitSantaRequest(
      body,
      buildSubmitDependencies(request.headers),
    );

    if (response.status === 'created') {
      return json(response, { status: 201 });
    }

    if (response.status === 'blocked') {
      return json(response, { status: 200 });
    }

    if (response.status === 'invalid') {
      return json(response, { status: 422 });
    }

    return json(response, { status: 500 });
  } catch {
    return json(
      {
        status: 'error',
        message: GENERIC_ERROR_MESSAGE,
      },
      { status: 503 },
    );
  }
};

export const ALL: APIRoute = async () => {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: 'POST',
    },
  });
};
