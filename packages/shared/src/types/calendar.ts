/**
 * El feed de calendario personal (ADR-005 §3): un ICS de sólo lectura con las
 * actividades, reuniones y vencimientos de cuotas de mis obras.
 */

/** Idiomas de los textos fijos del feed. Viaja en la URL: el calendario externo no tiene sesión. */
export const CALENDAR_FEED_LANGUAGES = ['es-ES', 'es-AR', 'pt'] as const;
export type CalendarFeedLanguage = (typeof CALENDAR_FEED_LANGUAGES)[number];

/** `GET /api/calendar/feed`. La URL no vuelve a salir: sólo se muestra al generarla. */
export interface CalendarFeedStatus {
  enabled: boolean;
  /** ISO 8601. */
  createdAt?: string;
}

/** `POST /api/calendar/feed`: la única vez que se ve la URL. */
export interface CalendarFeedCreated {
  url: string;
  /** ISO 8601. */
  createdAt: string;
}
