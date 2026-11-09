import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEventHandler, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BolivaresPaymentDrawer } from './bolivares-payment-drawer';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  quote: {
    data: {
      quote: { totalUsd: 39 },
      rate: { usd: 40, valueDate: '2026-11-08' },
      amountBs: 1560,
      activatesNow: false,
      accounts: { pagoMovil: { bank: 'Banesco', phone: '0414', id: 'J-1' } },
      receiptRequired: true,
    },
    isLoading: false,
    isError: false,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}));
vi.mock('@/hooks/use-date-locale', () => ({ useDateLocale: () => undefined }));
vi.mock('@/hooks/subscription/use-subscription-queries', () => ({
  useBolivaresQuote: () => mocks.quote,
  usePayInBolivares: () => ({ mutate: mocks.mutate, reset: vi.fn(), isPending: false, error: null }),
}));
vi.mock('@/components/common/form-drawer', () => ({
  FormDrawer: ({ onSubmit, children }: { onSubmit?: FormEventHandler; children: ReactNode }) => (
    <form noValidate onSubmit={onSubmit}>
      {children}
      <button type="submit">enviar</button>
    </form>
  ),
}));

const REQUIRED_ERROR = 'subscription.bolivares.fields.receiptRequired';

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('subscription.bolivares.fields.bank'), 'Mercantil');
  await user.type(screen.getByLabelText('subscription.bolivares.fields.reference'), '12345678');
  await user.type(screen.getByLabelText('subscription.bolivares.fields.payerId'), 'V-12345678');
}

function renderDrawer() {
  const onOpenChange = vi.fn();
  const view = render(<BolivaresPaymentDrawer open onOpenChange={onOpenChange} />);
  const input = () => view.container.querySelector<HTMLInputElement>('#bs-receipt');
  return { onOpenChange, input };
}

describe('BolivaresPaymentDrawer', () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
    mocks.quote.data.receiptRequired = true;
  });

  it('no manda el pago sin comprobante cuando es obligatorio', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await fillForm(user);

    await user.click(screen.getByRole('button', { name: 'enviar' }));

    expect(await screen.findByText(REQUIRED_ERROR)).toBeTruthy();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it('rechaza un archivo que no es PDF ni imagen antes de subirlo', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { input } = renderDrawer();

    await user.upload(input()!, new File(['x'], 'notas.txt', { type: 'text/plain' }));

    expect(screen.getByText('subscription.bolivares.fields.receiptType')).toBeTruthy();
    expect(screen.queryByText('notas.txt')).toBeNull();
  });

  it('después de un pago no reenvía el comprobante anterior', async () => {
    const user = userEvent.setup();
    const { input, onOpenChange } = renderDrawer();
    const file = new File(['x'], 'pago.pdf', { type: 'application/pdf' });
    await fillForm(user);
    await user.upload(input()!, file);

    await user.click(screen.getByRole('button', { name: 'enviar' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    const [variables, options] = mocks.mutate.mock.calls[0];
    expect(variables.receipt).toBe(file);

    options.onSuccess();
    await waitFor(() => expect(screen.queryByText('pago.pdf')).toBeNull());
    expect(onOpenChange).toHaveBeenCalledWith(false);

    await user.click(screen.getByRole('button', { name: 'enviar' }));
    expect(await screen.findByText(REQUIRED_ERROR)).toBeTruthy();
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });

  it('sin storage en el entorno no ofrece el campo y deja mandar el pago', async () => {
    mocks.quote.data.receiptRequired = false;
    const user = userEvent.setup();
    const { input } = renderDrawer();
    await fillForm(user);

    expect(input()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'enviar' }));

    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    expect(mocks.mutate.mock.calls[0][0].receipt).toBeNull();
  });
});
