import { useState } from 'react';

/**
 * El dato tal como estaba al abrir, congelado mientras el panel sigue abierto.
 *
 * Un formulario de edición que arma sus campos con `useForm({ values })` sobre
 * un objeto que viene de una query **se reinicia** cada vez que ese objeto
 * cambia. Con refetch al foco, polling y avisos en vivo, el dato cambia cuando
 * otra persona toca el mismo registro, y lo que estabas tipeando desaparece
 * sin aviso. Congelarlo mientras el panel está abierto evita eso: al guardar
 * se manda lo que la persona vio y editó, y la API —que sí conoce el estado
 * real— acepta o rechaza.
 *
 * Con el panel cerrado devuelve el valor vivo: la próxima apertura arranca de
 * lo último que llegó.
 */
export function usePinnedWhileOpen<T>(value: T, open: boolean): T {
  const [pinned, setPinned] = useState(value);
  const [wasOpen, setWasOpen] = useState(open);

  // "Ajustar estado cuando cambia una prop": se corrige durante el render y
  // React descarta el render intermedio, sin pasar por un efecto.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPinned(value);
  }

  return open ? pinned : value;
}
