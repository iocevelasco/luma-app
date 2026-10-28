import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_ACTIVITY_FILTERS } from '@/lib/activity-filters';
import { ActivityFilterControls } from './activity-filter-bar';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

// Las claves reales de `taskPeople`: "name:" + el nombre normalizado, con espacios.
const PEOPLE = [
  { key: 'name:juan perez', name: 'Juan Pérez' },
  { key: 'name:maria del carmen lopez', name: 'María del Carmen López' },
  { key: 'user:64f1c2a9e1b3', name: 'Ana Gómez' },
];

function renderControls(onChange = vi.fn()) {
  render(
    <ActivityFilterControls
      filters={EMPTY_ACTIVITY_FILTERS}
      onChange={onChange}
      onReset={vi.fn()}
      people={PEOPLE}
      canFilterMaterials={false}
      canFilterReview={false}
    />,
  );
  return onChange;
}

describe('ActivityFilterControls — responsables en el panel', () => {
  it('cada responsable tiene un id válido y único, aunque su clave lleve dos puntos y espacios', async () => {
    renderControls();
    await userEvent.click(screen.getByTestId('activity-filters-button'));

    const ids = PEOPLE.map(({ name }) => screen.getByRole('checkbox', { name }).id);
    for (const id of ids) {
      expect(id).not.toMatch(/\s/);
      expect(id).toBeTruthy();
    }
    expect(new Set(ids).size).toBe(PEOPLE.length);
  });

  it('marcar a una persona filtra por su clave, no por el id', async () => {
    const onChange = renderControls();
    await userEvent.click(screen.getByTestId('activity-filters-button'));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Juan Pérez' }));

    expect(onChange).toHaveBeenCalledWith({ responsibles: ['name:juan perez'] });
  });
});
