import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestRulingReportsRepository } from '@/server/reports/repository';
import {
  REPORT_DUPLICATE_MESSAGE,
  submitRulingReport,
} from '@/server/reports/service';
import { createTestRulingsRepository } from '@/server/rulings/test-repository';
import { createTestSubmissionRepository } from '@/server/submissions/repository';
import {
  DUPLICATE_SUBMISSION_MESSAGE,
  RATE_LIMITED_MESSAGE,
  submitSantaRequest,
} from '@/server/submissions/service';
import { clearTestRunStore } from '@/server/testing/store';
import { parseJsonRequest } from '@/server/api/request-body';
import { hashClientIdentifier } from '@/server/security/client-key';
import { isAllowedOrigin } from '@/server/security/origin';

afterEach(() => {
  clearTestRunStore();
});

function createSubmissionDependencies(runId: string) {
  return {
    submissionRepository: createTestSubmissionRepository(runId),
    randomProvider: vi
      .fn<() => number>()
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0),
    publicIdGenerator: vi.fn(() => '550e8400-e29b-41d4-a716-446655440000'),
    nowProvider: vi.fn(() => new Date('2026-07-16T12:00:00.000Z')),
    scenario: 'normal' as const,
  };
}

describe('client identity hashing', () => {
  it('hashes the trusted client identifier without returning the raw value', () => {
    const headers = new Headers({
      'x-santa-test-client-id': 'client-alpha',
    });

    const clientHash = hashClientIdentifier(headers);

    expect(clientHash).not.toBe('client-alpha');
    expect(clientHash).toHaveLength(64);
  });

  it('produces different hashes for different client identifiers', () => {
    const firstHash = hashClientIdentifier(
      new Headers({ 'x-santa-test-client-id': 'client-alpha' }),
    );
    const secondHash = hashClientIdentifier(
      new Headers({ 'x-santa-test-client-id': 'client-beta' }),
    );

    expect(firstHash).not.toBe(secondHash);
  });
});

describe('request hardening helpers', () => {
  it('rejects unsupported media types', async () => {
    const request = new Request('http://127.0.0.1:4321/api/rulings', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
      },
      body: 'hello',
    });

    await expect(parseJsonRequest(request, 1024)).resolves.toEqual({
      ok: false,
      status: 'unsupported-media',
    });
  });

  it('rejects malformed JSON safely', async () => {
    const request = new Request('http://127.0.0.1:4321/api/rulings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{',
    });

    await expect(parseJsonRequest(request, 1024)).resolves.toEqual({
      ok: false,
      status: 'invalid',
    });
  });

  it('rejects oversized JSON payloads', async () => {
    const request = new Request('http://127.0.0.1:4321/api/rulings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ request: 'x'.repeat(3000) }),
    });

    await expect(parseJsonRequest(request, 64)).resolves.toEqual({
      ok: false,
      status: 'payload-too-large',
    });
  });

  it('accepts same-origin requests and rejects clearly foreign origins', () => {
    expect(
      isAllowedOrigin(
        'http://127.0.0.1:4321',
        'http://127.0.0.1:4321/api/rulings',
      ),
    ).toBe(true);
    expect(
      isAllowedOrigin(
        'https://evil.example',
        'http://127.0.0.1:4321/api/rulings',
      ),
    ).toBe(false);
  });
});

