import { ChevronDown, FileDown, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';

/**
 * Las descargas de un listado de plata (gastos o cobros). Un solo control, como
 * pide la arquitectura de la información: "Descargar" abre un menú con PDF y CSV.
 *
 * En el panel de filtros del celular (`compact`) no hay menú: un desplegable
 * dentro de un panel que se cierra al tocarlo se llevaría el menú con él, así que
 * van dos botones, uno por formato.
 *
 * `onWarm` se llama apenas la persona se acerca (puntero, foco, toque o menú
 * abierto): es cuando conviene empezar a bajar `jspdf`, que pesa, y no en cada
 * visita a la pantalla.
 */
export function MovementExport({
  compact,
  generatingPdf,
  disabled,
  onPdf,
  onCsv,
  onWarm,
  labels,
}: {
  compact: boolean;
  generatingPdf: boolean;
  disabled: boolean;
  onPdf: () => void;
  onCsv: () => void;
  onWarm: () => void;
  labels: { download: string; generating: string; pdf: string; csv: string; pdfButton: string; csvButton: string };
}) {
  const busy = generatingPdf;

  if (compact) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy}
          aria-busy={busy}
          onPointerEnter={onWarm}
          onFocus={onWarm}
          onTouchStart={onWarm}
          onClick={onPdf}
        >
          {busy ? <Spinner className="size-4" /> : <FileDown className="size-4" />}
          {busy ? labels.generating : labels.pdfButton}
        </Button>
        <Button type="button" variant="outline" disabled={disabled} onClick={onCsv}>
          <FileSpreadsheet className="size-4" />
          {labels.csvButton}
        </Button>
      </>
    );
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && onWarm()}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy}
          aria-busy={busy}
          onPointerEnter={onWarm}
          onFocus={onWarm}
        >
          {busy ? <Spinner className="size-4" /> : <FileDown className="size-4" />}
          {busy ? labels.generating : labels.download}
          <ChevronDown aria-hidden className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onPdf}>
          <FileDown className="size-4" />
          {labels.pdf}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCsv}>
          <FileSpreadsheet className="size-4" />
          {labels.csv}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
