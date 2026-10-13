/**
 * Marca de Luma: un sol que asoma sobre la línea del terreno, más el
 * wordmark en Instrument Serif. "Luma" es luz; el horizonte es la obra.
 *
 * El semicírculo usa `brand` (tinta, no relleno con texto encima) y la línea
 * hereda `currentColor`, así la marca funciona sobre cualquier superficie.
 */
export function LogoMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M3 17a9 9 0 0 1 18 0z" fill="var(--color-brand)" />
      <rect x="1" y="19" width="22" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-foreground ${className}`}>
      <LogoMark />
      <span className="font-serif text-2xl leading-none tracking-tight">Luma</span>
    </span>
  );
}
