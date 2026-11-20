import { describe, expect, it } from 'vitest';
import { feedLanguage, googleCalendarUrl, webcalUrl } from './calendar-feed-card';

const URL_HTTPS = 'https://luma.example/api/public/calendar/abc.ics?lang=es-ES';

describe('enlaces del feed', () => {
  it('webcal:// para la app de calendario del sistema', () => {
    expect(webcalUrl(URL_HTTPS)).toBe('webcal://luma.example/api/public/calendar/abc.ics?lang=es-ES');
  });

  it('Google Calendar recibe la URL webcal escapada en cid', () => {
    const google = new URL(googleCalendarUrl(URL_HTTPS));
    expect(google.host).toBe('calendar.google.com');
    expect(google.searchParams.get('cid')).toBe(webcalUrl(URL_HTTPS));
  });
});

describe('feedLanguage', () => {
  it.each([
    ['es-ES', 'es-ES'],
    ['es-AR', 'es-AR'],
    ['pt', 'pt'],
    [undefined, 'es-ES'],
  ])('%s → %s', (language, expected) => expect(feedLanguage(language)).toBe(expected));
});
