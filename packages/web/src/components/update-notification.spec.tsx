import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UpdateBanner } from './update-notification';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('UpdateBanner', () => {
  it('no se puede omitir: sólo ofrece actualizar', async () => {
    const onRefresh = vi.fn();
    render(<UpdateBanner version="0.34.0" onRefresh={onRefresh} />);
    expect(screen.queryByTestId('update-banner-continue')).toBeNull();
    expect(screen.queryByRole('button', { name: 'appUpdate.dismiss' })).toBeNull();

    await userEvent.click(screen.getByTestId('update-banner-action'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('si ya se intentó actualizar, ofrece seguir sin actualizar como única salida', async () => {
    const onContinue = vi.fn();
    render(<UpdateBanner version={null} onRefresh={vi.fn()} onContinue={onContinue} />);
    await userEvent.click(screen.getByTestId('update-banner-continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
