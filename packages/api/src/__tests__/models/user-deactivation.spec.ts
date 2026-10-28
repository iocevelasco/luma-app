import { describe, expect, it } from 'vitest';
import { User } from '../../models/User.js';

type PreHooks = { execPre: (name: string, ctx: unknown, args: unknown[], cb: (e?: Error) => void) => void };

/** Corre los hooks `pre('save')` del esquema sin conectarse a ninguna base. */
function runPreSave(doc: InstanceType<typeof User>): Promise<void> {
  // `s.hooks` es la API interna (kareem) con la que Mongoose encadena los hooks.
  const { hooks } = (User.schema as unknown as { s: { hooks: PreHooks } }).s;
  return new Promise((resolve, reject) => {
    hooks.execPre('save', doc, [], (error) => (error ? reject(error) : resolve()));
  });
}

describe('baja de una cuenta', () => {
  it('al pasar a inactive deja la fecha de baja, para que la purga sepa desde cuándo contar', async () => {
    const user = new User({ email: 'a@x.com', name: 'A' });
    await runPreSave(user); // activa: no hay baja
    expect(user.deactivated_at).toBeUndefined();

    user.account_status = 'inactive';
    await runPreSave(user);
    expect(user.deactivated_at).toBeInstanceOf(Date);
  });

  it('no pisa una fecha de baja que ya estaba', async () => {
    const earlier = new Date('2026-01-01T00:00:00.000Z');
    const user = new User({ email: 'a@x.com', name: 'A', deactivated_at: earlier });
    user.account_status = 'inactive';
    await runPreSave(user);
    expect(user.deactivated_at).toEqual(earlier);
  });
});
