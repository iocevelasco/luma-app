/**
 * Plantilla base de los mails.
 *
 * El layout es uno solo y el color de acento entra por parámetro: si cada mail
 * trae su propio bloque `<!DOCTYPE html>` copiado, la paleta deja de ser una
 * decisión y pasa a ser un accidente acumulado.
 */

/** Ancho estándar de un mail: más que esto se corta en clientes de escritorio. */
const MAX_WIDTH_PX = 600;

/**
 * Naranja de marca, versión RELLENO. Es `--primary` del sistema (ver DESIGN.md),
 * no `--brand`: acá el color va de fondo con texto blanco encima, y el naranja
 * saturado #fa520f en esa combinación da 3.34:1 — no pasa AA. Este da 5.03:1.
 *
 * En un mail no hay tema oscuro que lo corrija después: el cliente lo pinta y
 * listo.
 */
const PLATFORM_COLOR = '#cc3a05';

export interface EmailBrand {
  /** Nombre de la organización. Si falta, se usa el de la plataforma. */
  name?: string;
  logoUrl?: string;
  /** Hex de la marca. Se valida: entra en un atributo `style`. */
  primaryColor?: string;
}

export interface EmailLayoutOptions {
  /** Encabezado principal, y también el `<title>`. */
  heading: string;
  /** Cuerpo ya armado en HTML: párrafos, listas, lo que sea. */
  bodyHtml: string;
  cta?: { label: string; url: string };
  brand?: EmailBrand;
  /**
   * Sólo para comunicados COMERCIALES. Los operativos y los transaccionales no
   * llevan baja: su base legal es la ejecución del contrato, no el
   * consentimiento de marketing.
   */
  unsubscribeUrl?: string;
  /** Nombre de la plataforma, para el pie. */
  appName: string;
}

/**
 * Escapa texto que va a parar adentro del HTML.
 *
 * Hace falta de verdad: el título y el cuerpo de un comunicado los escribe un
 * admin, y el nombre de la organización sale de la base. Sin esto, un `<` en
 * "Clases de 10<12 años" rompe el markup, y algo peor rompe algo peor.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sólo colores hex. `primary_color` viene de la base y se interpola adentro de
 * un atributo `style`: un valor con comillas se escaparía del atributo. Ante la
 * duda, el color de la plataforma.
 */
function safeColor(value: string | undefined): string {
  if (!value) return PLATFORM_COLOR;
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value.trim()) ? value.trim() : PLATFORM_COLOR;
}

/** Sólo http/https, mismo criterio que los links de la rutina y del comunicado. */
function safeUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

export function renderEmailLayout(opts: EmailLayoutOptions): string {
  const { heading, bodyHtml, cta, brand, unsubscribeUrl, appName } = opts;

  const color = safeColor(brand?.primaryColor);
  const logoUrl = safeUrl(brand?.logoUrl);
  const senderName = brand?.name ? escapeHtml(brand.name) : escapeHtml(appName);
  const ctaUrl = cta ? safeUrl(cta.url) : null;
  const unsubUrl = safeUrl(unsubscribeUrl);

  const logoBlock = logoUrl
    ? `<div style="text-align: center; margin-bottom: 24px;">
         <img src="${logoUrl}" alt="${senderName}" style="max-height: 56px; max-width: 200px;">
       </div>`
    : '';

  const ctaBlock =
    cta && ctaUrl
      ? `<div style="text-align: center; margin: 30px 0;">
           <a href="${ctaUrl}" style="background-color: ${color}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
             ${escapeHtml(cta.label)}
           </a>
         </div>`
      : '';

  const unsubBlock = unsubUrl
    ? `<p style="font-size: 12px; color: #666; margin-top: 8px;">
         ¿No querés recibir más estos avisos?
         <a href="${unsubUrl}" style="color: #666;">Darte de baja</a>.
       </p>`
    : '';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(heading)} - ${senderName}</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: ${MAX_WIDTH_PX}px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      ${logoBlock}
      <h1 style="color: #1a1a1a; margin-top: 0;">${escapeHtml(heading)}</h1>
      ${bodyHtml}
      ${ctaBlock}
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #666;">Este es un correo automático, por favor no respondas a este mensaje.</p>
      ${unsubBlock}
    </div>
  </body>
</html>`;
}
