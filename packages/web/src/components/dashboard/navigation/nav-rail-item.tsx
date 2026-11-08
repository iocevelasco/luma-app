import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Ancho del riel: 112px. "Documentación" mide 82px a 11px de texto (el piso del
 * sistema) y al riel le restan 16px de padding y 8px del ítem; con 88px se cortaba.
 */
export const RAIL_WIDTH = 'w-28';

/**
 * Un destino del riel lateral: el ícono arriba y el nombre debajo, y al pasar
 * el mouse (o con el foco del teclado) un tooltip con qué se hace ahí.
 *
 * El riel reemplazó a la columna con etiquetas: 224px fijos se comían el
 * ancho que el Tablero necesita para sus tres columnas. El nombre vuelve, pero
 * debajo del ícono y no al lado: apilado, el riel sigue angosto. La descripción
 * del tooltip es lo que le dice a alguien nuevo para qué sirve cada sección
 * sin tener que entrar a mirar.
 *
 * Lo usan las dos navegaciones —la de la Empresa y la de una obra— para que se
 * vean y se comporten igual.
 *
 * Accesibilidad: el nombre visible es el nombre accesible del link y el
 * tooltip se enlaza con `aria-describedby`, así que un lector de pantalla lee
 * nombre y descripción.
 *
 * `isActive` llega resuelto y `className` es un string: `TooltipTrigger
 * asChild` clona el link con el `Slot` de Radix, que asume que `className` es
 * un string. Si es la función `({ isActive }) => ...` de `NavLink`, la mete en
 * un `.join(' ')` y termina serializando el código fuente de la función como
 * clase: ninguna clase real se aplica.
 */
export function NavRailItem({
  to,
  icon: Icon,
  label,
  description,
  isActive,
  end,
  testId,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  description: string;
  isActive: boolean;
  end?: boolean;
  testId?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={to}
          end={end}
          data-testid={testId}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'flex w-full flex-col items-center gap-1 rounded-md px-1 py-2 transition-colors',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          <Icon className="size-5 shrink-0" />
          <span className="w-full truncate text-center text-2xs leading-tight">{label}</span>
        </NavLink>
      </TooltipTrigger>
      {/* El nombre ya está visible bajo el ícono: el tooltip sólo dice qué se hace ahí. */}
      <TooltipContent side="right" sideOffset={8} className="max-w-64 px-3 py-2 text-left break-normal">
        <p className="text-sm">{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default NavRailItem;
