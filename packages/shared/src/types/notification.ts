/**
 * Avisos dentro de la app.
 *
 * La matriz pide notificaciones en ocho de sus filas: actividad iniciada,
 * avanzada y cumplida; hito en obra; eventualidad al gerente; próximo pago.
 * Todas tienen la misma forma — algo pasó en una obra y alguien se tiene que
 * enterar— así que son una entidad con un `type`, no una por caso.
 *
 * **Una notificación es una copia por persona, no un evento compartido.** Si
 * fuera un evento con una lista de "quién lo leyó", marcar leído sería editar
 * un documento que varios escriben a la vez, y el contador de no leídos
 * tendría que recalcularse recorriendo esa lista en cada request.
 */
export type NotificationType =
  /** Una actividad arrancó. */
  | 'actividad_iniciada'
  /** Alguien la reportó terminada y espera revisión. */
  | 'actividad_en_revision'
  /** El gerente la dio por cumplida. */
  | 'actividad_completada'
  /** Se publicó un hito visible para el cliente. */
  | 'hito'
  /** El supervisor reportó una eventualidad al gerente. */
  | 'eventualidad';

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'actividad_iniciada',
  'actividad_en_revision',
  'actividad_completada',
  'hito',
  'eventualidad',
] as const;

export interface AppNotification {
  id: string;
  projectId: string;
  projectName: string;
  type: NotificationType;
  /**
   * El texto ya resuelto en el idioma de quien lo recibe sería lo cómodo, pero
   * se guarda el dato crudo y la UI lo traduce: una notificación guardada en
   * español no se puede releer en portugués, y la persona puede cambiar de
   * idioma después de recibirla.
   */
  subjectName: string;
  /** A dónde lleva el aviso cuando se toca. Ruta relativa de la SPA. */
  link: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface MarkReadResponse {
  unreadCount: number;
}
