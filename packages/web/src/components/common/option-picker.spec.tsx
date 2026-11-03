import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OptionPicker, type PickerOption } from './option-picker';

const make = (count: number): PickerOption[] =>
  Array.from({ length: count }, (_, i) => ({ value: `v${i}`, label: `Opción ${i}` }));

describe('OptionPicker', () => {
  it('con 15 opciones o menos no muestra buscador', async () => {
    render(<OptionPicker value={undefined} onChange={vi.fn()} options={make(15)} placeholder="Elegí" />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('combobox', { name: /buscar|searchPlaceholder/i })).toBeNull();
    expect(screen.queryByPlaceholderText(/buscar|searchPlaceholder/i)).toBeNull();
  });

  it('con más de 15 filtra sin tildes ni mayúsculas', async () => {
    const options = [...make(16), { value: 'diseno', label: 'Diseño' }];
    const onChange = vi.fn();
    render(<OptionPicker value={undefined} onChange={onChange} options={options} placeholder="Elegí" />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.type(screen.getByPlaceholderText(/buscar|searchPlaceholder/i), 'DISENO');
    expect(screen.queryByText('Opción 3')).toBeNull();
    await userEvent.click(screen.getByText('Diseño'));
    expect(onChange).toHaveBeenCalledWith('diseno');
  });

  it('muestra las sugeridas primero mientras no se escribe', async () => {
    render(
      <OptionPicker value={undefined} onChange={vi.fn()} options={make(20)} suggested={['v7']} placeholder="Elegí" />,
    );
    await userEvent.click(screen.getByRole('combobox'));
    const items = screen.getAllByRole('option');
    expect(items[0]).toHaveTextContent('Opción 7');
    expect(items).toHaveLength(20);
  });
});

describe('OptionPicker — crear', () => {
  it('ofrece «Crear» sólo si lo escrito no está en la lista y elige lo creado', async () => {
    const onChange = vi.fn();
    const onCreate = vi.fn().mockResolvedValue('custom_yeseria');
    render(
      <OptionPicker value={undefined} onChange={onChange} onCreate={onCreate} options={make(20)} placeholder="Elegí" />,
    );
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.type(screen.getByPlaceholderText(/buscar|searchPlaceholder/i), 'Yesería');
    await userEvent.click(screen.getByText(/create|crear/i));
    expect(onCreate).toHaveBeenCalledWith('Yesería');
    expect(onChange).toHaveBeenCalledWith('custom_yeseria');
  });

  it('no ofrece «Crear» si ya existe, ni sin permiso', async () => {
    const { rerender } = render(
      <OptionPicker value={undefined} onChange={vi.fn()} onCreate={vi.fn()} options={make(20)} placeholder="Elegí" />,
    );
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.type(screen.getByPlaceholderText(/buscar|searchPlaceholder/i), 'opción 3');
    expect(screen.queryByText(/create|crear/i)).toBeNull();
    rerender(<OptionPicker value={undefined} onChange={vi.fn()} options={make(20)} placeholder="Elegí" />);
    await userEvent.clear(screen.getByPlaceholderText(/buscar|searchPlaceholder/i));
    await userEvent.type(screen.getByPlaceholderText(/buscar|searchPlaceholder/i), 'zzz');
    expect(screen.queryByText(/create|crear/i)).toBeNull();
  });
});
