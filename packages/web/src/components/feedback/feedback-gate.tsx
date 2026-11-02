import { useEffect, useState } from 'react';
import { FEEDBACK_SESSION_DELAY_MINUTES } from '@luma/shared';
import { FeedbackDialog } from '@/components/feedback/feedback-dialog';
import { useDismissFeedback, useFeedbackStatus } from '@/hooks/feedback/use-feedback-queries';
import { useAuth } from '@/providers/auth-provider';

const SESSION_START_KEY = 'luma.feedback.sessionStart';
const DELAY_MS = FEEDBACK_SESSION_DELAY_MINUTES * 60_000;

/**
 * Cuándo arrancó la sesión de esta pestaña. Vive en `sessionStorage` para que
 * recargar no reinicie la cuenta; si el storage no está disponible (modo
 * privado), la cuenta arranca al montar y recargar la reinicia, sin más daño.
 */
function readSessionStart(): number {
  const now = Date.now();
  try {
    const saved = Number(window.sessionStorage.getItem(SESSION_START_KEY));
    if (saved > 0 && saved <= now) return saved;
    window.sessionStorage.setItem(SESSION_START_KEY, String(now));
  } catch {
    /* sin storage: arranca ahora */
  }
  return now;
}

function clearSessionStart() {
  try {
    window.sessionStorage.removeItem(SESSION_START_KEY);
  } catch {
    /* nada que limpiar */
  }
}

/**
 * Abre la encuesta sola cuando la API dice que toca (14 días de uso la primera
 * vez; 7 si la cerró sin responder; 90 si respondió) y la persona lleva 5
 * minutos con la sesión abierta: no se le cruza apenas entra. Cerrarla sin
 * responder se registra. No se muestra encima de los Términos pendientes.
 */
export function FeedbackGate() {
  const { user } = useAuth();
  const { data } = useFeedbackStatus();
  const dismiss = useDismissFeedback();
  const [closed, setClosed] = useState(false);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const remaining = readSessionStart() + DELAY_MS - Date.now();
    if (remaining <= 0) {
      setWaited(true);
      return;
    }
    const timer = window.setTimeout(() => setWaited(true), remaining);
    return () => window.clearTimeout(timer);
  }, []);

  // Al cerrar sesión el layout se desmonta: la próxima sesión cuenta desde cero.
  useEffect(() => clearSessionStart, []);

  const open = waited && data?.due === true && !closed && user?.terms_pending !== true;

  return (
    <FeedbackDialog
      open={open}
      onOpenChange={(next) => !next && setClosed(true)}
      onDismiss={() => dismiss.mutate()}
    />
  );
}
