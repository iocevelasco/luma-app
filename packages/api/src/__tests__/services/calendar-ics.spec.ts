import { describe, expect, it } from 'vitest';
import { escapeText, foldLine, nextDay, renderCalendar } from '../../services/calendar-ics.js';

const event = (overrides: Partial<Parameters<typeof renderCalendar>[1][number]> = {}) => ({
  uid: 'activity-1@luma',
  summary: 'Losa · Casa Pérez',
  startDay: '2026-11-20',
  endDay: '2026-11-22',
  updatedAt: new Date('2026-11-01T10:00:00.000Z'),
  ...overrides,
});

describe('escapeText', () => {
  it('escapa barra, punto y coma, coma y saltos de línea', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });

  it('quita retornos de carro y caracteres de control', () => {
    expect(escapeText('uno\r\ndos\u0000\u0007\u001b\u007f\u0085')).toBe('uno\\ndos');
  });
});

describe('renderCalendar', () => {
  it('un título con saltos de línea no puede abrir otro evento', () => {
    const body = renderCalendar('Mis obras', [
      event({ summary: 'Losa\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Pagar a Juan' }),
    ]);
    expect(body.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
    expect(body.match(/^END:VEVENT$/gm)).toHaveLength(1);
    expect(body).toContain('SUMMARY:Losa\\nEND:VEVENT\\nBEGIN:VEVENT\\nSUMMARY:Pagar a Juan');
  });

  it('evento de día completo con DTEND exclusivo (un día después del último)', () => {
    const body = renderCalendar('Mis obras', [event()]);
    expect(body).toContain('DTSTART;VALUE=DATE:20261120\r\n');
    expect(body).toContain('DTEND;VALUE=DATE:20261123\r\n');
  });

  it('usa CRLF, UID estable y DTSTAMP de la última modificación', () => {
    const body = renderCalendar('Mis obras', [event()]);
    expect(body.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(body).not.toMatch(/[^\r]\n/);
    expect(body).toContain('UID:activity-1@luma\r\n');
    expect(body).toContain('DTSTAMP:20261101T100000Z\r\n');
  });

  it('no publica descripción ni lugar', () => {
    const body = renderCalendar('Mis obras', [event()]);
    expect(body).not.toContain('DESCRIPTION');
    expect(body).not.toContain('LOCATION');
  });

  it('el mismo contenido da el mismo archivo (para el ETag)', () => {
    expect(renderCalendar('x', [event()])).toBe(renderCalendar('x', [event()]));
  });
});

describe('foldLine', () => {
  it('pliega a 75 octetos sin cortar un carácter de varios bytes', () => {
    const line = `SUMMARY:${'ñ'.repeat(80)}`;
    const folded = foldLine(line).split('\r\n');
    for (const part of folded) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(folded.slice(1).every((part) => part.startsWith(' '))).toBe(true);
    expect(folded.map((part, i) => (i === 0 ? part : part.slice(1))).join('')).toBe(line);
  });

  it('deja como está una línea corta', () => {
    expect(foldLine('VERSION:2.0')).toBe('VERSION:2.0');
  });
});

describe('nextDay', () => {
  it('cruza fin de mes y de año', () => {
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(nextDay('2028-02-28')).toBe('2028-02-29');
  });
});
