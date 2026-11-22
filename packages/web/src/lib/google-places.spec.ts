import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  directionsUrl,
  fetchPlaceSuggestions,
  mapEmbedUrl,
  mapsLanguage,
  newPlacesSession,
  parseSuggestions,
  resetPlacesLibrary,
} from './google-places';

afterEach(() => {
  delete window.google;
  resetPlacesLibrary();
});

describe('parseSuggestions', () => {
  it('toma el id, el texto completo y las dos líneas', () => {
    expect(
      parseSuggestions([
        {
          placePrediction: {
            placeId: 'ChIJ1',
            text: { text: 'Av. Corrientes 1234, CABA, Argentina' },
            mainText: { text: 'Av. Corrientes 1234' },
            secondaryText: { text: 'CABA, Argentina' },
          },
        },
      ]),
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
      parseSuggestions([{ placePrediction: { text: { text: 'x' } } }, { placePrediction: { placeId: 'a' } }, {}]),
    ).toEqual([]);
    expect(parseSuggestions(undefined)).toEqual([]);
  });
});

describe('fetchPlaceSuggestions', () => {
  /** Un `google.maps` de mentira, ya cargado: el script no se pide. */
  function fakeMaps() {
    const fetchAutocompleteSuggestions = vi.fn(async () => ({
      suggestions: [{ placePrediction: { placeId: 'p1', text: { text: 'Calle 1, Rosario' } } }],
    }));
    class AutocompleteSessionToken {}
    const importLibrary = vi.fn(async () => ({
      AutocompleteSessionToken,
      AutocompleteSuggestion: { fetchAutocompleteSuggestions },
    }));
    window.google = { maps: { importLibrary } } as never;
    return { fetchAutocompleteSuggestions, importLibrary, AutocompleteSessionToken };
  }

  it('pregunta con el SDK de Maps, con una sesión que se reusa entre teclas y el idioma', async () => {
    const { fetchAutocompleteSuggestions, importLibrary, AutocompleteSessionToken } = fakeMaps();
    const session = newPlacesSession();

    const found = await fetchPlaceSuggestions('key-1', 'Calle', session, 'es');
    await fetchPlaceSuggestions('key-1', 'Calle 1', session, 'es');

    expect(found).toEqual([{ placeId: 'p1', text: 'Calle 1, Rosario', main: 'Calle 1, Rosario' }]);
    expect(importLibrary).toHaveBeenCalledTimes(1);
    expect(importLibrary).toHaveBeenCalledWith('places');
    const [first, second] = fetchAutocompleteSuggestions.mock.calls as unknown as [
      [{ sessionToken: object; language: string; input: string }],
      [{ sessionToken: object }],
    ];
    expect(first[0]).toMatchObject({ input: 'Calle', language: 'es' });
    expect(first[0].sessionToken).toBeInstanceOf(AutocompleteSessionToken);
    expect(second[0].sessionToken).toBe(first[0].sessionToken);
  });

  it('una sesión nueva (tras elegir) lleva otro token', async () => {
    const { fetchAutocompleteSuggestions } = fakeMaps();
    await fetchPlaceSuggestions('k', 'abc', newPlacesSession(), 'es');
    await fetchPlaceSuggestions('k', 'abc', newPlacesSession(), 'es');
    const calls = fetchAutocompleteSuggestions.mock.calls as unknown as [[{ sessionToken: object }], [{ sessionToken: object }]];
    expect(calls[0][0].sessionToken).not.toBe(calls[1][0].sessionToken);
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

describe('mapsLanguage', () => {
  it.each([
    ['es-ES', 'es'],
    ['es-AR', 'es-419'],
    ['pt', 'pt-BR'],
  ])('%s → %s', (language, code) => expect(mapsLanguage(language)).toBe(code));
});

describe('carga del SDK', () => {
  it('espera el callback de Google: el onload del cargador llega antes que importLibrary', async () => {
    const appended: HTMLScriptElement[] = [];
    const spy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      appended.push(node as HTMLScriptElement);
      return node;
    });
    const pending = fetchPlaceSuggestions('k', 'calle', newPlacesSession(), 'es');

    // Corre el cargador: define `google.maps`, todavía sin `importLibrary`.
    const script = appended[0]!;
    expect(script.src).toContain('callback=__lumaMapsReady');
    window.google = { maps: {} } as never;
    script.onload?.(new Event('load'));

    // Llega `main.js` y Google llama al callback.
    const fetchAutocompleteSuggestions = vi.fn(async () => ({
      suggestions: [{ placePrediction: { placeId: 'p1', text: { text: 'Calle 1' } } }],
    }));
    class AutocompleteSessionToken {}
    window.google = {
      maps: { importLibrary: vi.fn(async () => ({ AutocompleteSessionToken, AutocompleteSuggestion: { fetchAutocompleteSuggestions } })) },
    } as never;
    (window as unknown as Record<string, () => void>).__lumaMapsReady!();

    await expect(pending).resolves.toEqual([{ placeId: 'p1', text: 'Calle 1', main: 'Calle 1', secondary: undefined }]);
    spy.mockRestore();
  });
});
