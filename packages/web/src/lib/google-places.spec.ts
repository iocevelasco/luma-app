import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  directionsUrl,
  fetchPlaceSuggestions,
  mapEmbedUrl,
  mapsLanguage,
  newSessionToken,
  parseSuggestions,
  PlacesError,
} from './google-places';

afterEach(() => vi.unstubAllGlobals());

describe('parseSuggestions', () => {
  it('toma el id, el texto completo y las dos líneas', () => {
    expect(
      parseSuggestions({
        suggestions: [
          {
            placePrediction: {
              placeId: 'ChIJ1',
              text: { text: 'Av. Corrientes 1234, CABA, Argentina' },
              structuredFormat: {
                mainText: { text: 'Av. Corrientes 1234' },
                secondaryText: { text: 'CABA, Argentina' },
              },
            },
          },
        ],
      }),
    ).toEqual([
      {
        placeId: 'ChIJ1',
        text: 'Av. Corrientes 1234, CABA, Argentina',
        main: 'Av. Corrientes 1234',
        secondary: 'CABA, Argentina',
      },
    ]);
  });

  it('descarta las sugerencias sin id o sin texto, y las que no son lugares', () => {
    expect(
      parseSuggestions({
        suggestions: [{ placePrediction: { text: { text: 'x' } } }, { placePrediction: { placeId: 'a' } }, {}],
      }),
    ).toEqual([]);
    expect(parseSuggestions({})).toEqual([]);
  });
});

describe('fetchPlaceSuggestions', () => {
  it('pregunta a Places (New) con la clave en la cabecera, la sesión y el idioma', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ suggestions: [] })));
    vi.stubGlobal('fetch', fetchMock);

    await fetchPlaceSuggestions('key-1', 'Corrientes', 'session-1', 'es');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    expect((init.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('key-1');
    expect(JSON.parse(init.body as string)).toEqual({
      input: 'Corrientes',
      sessionToken: 'session-1',
      languageCode: 'es',
    });
  });

  it('una respuesta con error es un PlacesError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })));
    await expect(fetchPlaceSuggestions('k', 'abc', 's', 'es')).rejects.toBeInstanceOf(PlacesError);
  });
});

describe('enlaces', () => {
  it('el mapa embebido apunta al lugar, con todo escapado', () => {
    const url = new URL(mapEmbedUrl('k&y', 'ChIJ_1-a', 'es'));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/embed/v1/place');
    expect(url.searchParams.get('key')).toBe('k&y');
    expect(url.searchParams.get('q')).toBe('place_id:ChIJ_1-a');
  });

  it('"Cómo llegar" usa la dirección y, si hay, el lugar exacto', () => {
    const withPlace = new URL(directionsUrl('Calle 1 & 2, #3', 'ChIJ1'));
    expect(withPlace.host).toBe('www.google.com');
    expect(withPlace.searchParams.get('destination')).toBe('Calle 1 & 2, #3');
    expect(withPlace.searchParams.get('destination_place_id')).toBe('ChIJ1');
    expect(new URL(directionsUrl('Calle 1')).searchParams.has('destination_place_id')).toBe(false);
  });
});

describe('newSessionToken', () => {
  it('es un UUID v4, también sin crypto.randomUUID (Safari < 15.4)', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(newSessionToken()).toMatch(uuid);
    const original = window.crypto;
    const getRandomValues = original.getRandomValues.bind(original);
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: { getRandomValues },
    });
    try {
      expect(newSessionToken()).toMatch(uuid);
    } finally {
      Object.defineProperty(window, 'crypto', { configurable: true, value: original });
    }
  });
});

describe('mapsLanguage', () => {
  it.each([
    ['es-ES', 'es'],
    ['es-AR', 'es-419'],
    ['pt', 'pt-BR'],
  ])('%s → %s', (language, code) => expect(mapsLanguage(language)).toBe(code));
});
