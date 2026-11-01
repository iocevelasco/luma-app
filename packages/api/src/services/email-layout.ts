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
 * El verde de la marca (`--primary`, ver DESIGN.md). Con texto `#101010`
 * encima da ~10:1 y pasa AA en cualquier tamaño; con blanco no pasaría, por
 * eso el texto del botón de la plataforma es oscuro (ver `ctaTextColor`).
 *
 * En un mail no hay tema oscuro que lo corrija después: el cliente lo pinta y
 * listo.
 */
const PLATFORM_COLOR = '#00d992';
const PLATFORM_TEXT_COLOR = '#101010';

export interface EmailBrand {
  /** Nombre de la organización. Si falta, se usa el de la plataforma. */
  name?: string;
  logoUrl?: string;
  /** Hex de la marca. Se valida: entra en un atributo `style`. */
  primaryColor?: string;
}

export interface EmailLayoutOptions {
  /** Imagen destacada arriba del título (campañas). Sólo http/https. */
  heroImageUrl?: string;
  /** Encabezado principal, y también el `<title>`. */
  heading: string;
  /**
   * Una línea que los clientes de correo muestran al lado del asunto, en la
   * bandeja. No se ve al abrir el mail. Sin ella, la bandeja muestra el
   * principio del cuerpo ("Hola Ana,"), que no dice nada.
   */
  preheader?: string;
  /** Cuerpo ya armado en HTML. Los `<p>` sin estilo toman el del sistema. */
  bodyHtml: string;
  /** Datos sueltos en una caja: "Obra: Casa Pérez", "Rol: Supervisor". */
  details?: { label: string; value: string }[];
  cta?: { label: string; url: string };
  /**
   * El enlace del botón, escrito, por si el botón no abre (clientes que
   * bloquean links con estilo, o quien lee el texto plano).
   */
  showFallbackLink?: boolean;
  /** Letra chica bajo el botón: "El enlace vence en 24 horas." */
  note?: string;
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

/**
 * Colores del panel claro (DESIGN.md, "Panel claro"). Un mail se lee sobre
 * blanco casi siempre, y muchos clientes ignoran o invierten un fondo oscuro:
 * el negro del sistema queda en la franja de arriba, como el header de la app.
 */
const C = {
  canvas: '#f4f4f5',
  card: '#ffffff',
  border: '#e4e4e7',
  text: '#18181b',
  muted: '#52525b',
  subtle: '#71717a',
  field: '#f0f0f2',
  header: PLATFORM_TEXT_COLOR,
} as const;

/** Sin fuentes web: un mail no puede cargarlas de forma fiable. */
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const P_STYLE = `margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: ${C.text};`;

/** Los `<p>` sueltos del cuerpo, con el estilo del sistema (los clientes ignoran `<style>`). */
function styleParagraphs(html: string): string {
  return html.replace(/<p>/g, `<p style="${P_STYLE}">`);
}

export function renderEmailLayout(opts: EmailLayoutOptions): string {
  const { heroImageUrl, heading, preheader, bodyHtml, details, cta, showFallbackLink, note, brand, unsubscribeUrl, appName } =
    opts;

  const color = safeColor(brand?.primaryColor);
  const logoUrl = safeUrl(brand?.logoUrl);
  const senderName = brand?.name ? escapeHtml(brand.name) : escapeHtml(appName);
  const ctaUrl = cta ? safeUrl(cta.url) : null;
  const unsubUrl = safeUrl(unsubscribeUrl);
  const ctaText = color === PLATFORM_COLOR ? PLATFORM_TEXT_COLOR : '#ffffff';

  const preheaderBlock = preheader
    ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escapeHtml(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>`
    : '';

  const heroUrl = safeUrl(heroImageUrl);
  const heroBlock = heroUrl
    ? `<img src="${escapeHtml(heroUrl)}" alt="" width="536" style="display: block; width: 100%; max-width: 536px; height: auto; border-radius: 12px; margin: 0 0 24px;">`
    : '';

  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${senderName}" style="display: block; max-height: 40px; max-width: 180px; margin: 0 0 24px;">`
    : '';

  const detailsBlock =
    details && details.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${C.field}; border-radius: 12px; margin: 0 0 24px;">
           ${details
             .map(
               (row, index) => `<tr>
             <td style="padding: ${index === 0 ? '14px' : '4px'} 16px ${index === details.length - 1 ? '14px' : '4px'}; font-size: 13px; color: ${C.muted}; width: 110px; vertical-align: top;">${escapeHtml(row.label)}</td>
             <td style="padding: ${index === 0 ? '14px' : '4px'} 16px ${index === details.length - 1 ? '14px' : '4px'}; font-size: 14px; color: ${C.text}; font-weight: 600; vertical-align: top;">${escapeHtml(row.value)}</td>
           </tr>`,
             )
             .join('')}
         </table>`
      : '';

  const ctaBlock =
    cta && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0 24px;">
           <tr><td style="border-radius: 999px; background: ${color};">
             <a href="${ctaUrl}" style="display: inline-block; padding: 13px 28px; font-family: ${FONT}; font-size: 15px; font-weight: 600; color: ${ctaText}; text-decoration: none; border-radius: 999px;">${escapeHtml(cta.label)}</a>
           </td></tr>
         </table>`
      : '';

  const noteBlock = note
    ? `<p style="margin: 0 0 16px; font-size: 13px; line-height: 1.5; color: ${C.muted};">${escapeHtml(note)}</p>`
    : '';

  const fallbackBlock =
    showFallbackLink && ctaUrl
      ? `<p style="margin: 0; font-size: 12px; line-height: 1.5; color: ${C.subtle};">¿El botón no funciona? Copiá este enlace en tu navegador:<br>
           <a href="${ctaUrl}" style="color: ${C.muted}; word-break: break-all;">${escapeHtml(ctaUrl)}</a></p>`
      : '';

  const unsubBlock = unsubUrl
    ? `<br>¿No querés recibir más estos avisos? <a href="${unsubUrl}" style="color: ${C.subtle};">Darte de baja</a>.`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(heading)} - ${senderName}</title>
  </head>
  <body style="margin: 0; padding: 0; background: ${C.canvas}; font-family: ${FONT}; -webkit-text-size-adjust: 100%;">
    ${preheaderBlock}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${C.canvas};">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: ${MAX_WIDTH_PX}px;">
            <tr>
              <td style="background: ${C.header}; border-radius: 16px 16px 0 0; padding: 18px 32px; border-bottom: 3px solid ${color};">
                <span style="font-family: ${FONT}; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: #ffffff;">${senderName}</span>
              </td>
            </tr>
            <tr>
              <td style="background: ${C.card}; border: 1px solid ${C.border}; border-top: 0; border-radius: 0 0 16px 16px; padding: 32px;">
                ${logoBlock}
                ${heroBlock}
                <h1 style="margin: 0 0 20px; font-family: ${FONT}; font-size: 24px; line-height: 1.25; font-weight: 700; letter-spacing: -0.01em; color: ${C.text};">${escapeHtml(heading)}</h1>
                ${styleParagraphs(bodyHtml)}
                ${detailsBlock}
                ${ctaBlock}
                ${noteBlock}
                ${fallbackBlock}
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px 0; text-align: center; font-family: ${FONT}; font-size: 12px; line-height: 1.5; color: ${C.subtle};">
                Este correo lo envió ${escapeHtml(appName)} automáticamente. No respondas a este mensaje.${unsubBlock}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
