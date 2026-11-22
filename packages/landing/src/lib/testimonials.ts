/**
 * Testimonios reales. Cada entrada necesita una cita de la persona, su nombre,
 * cargo y empresa, y permiso escrito para publicarlos.
 *
 * Sin entradas, la sección no se renderiza y la banda que le toca se corre
 * sola (ver `App.tsx`). No agregar citas de ejemplo: una cita inventada es
 * publicidad engañosa.
 */
export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
  photo?: string;
}

export const TESTIMONIALS: Testimonial[] = [];
