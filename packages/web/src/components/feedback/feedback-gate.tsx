import { useState } from 'react';
import { FeedbackDialog } from '@/components/feedback/feedback-dialog';
import { useDismissFeedback, useFeedbackStatus } from '@/hooks/feedback/use-feedback-queries';
import { useAuth } from '@/providers/auth-provider';

/**
 * Abre la encuesta sola cuando la API dice que toca (14 días de uso, luego cada
 * 90). Cerrarla sin responder se registra: no vuelve a molestar hasta el
 * próximo ciclo. No se muestra encima de los Términos pendientes.
 */
export function FeedbackGate() {
  const { user } = useAuth();
  const { data } = useFeedbackStatus();
  const dismiss = useDismissFeedback();
  const [closed, setClosed] = useState(false);

  const open = data?.due === true && !closed && user?.terms_pending !== true;

  return (
    <FeedbackDialog
      open={open}
      onOpenChange={(next) => !next && setClosed(true)}
      onDismiss={() => dismiss.mutate()}
    />
  );
}
