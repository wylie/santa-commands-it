import { describe, expect, it, vi } from 'vitest';

import { mapRulingRowToPublicRuling } from '@/server/rulings/repository';
import { GENERIC_ERROR_MESSAGE } from '@/server/submissions/service';
import { submitSantaRequest } from '@/server/submissions/service';
import type { SubmissionRepository } from '@/server/submissions/repository';
import {
  formatRulingTimestamp,
  getDecisionPanelTitle,
  isPublicRuling,
  isSubmitRulingResponse,
} from '@/utils/rulings';

function createRepositoryMock() {
  return {
    countSubmissionAttemptsSince: vi.fn(async () => 0),
    recordSubmissionAttempt: vi.fn(async () => undefined),
    getRulingByIdempotencyKey: vi.fn(async () => null),
    findDuplicateRuling: vi.fn(async () => null),
    createRulingWithIdempotency: vi.fn(async (input) => ({
      publicId: input.publicId,
      displayName: input.displayName,
      requestText: input.requestText,
      decision: input.decision,
      santaResponse: input.santaResponse,
      createdAt: '2026-07-15T23:30:00.000Z',
    })),
  } satisfies SubmissionRepository;
}

function createDependencies(repository = createRepositoryMock()) {
  return {
    submissionRepository: repository,
    randomProvider: vi.fn(() => 0.5),
    publicIdGenerator: vi.fn(() => 'public-ruling-id'),
    nowProvider: vi.fn(() => new Date('2026-07-15T23:30:00.000Z')),
    scenario: 'normal' as const,
  };
}

