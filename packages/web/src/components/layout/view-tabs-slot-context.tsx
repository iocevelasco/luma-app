import { createContext, useContext } from 'react';

/**
 * El lugar, en la fila de pestañas de las secciones de la obra (`ProjectSectionTabs`), donde
 * una pantalla puede poner sus propias pestañas de vista (En patio / Kardex): a la misma altura
 * y al lado de Compras / Proveedores / Inventario, no en una segunda fila.
 *
 * `slot` es `null` cuando esa fila no existe (la sección es la única de su grupo, o se está
 * fuera de una obra): `PageLayout` las dibuja entonces en su propia barra.
 */
export const ViewTabsSlotContext = createContext<{
  slot: HTMLElement | null;
  setSlot: (node: HTMLElement | null) => void;
}>({ slot: null, setSlot: () => {} });

export function useViewTabsSlot() {
  return useContext(ViewTabsSlotContext);
}
