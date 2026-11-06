import { describe, expect, it } from 'vitest';
import type { AppNotification, NotificationListResponse, NotificationType } from '@luma/shared';
import { QueryKeys } from '@/lib/query-keys';
import { queriesToRefreshForNew } from './notification-sync';

function notification(id: string, type: NotificationType, projectId = 'p1'): AppNotification {
  return {
    id,
    projectId,
    projectName: 'Obra',
    type,
    subjectName: 'Tarea',
    link: '/x',
    readAt: null,
    createdAt: '2026-11-05T10:00:00.000Z',
  };
}

function list(...items: AppNotification[]): NotificationListResponse {
  return { notifications: items, unreadCount: items.length };
}

describe('queriesToRefreshForNew', () => {
  it('no invalida nada en la primera carga: no hay con qué comparar', () => {
    expect(queriesToRefreshForNew(undefined, list(notification('1', 'actividad_iniciada')))).toEqual([]);
  });

  it('no invalida si no apareció nada nuevo', () => {
    const same = list(notification('1', 'actividad_iniciada'));
    expect(queriesToRefreshForNew(same, same)).toEqual([]);
  });

  it('una actividad nueva refresca Actividades de esa obra', () => {
    const previous = list(notification('1', 'hito'));
    const next = list(notification('2', 'actividad_en_revision', 'p9'), notification('1', 'hito'));
    expect(queriesToRefreshForNew(previous, next)).toEqual([[QueryKeys.activities, 'p9']]);
  });

  it('un hito o una eventualidad refrescan Hitos', () => {
    const next = list(notification('2', 'hito'), notification('3', 'eventualidad'));
    expect(queriesToRefreshForNew(list(), next)).toEqual([[QueryKeys.milestones, 'p1']]);
  });

  it('junta por obra y por query: dos avisos iguales son una invalidación', () => {
    const next = list(
      notification('2', 'actividad_iniciada'),
      notification('3', 'actividad_completada'),
      notification('4', 'actividad_iniciada', 'p2'),
    );
    expect(queriesToRefreshForNew(list(), next)).toEqual([
      [QueryKeys.activities, 'p1'],
      [QueryKeys.activities, 'p2'],
    ]);
  });
});
