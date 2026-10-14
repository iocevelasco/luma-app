/**
 * Reglas de identidad del personal de obra, compartidas entre la API y la UI.
 *
 * Viven acá y no en cada lado porque tienen que dar EXACTAMENTE lo mismo: el
 * buscador del drawer sugiere a "Juan Perez" con la misma regla con la que el
 * servidor después bloquearía crear a "Juan  Pérez". Si cada lado normaliza a
 * su manera, la UI deja pasar algo que el servidor rechaza sin haberlo
 * ofrecido antes.
 */

/** Sin mayúsculas, sin tildes y con un solo espacio entre palabras. */
export function normalizePersonName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Teléfono reducido a sus dígitos. Menos de 6 dígitos no identifica a nadie
 * —un "0", un interno— y devuelve `undefined` para que no se compare.
 *
 * El `+` también se va: "+54 11 5555-5555" y "54 11 5555 5555" son el mismo
 * número escrito distinto. "011..." contra "+5411..." no se iguala, y está
 * bien: adivinar prefijos produce falsos positivos, y un falso positivo acá
 * bloquea un alta legítima.
 */
export function normalizePhone(phone: string | undefined | null): string | undefined {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 6 ? digits : undefined;
}
