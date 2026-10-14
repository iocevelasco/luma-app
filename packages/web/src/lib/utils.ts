import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge sólo reconoce como sombra las tallas t-shirt (`shadow-lg`).
// Un `shadow-cta` lo toma por un COLOR de sombra: no lo saca cuando llega un
// `shadow-none`, y sí lo saca cuando llega un `shadow-black/30`. Las sombras
// de index.css se declaran acá para que compitan como lo que son.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      shadow: [{ shadow: ['surface', 'overlay', 'cta', 'cta-pressed', 'raised'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
