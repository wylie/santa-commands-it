import type { APIRoute } from 'astro';

import { json, methodNotAllowed } from '@/server/api/responses';
import { classifySubmissionRouteError } from '@/server/api/submission-errors';
import { parseJsonRequest } from '@/server/api/request-body';
import { hashClientIdentifier } from '@/server/security/client-key';
import { isAllowedOrigin } from '@/server/security/origin';
import { buildSubmitDependencies } from '@/server/submissions/runtime';
import {
  GENERIC_ERROR_MESSAGE,
  submitSantaRequest,
} from '@/server/submissions/service';
import { securitySettings } from '@/config/security';

function invalidSubmissionResponse(statusCode = 400): Response {
  return json(
    {
      status: 'invalid',
      fieldErrors: {
        name: 'Please tell Santa what to call you.',
        request: 'Please tell Santa what you would like.',
      },
    },
    { status: statusCode },
  );
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAllowedOrigin(request.headers.get('origin'), request.url)) {
    return json(
      {
        status: 'forbidden',
        message: 'Santa could not accept that request.',
      },
      { status: 403 },
    );
  }

  const parsedRequest = await parseJsonRequest(
    request,
    securitySettings.submissions.bodyLimitBytes,
  );

  if (!parsedRequest.ok) {
    if (parsedRequest.status === 'unsupported-media') {
      return json(
        {
          status: 'unsupported-media',
          message: 'Santa could not accept that request.',
        },
        { status: 415 },
      );
    }

    if (parsedRequest.status === 'payload-too-large') {
      return json(
        {
          status: 'payload-too-large',
          message: 'Santa could not accept that request.',
        },
        { status: 413 },
      );
    }

    return invalidSubmissionResponse();
  }

  try {
    const response = await submitSantaRequest(
      parsedRequest.data,
      {
        clientKeyHash: hashClientIdentifier(request.headers),
        idempotencyKey: request.headers.get('x-idempotency-key') ?? '',
      },
      buildSubmitDependencies(request.headers),
    );

    if (response.status === 'created') {
      return json(response, { status: 201 });
    }

    if (response.status === 'duplicate') {
      return json(response, { status: 200 });
    }

    if (response.status === 'blocked') {
      return json(response, { status: 200 });
    }

    if (response.status === 'invalid') {
      return json(response, { status: 422 });
    }

    if (response.status === 'bot-rejected') {
      return json(response, { status: 202 });
    }

    if (response.status === 'rate-limited') {
      const headers = new Headers();

      if (typeof response.retryAfterSeconds === 'number') {
        headers.set('Retry-After', String(response.retryAfterSeconds));
      }

      return json(response, {
        status: 429,
        headers,
      });
    }

    return json(response, { status: 500 });
  } catch (error) {
    const classification = classifySubmissionRouteError(error);
    console.error('[santa-commands-it]', classification.log);

    return json(
      {
        status: 'error',
        message: GENERIC_ERROR_MESSAGE,
      },
      { status: classification.statusCode },
    );
  }
};

export const ALL: APIRoute = async () => {
  return methodNotAllowed('POST');
};
