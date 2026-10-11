import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TruncatedTextProps {
  text: string;
  className?: string;
}

/**
 * Texto que se corta con ellipsis cuando no entra en su contenedor, y muestra
 * el valor completo en un tooltip al pasar el mouse. Pensado para celdas de
 * tabla/grilla con ancho fijo — nombre, área, responsable — donde un valor
 * largo no puede simplemente hacer wrap sin romper el layout de la fila.
 */
export function TruncatedText({ text, className }: TruncatedTextProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('block truncate', className)}>{text}</span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

export default TruncatedText;
