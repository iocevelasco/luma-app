import { useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Selecciona todo el contenido del input.
 *
 * `select()` solo no alcanza en iOS Safari: en un input `readOnly` no deja
 * nada seleccionado, y el rango explícito es lo que hace aparecer el menú de
 * copiar. Va el par, no uno u otro.
 */
function selectAll(input: HTMLInputElement) {
  input.select();
  input.setSelectionRange(0, input.value.length);
}

/** Lo que el servidor devuelve cuando el mail de activación no salió. */
export interface ActivationLink {
  /** A quién se le creó la cuenta, para que el texto diga de quién es el enlace. */
  name: string;
  url: string;
}

/**
 * El mail de activación no salió: acá queda el enlace para que quien invitó se
 * lo haga llegar a la persona por otro medio.
 *
 * Existe porque, sin esto, una invitación cuyo mail falla deja una cuenta que
 * nadie puede activar y de la que nadie se entera. Sólo se abre cuando la API
 * dice que el mail no salió — no es una función de "ver el link" de toda
 * invitación, porque quien lo tiene elige la contraseña de esa cuenta.
 */
export function ActivationLinkDialog({
  link,
  onClose,
}: {
  link: ActivationLink | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(link)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {/* El contenido vive en su propio componente: así `copied` arranca en
            false cada vez que el diálogo se abre. */}
        {link && <ActivationLinkBody link={link} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ActivationLinkBody({ link, onClose }: { link: ActivationLink; onClose: () => void }) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    // `navigator.clipboard` no existe fuera de un contexto seguro y en algunos
    // WebViews de iOS: se detecta, no se asume. Sin él se deja el texto
    // seleccionado para que la persona copie con el sistema.
    if (typeof navigator.clipboard?.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(link.url);
        setCopied(true);
        return;
      } catch {
        // Permiso denegado: cae a la selección manual.
      }
    }
    if (inputRef.current) selectAll(inputRef.current);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('team.activationLink.title')}</DialogTitle>
        <DialogDescription>
          {t('team.activationLink.body', { name: link.name })}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="activation-link">{t('team.activationLink.label')}</Label>
        <div className="flex gap-2">
          <Input
            id="activation-link"
            ref={inputRef}
            readOnly
            value={link.url}
            className="font-mono text-sm"
            onFocus={(event) => selectAll(event.currentTarget)}
          />
          <Button type="button" variant="outline" onClick={() => void copy()}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t('team.activationLink.copied') : t('team.activationLink.copy')}
          </Button>
        </div>
        <p className="text-2xs text-muted-foreground">
          {t('team.activationLink.warning', { name: link.name })}
        </p>
      </div>

      <DialogFooter>
        <Button type="button" onClick={onClose}>
          {t('team.activationLink.done')}
        </Button>
      </DialogFooter>
    </>
  );
}
