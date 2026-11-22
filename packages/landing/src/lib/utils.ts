import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases y resuelve choques de Tailwind (el último gana). Mismo helper que el panel. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
