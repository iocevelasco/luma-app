import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Composición de clases: clsx para condicionales, twMerge para el conflicto. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('es-AR', options ?? { day: '2-digit', month: 'short' }).format(date);
}

export function relativeDays(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const days = Math.round((date.getTime() - Date.now()) / 86400000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days === -1) return 'ayer';
  return days > 0 ? `en ${days} días` : `hace ${Math.abs(days)} días`;
}
