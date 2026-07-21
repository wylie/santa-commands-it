import { beforeEach, describe, expect, it, vi } from 'vitest';

const { databaseRef } = vi.hoisted(() => ({
  databaseRef: {
    current: null as unknown,
  },
}));

vi.mock('@/server/db/client', () => ({
  getDatabase: () => databaseRef.current,
}));

describe('database-backed public rulings compatibility', () => {
  beforeEach(() => {
    databaseRef.current = null;
  });

  it('falls back to the legacy Latest Answers query when featured columns are missing', async () => {
    const limit = vi.fn(async () => {
      throw Object.assign(new Error('column missing'), {
        code: '42703',
        column: 'is_featured',
      });
    });
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const execute = vi.fn(async () => ({
      rows: [
        {
          id: 1,
          publicId: '550e8400-e29b-41d4-a716-446655440000',
          displayName: 'Holly',
          requestText: 'A brass telescope',
          decision: 'approved',
          santaResponse: 'SANTA COMMANDS IT!',
          createdAt: '2026-07-21T12:00:00.000Z',
        },
      ],
    }));

    databaseRef.current = {
      select,
      execute,
    };

    const { createDatabaseRulingsRepository } =
      await import('@/server/rulings/repository');
    const repository = createDatabaseRulingsRepository();

    await expect(repository.listRecentRulings(10)).resolves.toEqual([
      {
        publicId: '550e8400-e29b-41d4-a716-446655440000',
        displayName: 'Holly',
        requestText: 'A brass telescope',
        decision: 'approved',
        santaResponse: 'SANTA COMMANDS IT!',
        isFeatured: false,
        createdAt: '2026-07-21T12:00:00.000Z',
      },
    ]);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('retries submission persistence without featured columns when the older schema is still in production', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('column missing'), {
          code: '42703',
          column: 'is_featured',
        }),
      )
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            publicId: '550e8400-e29b-41d4-a716-446655440001',
            displayName: 'Holly',
            requestText: 'A brass telescope',
            decision: 'approved',
            santaResponse: 'SANTA COMMANDS IT!',
            isFeatured: false,
            createdAt: '2026-07-21T12:00:00.000Z',
          },
        ],
      });

    databaseRef.current = {
      execute,
    };

    const { createDatabaseSubmissionRepository } =
      await import('@/server/submissions/repository');
    const repository = createDatabaseSubmissionRepository();

    await expect(
      repository.createRulingWithIdempotency({
        publicId: '550e8400-e29b-41d4-a716-446655440001',
        displayName: 'Holly',
        requestText: 'A brass telescope',
        decision: 'approved',
        santaResponse: 'SANTA COMMANDS IT!',
        clientKeyHash: 'client-key',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        normalizedName: 'holly',
        normalizedRequest: 'a brass telescope',
        expiresAt: new Date('2026-07-22T12:00:00.000Z'),
      }),
    ).resolves.toEqual({
      publicId: '550e8400-e29b-41d4-a716-446655440001',
      displayName: 'Holly',
      requestText: 'A brass telescope',
      decision: 'approved',
      santaResponse: 'SANTA COMMANDS IT!',
      isFeatured: false,
      createdAt: '2026-07-21T12:00:00.000Z',
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
