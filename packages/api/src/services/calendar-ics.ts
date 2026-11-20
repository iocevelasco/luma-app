/**
 * Un calendario iCalendar (RFC 5545) de eventos de día completo. Puro: sin
 * base de datos, para poder probar el formato línea por línea.
 *
 * Lo que más importa acá es que el texto de una persona no pueda romper el
 * archivo de otra: un título de actividad con un salto de línea no puede abrir
 * un `END:VEVENT` y meter un evento en el calendario de quien se suscribió.
 * Por eso todo texto pasa por `escapeText` (sin CR, sin caracteres de control,
 * con `\` `;` `,` y saltos escapados) y toda línea por `foldLine`.
 */

export interface CalendarEvent {
  /** Estable por entidad y generado por el servidor: el calendario externo actualiza por él. */
  uid: string;
  summary: string;
  /** `YYYY-MM-DD`, inclusive. */
  startDay: string;
  /** `YYYY-MM-DD`, inclusive. En el archivo va como `DTEND` exclusivo (un día después). */
  endDay: string;
  /** Última modificación de la entidad: es el `DTSTAMP`, y deja el archivo estable entre pedidos. */
  updatedAt: Date;
}

const CRLF = '\r\n';
const MAX_LINE_OCTETS = 75;

/**
 * Texto de un valor `TEXT` según RFC 5545 §3.3.11. Los saltos de línea se
 * escriben como `\n` literal; los demás caracteres de control se quitan.
 */
export function escapeText(value: string): string {
  return (
    value
      .replace(/\r\n?/g, '\n')
      // Controles C0 (salvo el salto, que se escapa abajo), DEL y C1.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
      .trim()
  );
}

/**
 * Pliega una línea a 75 octetos (RFC 5545 §3.1): las siguientes empiezan con un
 * espacio. Cuenta bytes UTF-8 y nunca corta un carácter por la mitad.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) return line;

  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;
  // La primera línea tiene 75 octetos; las demás, 74 más el espacio inicial.
  let limit = MAX_LINE_OCTETS;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
      limit = MAX_LINE_OCTETS - 1;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

function dayValue(day: string): string {
  return day.replaceAll('-', '');
}

/** El día siguiente, para el `DTEND` exclusivo. En UTC: un día suelto no tiene zona. */
export function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Sólo lo que el servidor genera: letras, números y unos pocos signos. */
function safeUid(uid: string): string {
  return uid.replace(/[^A-Za-z0-9@._-]/g, '');
}

export function renderCalendar(name: string, events: CalendarEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Luma//Calendario de obras//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    // Una sugerencia para el cliente: Google la ignora y refresca cada varias horas.
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${safeUid(event.uid)}`,
      `DTSTAMP:${utcStamp(event.updatedAt)}`,
      `DTSTART;VALUE=DATE:${dayValue(event.startDay)}`,
      `DTEND;VALUE=DATE:${dayValue(nextDay(event.endDay))}`,
      `SUMMARY:${escapeText(event.summary)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}
