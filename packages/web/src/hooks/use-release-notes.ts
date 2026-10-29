import { useCallback, useMemo, useState } from 'react';
import {
  RELEASE_NOTES,
  RELEASE_NOTES_SHOWN,
  unseenReleaseNotes,
  type ReleaseNote,
} from '@/lib/release-notes';
import { loadLastSeen, saveLastSeen, type LastSeen } from '@/lib/release-notes-storage';
import { useAuth } from '@/providers/auth-provider';

const NOT_SIGNED_IN: LastSeen = { available: false, id: null };

/**
 * Las novedades y cuáles no vio todavía esta persona.
 *
 * No hay request: es un archivo del bundle, así que no hay estado de carga, ni
 * error de red, ni 401 que atender.
 */
export function useReleaseNotes() {
  const { user } = useAuth();
  const userId = user?.id;
  // Se vuelve a leer del storage cada vez que se marca como vista.
  const [savedAt, setSavedAt] = useState(0);

  const lastSeen = useMemo(
    () => (userId ? loadLastSeen(userId) : NOT_SIGNED_IN),
    // `savedAt` no se lee: es lo que fuerza la relectura después de guardar.
    [userId, savedAt],
  );

  const notes: readonly ReleaseNote[] = useMemo(() => RELEASE_NOTES.slice(0, RELEASE_NOTES_SHOWN), []);
  const unseen = useMemo(
    () => (lastSeen.available ? unseenReleaseNotes(notes, lastSeen.id) : []),
    [lastSeen, notes],
  );

  const markSeen = useCallback(() => {
    const newest = notes[0];
    if (!userId || !newest) return;
    saveLastSeen(userId, newest.id);
    setSavedAt((value) => value + 1);
  }, [notes, userId]);

  return { notes, unseen, hasUnseen: unseen.length > 0, markSeen };
}
