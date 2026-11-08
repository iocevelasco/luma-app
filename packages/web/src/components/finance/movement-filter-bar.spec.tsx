import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MovementFilterBar, type MovementFilterBarProps } from './movement-filter-bar';

type Kind = 'a' | 'b';
type Group = 'month' | 'day';

function setup(overrides: Partial<MovementFilterBarProps<Kind, Group>> = {}) {
  const props: MovementFilterBarProps<Kind, Group> = {
    search: '',
    onSearchChange: vi.fn(),
    kind: {
      value: 'all',
      onChange: vi.fn(),
      options: [{ value: 'a', label: 'Tipo A' }, { value: 'b', label: 'Tipo B' }],
      allLabel: 'Todos',
      ariaLabel: 'Tipo',
    },
    from: '',
    to: '',
    onFromChange: vi.fn(),
    onToChange: vi.fn(),
    groupBy: {
      value: 'month',
      onChange: vi.fn(),
      options: [{ value: 'month', label: 'Por mes' }, { value: 'day', label: 'Por día' }],
      ariaLabel: 'Agrupar por',
    },
    activeCount: 0,
    onClear: vi.fn(),
    labels: {
      search: 'Buscar', from: 'Desde', to: 'Hasta', clear: 'Quitar filtros',
      button: 'Filtros', done: 'Hecho', actions: 'Acciones',
    },
    ...overrides,
  };
  render(<MovementFilterBar {...props} />);
  return props;
}

describe('MovementFilterBar — escritorio', () => {
  it('muestra todos los controles en la barra, sin botón de panel', () => {
    setup();
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toBeTruthy();
    expect(screen.getByLabelText('Desde')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Agrupar por' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Filtros' })).toBeNull();
  });

  it('el botón de quitar filtros aparece sólo con filtros activos y los limpia', async () => {
    const props = setup({ activeCount: 2 });
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(props.onClear).toHaveBeenCalledOnce();
  });

  it('avisa lo que se escribe en el buscador', async () => {
    const props = setup();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'a');
    expect(props.onSearchChange).toHaveBeenCalledWith('a');
  });
});

describe('MovementFilterBar — compacto', () => {
  it('deja sólo el botón Filtros, con el conteo de filtros activos', () => {
    setup({ compact: true, activeCount: 3 });
    const button = screen.getByRole('button', { name: 'Filtros' });
    expect(button.textContent).toContain('3');
    expect(screen.queryByRole('searchbox', { name: 'Buscar' })).toBeNull();
  });

  it('el panel trae los filtros y las acciones; tocar una acción cierra el panel', async () => {
    const onAction = vi.fn();
    setup({ compact: true, actions: <button type="button" onClick={onAction}>Descargar PDF</button> });
    await userEvent.click(screen.getByRole('button', { name: 'Filtros' }));

    expect(await screen.findByRole('searchbox', { name: 'Buscar' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Agrupar por' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    expect(onAction).toHaveBeenCalledOnce();
    // El Drawer de HeroUI (React Aria) desmonta el panel al cerrarse.
    await vi.waitFor(() => expect(document.querySelector('[data-slot=drawer-content]')).toBeNull());
  });

  it('Quitar filtros vive en el pie del panel y no lo cierra', async () => {
    const props = setup({ compact: true, activeCount: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar filtros' }));
    expect(props.onClear).toHaveBeenCalledOnce();
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeTruthy();
  });
});
