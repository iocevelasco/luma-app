import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEventHandler, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BinancePaymentDrawer } from './binance-payment-drawer';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  quote: {
    data: {
      quote: { totalUsd: 39 },
      amountUsdt: 39,
      activatesNow: false,
      account: { payId: '123456789', name: 'Luma' },
      plan: 'pro',
      planVersion: 1,
      receiptRequired: true,
    },
    isLoading: false,
    isError: false,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}));
vi.mock('@/hooks/subscription/use-subscription-queries', () => ({
  useBinanceQuote: () => mocks.quote,
  usePayWithBinance: () => ({ mutate: mocks.mutate, reset: vi.fn(), isPending: false, error: null }),
}));
vi.mock('@/components/common/form-drawer', () => ({
  FormDrawer: ({ onSubmit, children }: { onSubmit?: FormEventHandler; children: ReactNode }) => (
    <form noValidate onSubmit={onSubmit}>
      {children}
      <button type="submit">enviar</button>
    </form>
  ),
}));

describe('BinancePaymentDrawer', () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
  });

  it('muestra cuánto pagar y a qué cuenta, sin pedir datos de la orden', () => {
    const { container } = render(<BinancePaymentDrawer open onOpenChange={vi.fn()} />);
    expect(screen.getByText('39 USDT')).toBeTruthy();
    expect(screen.getByText('123456789')).toBeTruthy();
    expect(container.querySelectorAll('input:not([type="file"])')).toHaveLength(0);
  });

  it('no manda el pago sin comprobante', async () => {
    const user = userEvent.setup();
    render(<BinancePaymentDrawer open onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'enviar' }));

    expect(await screen.findByText('subscription.bolivares.fields.receiptRequired')).toBeTruthy();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it('manda sólo el plan elegido y el comprobante', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BinancePaymentDrawer open onOpenChange={vi.fn()} activateNow plan="unlimited" />,
    );
    const file = new File(['x'], 'orden.png', { type: 'image/png' });
    await user.upload(container.querySelector<HTMLInputElement>('#bn-receipt')!, file);

    await user.click(screen.getByRole('button', { name: 'enviar' }));

    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    expect(mocks.mutate.mock.calls[0][0]).toEqual({
      receipt: file,
      payload: { activateNow: true, includeNextProject: false, plan: 'unlimited' },
    });
  });
});
