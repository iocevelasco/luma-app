import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_PURGE_RETENTION_DAYS } from '@luma/shared';

const find = vi.fn();
const updateOne = vi.fn();

vi.mock('../../models/User.js', () => ({
  User: { find: (...args: unknown[]) => ({ select: () => find(...args) }), updateOne },
}));

const { purgeExpiredAccounts } = await import('../../services/account-purge.service.js');

const NOW = new Date('2026-12-01T00:00:00.000Z');

describe('purgeExpiredAccounts', () => {
  beforeEach(() => {
    find.mockReset();
    updateOne.mockReset();
  });

  it('busca bajas más viejas que la retención y todavía no purgadas', async () => {
    find.mockResolvedValue([]);
    await purgeExpiredAccounts(NOW);

    const filter = find.mock.calls[0][0];
    const cutoff = filter.deactivated_at.$lte as Date;
    expect((NOW.getTime() - cutoff.getTime()) / 86_400_000).toBe(ACCOUNT_PURGE_RETENTION_DAYS);
    expect(filter.account_status).toBe('inactive');
    expect(filter.purgedAt).toEqual({ $exists: false });
  });

  it('borra lo que identifica a la persona y conserva el documento', async () => {
    find.mockResolvedValue([{ _id: 'abc123' }]);
    updateOne.mockResolvedValue({});

    const run = await purgeExpiredAccounts(NOW);

    expect(run).toEqual({ checked: 1, purged: 1, failed: 0 });
    const [filter, update] = updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: 'abc123' });
    expect(update.$set.email).toBe('purged-abc123@purged.invalid');
    expect(update.$set.purgedAt).toBe(NOW);
    expect(Object.keys(update.$unset)).toEqual(
      expect.arrayContaining(['password', 'picture', 'termsAcceptedIp', 'termsAcceptedUserAgent']),
    );
  });

  it('cuenta la falla y sigue con las demás', async () => {
    find.mockResolvedValue([{ _id: 'a' }, { _id: 'b' }]);
    updateOne.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({});
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const run = await purgeExpiredAccounts(NOW);

    expect(run).toEqual({ checked: 2, purged: 1, failed: 1 });
  });
});
