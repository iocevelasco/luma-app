import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/app.config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../config/app.config.js')>();
  return { ...original, JWT_CONFIG: { ...original.JWT_CONFIG, SECRET: 'test-secret' } };
});

const calls: string[] = [];
const { Campaign, User, send } = vi.hoisted(() => ({
  Campaign: { findOneAndUpdate: vi.fn(), updateOne: vi.fn() },
  User: { find: vi.fn() },
  send: vi.fn(),
}));
vi.mock('../../models/Campaign.js', () => ({ Campaign }));
vi.mock('../../models/User.js', () => ({ User }));
vi.mock('../../services/email.service.js', () => ({ sendCampaignEmail: send }));

import { startCampaign } from '../../services/campaign.service.js';
import { unsubscribePage } from '../../controllers/campaign.controller.js';
import { unsubscribeUrl } from '../../utils/unsubscribe.js';

const chain = (rows: unknown[]) => ({ select: () => ({ lean: async () => rows }) });
const users = [
  { _id: 'a', email: 'a@x.com', name: 'A' },
  { _id: 'b', email: 'b@x.com', name: 'B' },
];
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  Campaign.updateOne.mockResolvedValue({});
  send.mockResolvedValue(true);
});

describe('startCampaign', () => {
  it('reclama el borrador antes de consultar la audiencia', async () => {
    Campaign.findOneAndUpdate.mockImplementation(async () => {
      calls.push('claim');
      return null;
    });
    User.find.mockImplementation(() => {
      calls.push('audience');
      return chain(users);
    });

    await expect(startCampaign('c1')).rejects.toMatchObject({ status: 409 });
    expect(calls).toEqual(['claim']);
  });

  it('no manda a quien se dio de baja durante el envío', async () => {
    Campaign.findOneAndUpdate.mockResolvedValue({ _id: 'c1', title: 't', body: 'b' });
    User.find
      .mockReturnValueOnce(chain(users)) // armado de la audiencia
      .mockReturnValueOnce(chain([users[0]])); // re-chequeo: `b` ya se dio de baja

    await startCampaign('c1');
    await settle();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe('a@x.com');
    expect(Campaign.updateOne).toHaveBeenLastCalledWith(
      { _id: 'c1' },
      expect.objectContaining({ status: 'sent', recipients: 1, sent: 1, failed: 0 }),
    );
  });

  it('vuelve a borrador si no se pudo armar la audiencia', async () => {
    Campaign.findOneAndUpdate.mockResolvedValue({ _id: 'c1' });
    User.find.mockImplementation(() => {
      throw new Error('mongo caído');
    });

    await expect(startCampaign('c1')).rejects.toThrow('mongo caído');
    expect(Campaign.updateOne).toHaveBeenCalledWith({ _id: 'c1' }, { status: 'draft' });
  });
});

describe('unsubscribePage', () => {
  const run = (query: Record<string, unknown>) => {
    const res = { status: vi.fn().mockReturnThis(), type: vi.fn().mockReturnThis(), send: vi.fn() };
    void unsubscribePage({ query } as never, res as never);
    return res;
  };

  it('arma el formulario sólo con u y s, sin reflejar parámetros de más', async () => {
    const link = new URL(unsubscribeUrl('abc123'));
    const res = run({
      u: 'abc123',
      s: link.searchParams.get('s'),
      x: '"><img src=x onerror=alert(1)>',
    });
    await settle();

    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain('action="?u=abc123&amp;s=');
    expect(html).not.toContain('onerror');
  });

  it('rechaza parámetros que no son texto', () => {
    const res = run({ u: ['abc123'], s: ['x'] });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
