import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'>;

/**
 * Input de contraseña con el ojo para verla u ocultarla. El botón queda fuera
 * del orden de tab del campo sólo visualmente: es un botón real, con
 * `aria-pressed` y una etiqueta que cambia según el estado.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...props }, ref) {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const label = visible ? t('common.hidePassword') : t('common.showPassword');

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
          {...props}
        />
        <button
          type="button"
          aria-label={label}
          aria-pressed={visible}
          title={label}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    );
  },
);