describe('server submission validation', () => {
  it('returns invalid when the name is missing', async () => {
    const response = await submitSantaRequest(
      { name: '', request: 'A brass telescope' },
      {
        clientKeyHash: 'hashed-client',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      createDependencies(),
    );

    expect(response).toEqual({
      status: 'invalid',
      fieldErrors: {
        name: 'Please tell Santa what to call you.',
        request: undefined,
      },
    });
  });

  it('returns invalid when the request is missing', async () => {
    const response = await submitSantaRequest(
      { name: 'Holly', request: '' },
      {
        clientKeyHash: 'hashed-client',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      createDependencies(),
    );

    expect(response).toEqual({
      status: 'invalid',
      fieldErrors: {
        name: undefined,
        request: 'Please tell Santa what you would like.',
      },
    });
  });

  it('rejects whitespace-only values', async () => {
    const response = await submitSantaRequest(
      { name: '   ', request: '   ' },
      {
        clientKeyHash: 'hashed-client',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      createDependencies(),
    );

    expect(response).toEqual({
      status: 'invalid',
      fieldErrors: {
        name: 'Please tell Santa what to call you.',
        request: 'Please tell Santa what you would like.',
      },
    });
  });

  it('accepts boundary lengths for both fields', async () => {
    const response = await submitSantaRequest(
      {
        name: 'H'.repeat(40),
        request: 'R'.repeat(500),
      },
      {
        clientKeyHash: 'hashed-client',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      createDependencies(),
    );

    expect(response.status).toBe('created');
  });

  it('treats malformed payloads as invalid', async () => {
    const response = await submitSantaRequest(
      'not-an-object',
      {
        clientKeyHash: 'hashed-client',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      createDependencies(),
    );

    expect(response).toEqual({
      status: 'invalid',
      fieldErrors: {
        name: 'Please tell Santa what to call you.',
        request: 'Please tell Santa what you would like.',
      },
    });
  });
});

describe('authoritative server decision flow', () => {
  it('returns blocked for a blocked name and never creates a ruling', async () => {
    const repository = createRepositoryMock();
    const response = await submitSantaRequest(
      { name: 'blocked-example', request: 'A brass telescope' },
      {
        clientKeyHash: 'hashed-client',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      createDependencies(repository),
    );

    expect(response).toEqual({
      status: 'blocked',
      focusField: 'name',
      message: 'THAT IS UNACCEPTABLE. ASK FOR SOMETHING ELSE OR RECEIVE COAL!',
      supportingMessage:
        'Santa will give you another chance to choose something kinder.',
    });
    expect(repository.createRulingWithIdempotency).not.toHaveBeenCalled();
  });

  it('returns blocked for a blocked request and never creates a ruling', async () => {
    const repository = createRepositoryMock();
    const response = await submitSantaRequest(
      { name: 'Holly', request: 'Please hurt someone with this gift.' },
      {
        clientKeyHash: 'hashed-client',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      createDependencies(repository),
    );

    expect(response).toMatchObject({
      status: 'blocked',
      focusField: 'request',
    });
    expect(repository.createRulingWithIdempotency).not.toHaveBeenCalled();
  });

  it('creates an approved ruling once when the coal roll fails', async () => {
    const repository = createRepositoryMock();
    const dependencies = createDependencies(repository);
    dependencies.randomProvider = vi
      .fn<() => number>()
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0);

    const response = await submitSantaRequest(
      { name: 'Holly', request: 'A brass telescope' },
      {
        clientKeyHash: 'hashed-client',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      dependencies,
    );

    expect(response.status).toBe('created');
    expect(repository.createRulingWithIdempotency).toHaveBeenCalledTimes(1);
    expect(repository.createRulingWithIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'approved',
      }),
    );
  });

  it('creates a coal ruling once when the coal roll succeeds', async () => {
    const repository = createRepositoryMock();
    const dependencies = createDependencies(repository);
    dependencies.randomProvider = vi
      .fn<() => number>()
      .mockReturnValueOnce(0.01)
      .mockReturnValueOnce(0);

    const response = await submitSantaRequest(
      { name: 'Holly', request: 'A brass telescope' },
      {
        clientKeyHash: 'hashed-client',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      dependencies,
    );

    expect(response.status).toBe('created');
    expect(repository.createRulingWithIdempotency).toHaveBeenCalledTimes(1);
    expect(repository.createRulingWithIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'random-coal',
      }),
    );
  });

  it('runs moderation before random coal', async () => {
    const repository = createRepositoryMock();
    const dependencies = createDependencies(repository);
    dependencies.randomProvider = vi.fn(() => {
      throw new Error('random should not run');
    });

    const response = await submitSantaRequest(
      { name: 'blocked-example', request: 'A brass telescope' },
      {
        clientKeyHash: 'hashed-client',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      dependencies,
    );

    expect(response.status).toBe('blocked');
    expect(repository.createRulingWithIdempotency).not.toHaveBeenCalled();
    expect(dependencies.randomProvider).not.toHaveBeenCalled();
  });

  it('ignores client-supplied decision and coal percentage fields', async () => {
    const repository = createRepositoryMock();
    const response = await submitSantaRequest(
      {
        name: 'Holly',
        request: 'A brass telescope',
        decision: 'random-coal',
        randomCoalPercentage: 100,
      },
      {
        clientKeyHash: 'hashed-client',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      createDependencies(repository),
    );

    expect(response.status).toBe('created');
    expect(repository.createRulingWithIdempotency).toHaveBeenCalledWith(
      expect.not.objectContaining({
        decision: 'random-coal',
        randomCoalPercentage: 100,
      }),
    );
  });

  it('stores the same Santa response that it returns', async () => {
    const repository = createRepositoryMock();
    const dependencies = createDependencies(repository);
    dependencies.randomProvider = vi
      .fn<() => number>()
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0);

    const response = await submitSantaRequest(
      { name: 'Holly', request: 'A brass telescope' },
      {
        clientKeyHash: 'hashed-client',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      dependencies,
    );

    expect(response.status).toBe('created');
    expect(repository.createRulingWithIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        santaResponse:
          response.status === 'created' ? response.ruling.santaResponse : '',
      }),
    );
  });

  it('can simulate a recoverable server error in test mode', async () => {
    await expect(
      submitSantaRequest(
        { name: 'Holly', request: 'A brass telescope' },
        {
          clientKeyHash: 'hashed-client',
          idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        },
        {
          ...createDependencies(),
          scenario: 'submit-error',
        },
      ),
    ).rejects.toThrow('Simulated test submission failure.');
  });
});

describe('public ruling mapping and rendering safety', () => {
  it('maps database rows to safe public rulings without exposing the internal id', () => {
    const publicRuling = mapRulingRowToPublicRuling({
      id: 42,
      publicId: 'public-ruling-id',
      displayName: '<Holly>',
      requestText: '<script>alert(1)</script>',
      decision: 'approved',
      santaResponse: 'VERY WELL, Holly.',
      createdAt: new Date('2026-07-15T23:30:00.000Z'),
    });

    expect(publicRuling).toEqual({
      publicId: 'public-ruling-id',
      displayName: '<Holly>',
      requestText: '<script>alert(1)</script>',
      decision: 'approved',
      santaResponse: 'VERY WELL, Holly.',
      createdAt: '2026-07-15T23:30:00.000Z',
    });
    expect('id' in publicRuling).toBe(false);
  });

  it('rejects unsupported public decision values', () => {
    expect(() =>
      mapRulingRowToPublicRuling({
        id: 42,
        publicId: 'public-ruling-id',
        displayName: 'Holly',
        requestText: 'A brass telescope',
        decision: 'blocked' as 'approved',
        santaResponse: 'NO.',
        createdAt: new Date('2026-07-15T23:30:00.000Z'),
      }),
    ).toThrow('Only approved and random-coal rulings can be public.');
  });

  it('formats timestamps predictably for recent rulings', () => {
    expect(formatRulingTimestamp('2026-07-15T23:30:00.000Z')).toBe(
      'July 15, 2026 at 7:30 PM',
    );
  });

  it('keeps HTML-like values as plain text-safe strings in public data', () => {
    const response = {
      status: 'created',
      ruling: {
        publicId: 'public-ruling-id',
        displayName: '<Holly>',
        requestText: '<img src=x onerror=alert(1)>',
        decision: 'approved',
        santaResponse: 'VERY WELL, <Holly>.',
        createdAt: '2026-07-15T23:30:00.000Z',
      },
    } as const;

    expect(isSubmitRulingResponse(response)).toBe(true);
    expect(isPublicRuling(response.ruling)).toBe(true);
    expect(getDecisionPanelTitle(response.ruling.decision)).toBe(
      'SANTA COMMANDS IT!',
    );
  });
});

describe('error messaging', () => {
  it('keeps the generic server failure copy stable', () => {
    expect(GENERIC_ERROR_MESSAGE).toBe(
      "Santa's workshop had a small mishap. Please try again.",
    );
  });
});
