import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

/** Un dato para copiar y pegar en la app del banco o de Binance. */
export function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const canCopy = typeof navigator.clipboard?.writeText === 'function';

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate font-mono">{value}</span>
        {canCopy && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label={t('subscription.bolivares.copy')}
            onClick={() => {
              void navigator.clipboard.writeText(value).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        )}
      </span>
    </div>
  );
}
