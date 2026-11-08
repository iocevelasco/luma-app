import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Rocket } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { SpotlightTour, type TourStep } from './spotlight-tour';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const STEPS: TourStep[] = [
  { id: 'a', icon: Rocket, title: 'Primero', body: 'Cuerpo uno' },
  { id: 'b', icon: Rocket, title: 'Segundo', body: 'Cuerpo dos' },
];

describe('SpotlightTour', () => {
  it('avanza y retrocede entre pasos', async () => {
    render(<SpotlightTour steps={STEPS} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Primero' })).toBeTruthy();

    await userEvent.click(screen.getByTestId('tour-next'));
    expect(screen.getByRole('heading', { name: 'Segundo' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'tour.back' }));
    expect(screen.getByRole('heading', { name: 'Primero' })).toBeTruthy();
  });

  it('omitir y Escape cierran', async () => {
    const onClose = vi.fn();
    render(<SpotlightTour steps={STEPS} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'tour.skip' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('el último paso sin acción cierra con "Entendido" y no ofrece omitir', async () => {
    const onClose = vi.fn();
    render(<SpotlightTour steps={STEPS} onClose={onClose} />);
    await userEvent.click(screen.getByTestId('tour-next'));
    expect(screen.queryByRole('button', { name: 'tour.skip' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'tour.done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('el último paso con acción la ofrece como botón principal', async () => {
    const onPress = vi.fn();
    const steps: TourStep[] = [
      { id: 'a', icon: Rocket, title: 'Único', body: 'Cuerpo', cta: { label: 'Crear la obra', onPress } },
    ];
    render(<SpotlightTour steps={steps} onClose={vi.fn()} />);
    await userEvent.click(screen.getByTestId('tour-cta'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('un paso cuyo elemento no está a la vista se muestra igual, sin marcar nada', () => {
    const steps: TourStep[] = [
      { id: 'a', icon: Rocket, title: 'Sin elemento', body: 'Cuerpo', target: '[data-testid="no-existe"]' },
    ];
    render(<SpotlightTour steps={steps} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Sin elemento' })).toBeTruthy();
  });
});
