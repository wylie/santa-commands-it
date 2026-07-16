import type { APIRoute } from 'astro';

import { securitySettings } from '@/config/security';
import { parseJsonRequest } from '@/server/api/request-body';
import { json, methodNotAllowed } from '@/server/api/responses';
import { buildReportDependencies } from '@/server/reports/runtime';
import {
  REPORT_GENERIC_ERROR_MESSAGE,
  submitRulingReport,
} from '@/server/reports/service';
import { hashClientIdentifier } from '@/server/security/client-key';
import { isAllowedOrigin } from '@/server/security/origin';

export const POST: APIRoute = async ({ params, request }) => {
  if (!isAllowedOrigin(request.headers.get('origin'), request.url)) {
    return json(
      {
        status: 'forbidden',
        message: 'Santa could not accept that report.',
      },
      { status: 403 },
    );
  }

  const parsedRequest = await parseJsonRequest(
    request,
    securitySettings.reports.bodyLimitBytes,
  );

  if (!parsedRequest.ok) {
    if (parsedRequest.status === 'unsupported-media') {
      return json(
        {
          status: 'unsupported-media',
          message: 'Santa could not accept that report.',
        },
        { status: 415 },
      );
    }

    if (parsedRequest.status === 'payload-too-large') {
      return json(
        {
          status: 'payload-too-large',
          message: 'Santa could not accept that report.',
        },
        { status: 413 },
      );
    }

    return json(
      {
        status: 'invalid',
        fieldErrors: {
          reason: 'Please choose a reason for the report.',
          note: undefined,
        },
      },
      { status: 400 },
    );
  }

  try {
    const response = await submitRulingReport(
      parsedRequest.data,
      {
        publicId: params.publicId ?? '',
        clientKeyHash: hashClientIdentifier(request.headers),
      },
      buildReportDependencies(request.headers),
    );

    if (response.status === 'reported') {
      return json(response, { status: 201 });
    }

    if (response.status === 'duplicate') {
      return json(response, { status: 200 });
    }

    if (response.status === 'invalid') {
      return json(response, { status: 422 });
    }

    if (response.status === 'not-found') {
      return json(response, { status: 404 });
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

    if (
      response.status === 'forbidden' ||
      response.status === 'payload-too-large' ||
      response.status === 'unsupported-media'
    ) {
      return json(response, {
        status:
          response.status === 'forbidden'
            ? 403
            : response.status === 'payload-too-large'
              ? 413
              : 415,
      });
    }

    return json(response, { status: 500 });
  } catch {
    return json(
      {
        status: 'error',
        message: REPORT_GENERIC_ERROR_MESSAGE,
      },
      { status: 503 },
    );
  }
};

export const ALL: APIRoute = async () => {
  return methodNotAllowed('POST');
};
