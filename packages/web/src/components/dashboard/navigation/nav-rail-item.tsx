import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Un destino del riel lateral: sólo el ícono, y al pasar el mouse (o con el
 * foco del teclado) un tooltip con el nombre y qué se hace ahí.
 *
 * El riel reemplazó a la columna con etiquetas: 224px fijos se comían el
 * ancho que el Tablero necesita para sus tres columnas. Con sólo íconos, la
 * descripción del tooltip es lo que le dice a alguien nuevo para qué sirve
 * cada sección sin tener que entrar a mirar.
 *
 * Lo usan las dos navegaciones —la de la Empresa y la de una obra— para que se
 * vean y se comporten igual.
 *
 * Accesibilidad: el nombre va como texto `sr-only` (es el nombre accesible
 * del link) y Radix enlaza el tooltip con `aria-describedby`, así que un
 * lector de pantalla lee nombre y descripción.
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
            'flex size-11 shrink-0 items-center justify-center rounded-full transition-colors',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Icon className="size-5" />
          <span className="sr-only">{label}</span>
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="max-w-64 py-2 text-left">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-background/75">{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default NavRailItem;
