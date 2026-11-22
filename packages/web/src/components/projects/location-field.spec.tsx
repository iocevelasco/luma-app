import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LocationField } from './location-field';

const config = vi.hoisted(() => ({ value: { maps: { apiKey: 'k' } } as { maps: { apiKey: string } | null } }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-ES', resolvedLanguage: 'es-ES' } }),
}));
vi.mock('@/hooks/integrations-config/use-integrations-config', () => ({
  useIntegrationsConfig: () => ({ data: config.value }),
}));

describe('LocationField', () => {
  it('con Maps, avisa que sugiere direcciones', () => {
    config.value = { maps: { apiKey: 'k' } };
    render(<LocationField id="loc" value="" onChange={vi.fn()} />);
    expect(screen.getByText('project.location.hint')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', 'project.location.placeholder');
  });

  it('con un lugar elegido, dice que la obra tendrá mapa', () => {
    config.value = { maps: { apiKey: 'k' } };
    render(<LocationField id="loc" value="Calle 1" placeId="p1" onChange={vi.fn()} />);
    expect(screen.getByText('project.location.placeChosen')).toBeInTheDocument();
    expect(screen.queryByText('project.location.hint')).not.toBeInTheDocument();
  });

  it('sin Maps no promete sugerencias', () => {
    config.value = { maps: null };
    render(<LocationField id="loc" value="" onChange={vi.fn()} />);
    expect(screen.queryByText('project.location.hint')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).not.toHaveAttribute('placeholder', 'project.location.placeholder');
  });
});