describe('submission hardening', () => {
  it('creates one ruling and replays it for the same idempotency key', async () => {
    const dependencies = createSubmissionDependencies('idempotency-run');
    const context = {
      clientKeyHash: 'client-a',
      idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    };

    const firstResponse = await submitSantaRequest(
      {
        name: 'Holly',
        request: 'A brass telescope',
        website: '',
        formElapsedMs: 2000,
      },
      context,
      dependencies,
    );
    const secondResponse = await submitSantaRequest(
      {
        name: 'Holly',
        request: 'A brass telescope',
        website: '',
        formElapsedMs: 2000,
      },
      context,
      dependencies,
    );

    expect(firstResponse.status).toBe('created');
    expect(secondResponse).toMatchObject({
      status: 'duplicate',
      message: DUPLICATE_SUBMISSION_MESSAGE,
    });
  });

  it('treats the same normalized submission from the same client as a duplicate inside the window', async () => {
    const repository = createTestSubmissionRepository('duplicate-run');
    const firstDependencies = {
      ...createSubmissionDependencies('duplicate-run'),
      submissionRepository: repository,
    };
    const secondDependencies = {
      ...createSubmissionDependencies('duplicate-run'),
      submissionRepository: repository,
      publicIdGenerator: vi.fn(() => '3f2504e0-4f89-41d3-9a0c-0305e82c3301'),
    };

    await submitSantaRequest(
      {
        name: 'Holly',
        request: 'A brass telescope',
        website: '',
        formElapsedMs: 2000,
      },
      {
        clientKeyHash: 'client-a',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      firstDependencies,
    );

    const duplicateResponse = await submitSantaRequest(
      {
        name: '  holly  ',
        request: 'A   brass telescope',
        website: '',
        formElapsedMs: 2000,
      },
      {
        clientKeyHash: 'client-a',
        idempotencyKey: 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      secondDependencies,
    );

    expect(duplicateResponse).toMatchObject({
      status: 'duplicate',
      message: DUPLICATE_SUBMISSION_MESSAGE,
    });
  });

  it('keeps different clients isolated for duplicates and rate limits', async () => {
    const repository = createTestSubmissionRepository('client-isolation-run');
    await repository.recordSubmissionAttempt('client-a');
    await repository.recordSubmissionAttempt('client-a');
    await repository.recordSubmissionAttempt('client-a');
    await repository.recordSubmissionAttempt('client-a');
    await repository.recordSubmissionAttempt('client-a');

    const response = await submitSantaRequest(
      {
        name: 'Holly',
        request: 'A brass telescope',
        website: '',
        formElapsedMs: 2000,
      },
      {
        clientKeyHash: 'client-b',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      {
        ...createSubmissionDependencies('client-isolation-run'),
        submissionRepository: repository,
      },
    );

    expect(response.status).toBe('created');
  });

  it('rate-limits requests at the configured short-window boundary', async () => {
    const repository = createTestSubmissionRepository('rate-limit-run');
    for (let index = 0; index < 5; index += 1) {
      await repository.recordSubmissionAttempt('client-a');
    }

    const response = await submitSantaRequest(
      {
        name: 'Holly',
        request: 'A brass telescope',
        website: '',
        formElapsedMs: 2000,
      },
      {
        clientKeyHash: 'client-a',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      {
        ...createSubmissionDependencies('rate-limit-run'),
        submissionRepository: repository,
      },
    );

    expect(response).toMatchObject({
      status: 'rate-limited',
      message: RATE_LIMITED_MESSAGE,
    });
  });

  it('rejects invalid idempotency keys', async () => {
    const response = await submitSantaRequest(
      {
        name: 'Holly',
        request: 'A brass telescope',
        website: '',
        formElapsedMs: 2000,
      },
      {
        clientKeyHash: 'client-a',
        idempotencyKey: 'bad key!',
      },
      createSubmissionDependencies('invalid-key-run'),
    );

    expect(response).toMatchObject({
      status: 'invalid',
    });
  });

  it('rejects honeypot and implausibly fast submissions without creating rulings', async () => {
    const repository = createTestSubmissionRepository('bot-run');
    const dependencies = {
      ...createSubmissionDependencies('bot-run'),
      submissionRepository: repository,
    };

    const honeypotResponse = await submitSantaRequest(
      {
        name: 'Holly',
        request: 'A brass telescope',
        website: 'https://bot.example',
        formElapsedMs: 2000,
      },
      {
        clientKeyHash: 'client-a',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      dependencies,
    );

    const fastResponse = await submitSantaRequest(
      {
        name: 'Holly',
        request: 'A brass telescope',
        website: '',
        formElapsedMs: 100,
      },
      {
        clientKeyHash: 'client-a',
        idempotencyKey: 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      dependencies,
    );

    expect(honeypotResponse.status).toBe('bot-rejected');
    expect(fastResponse.status).toBe('bot-rejected');
    expect(
      await repository.findDuplicateRuling(
        'client-a',
        'holly',
        'a brass telescope',
        new Date('2026-07-16T11:59:00.000Z'),
      ),
    ).toBeNull();
  });
});

describe('public reporting', () => {
  async function createReportDependencies(runId: string) {
    const rulingsRepository = createTestRulingsRepository(runId);
    const reportsRepository = createTestRulingReportsRepository(runId);
    const storedRuling = await rulingsRepository.createStoredRuling({
      publicId: '550e8400-e29b-41d4-a716-446655440000',
      displayName: 'Holly',
      requestText: 'A brass telescope',
      decision: 'approved',
      santaResponse: 'VERY WELL, Holly. SANTA COMMANDS IT!',
    });

    return {
      rulingPublicId: storedRuling.publicRuling.publicId,
      dependencies: {
        rulingsRepository,
        reportsRepository,
        nowProvider: vi.fn(() => new Date('2026-07-16T12:00:00.000Z')),
        scenario: 'normal' as const,
      },
    };
  }

  it('accepts a valid report and trims the note', async () => {
    const { rulingPublicId, dependencies } =
      await createReportDependencies('report-success-run');

    const response = await submitRulingReport(
      {
        reason: 'spam',
        note: '  repeated spam  ',
      },
      {
        publicId: rulingPublicId,
        clientKeyHash: 'client-a',
      },
      dependencies,
    );

    expect(response.status).toBe('reported');
  });

  it('rejects invalid reasons and overlong notes', async () => {
    const { rulingPublicId, dependencies } =
      await createReportDependencies('report-invalid-run');

    const response = await submitRulingReport(
      {
        reason: 'invalid',
        note: 'x'.repeat(301),
      },
      {
        publicId: rulingPublicId,
        clientKeyHash: 'client-a',
      },
      dependencies,
    );

    expect(response).toEqual({
      status: 'invalid',
      fieldErrors: {
        reason: 'Please choose a reason for the report.',
        note: 'Please keep report notes to 300 characters or fewer.',
      },
    });
  });

  it('prevents duplicate reports for the same ruling from the same client', async () => {
    const { rulingPublicId, dependencies } = await createReportDependencies(
      'report-duplicate-run',
    );

    await submitRulingReport(
      {
        reason: 'spam',
        note: '',
      },
      {
        publicId: rulingPublicId,
        clientKeyHash: 'client-a',
      },
      dependencies,
    );

    const duplicateResponse = await submitRulingReport(
      {
        reason: 'spam',
        note: '',
      },
      {
        publicId: rulingPublicId,
        clientKeyHash: 'client-a',
      },
      dependencies,
    );

    expect(duplicateResponse).toMatchObject({
      status: 'duplicate',
      message: REPORT_DUPLICATE_MESSAGE,
    });
  });

  it('returns not-found for unknown public rulings', async () => {
    const { dependencies } =
      await createReportDependencies('report-missing-run');

    const response = await submitRulingReport(
      {
        reason: 'spam',
        note: '<script>alert(1)</script>',
      },
      {
        publicId: '550e8400-e29b-41d4-a716-446655440999',
        clientKeyHash: 'client-a',
      },
      dependencies,
    );

    expect(response).toEqual({
      status: 'not-found',
      message: 'SANTA CANNOT FIND THAT REQUEST.',
    });
  });
});
