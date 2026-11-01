import { PageLayout } from '@/components/layout/page-layout';
import { ChatPromptCard } from '@/components/platform/chat-prompt-card';

/**
 * El prompt del asistente, para quien opera la plataforma. Uno solo: es el
 * texto del proyecto en NexusBot, no de una Empresa. La ruta va detrás de
 * `AdminLayout` y la API lo vuelve a exigir.
 */
export function PlatformAssistantPage() {
  return (
    <PageLayout width="narrow">
      <ChatPromptCard />
    </PageLayout>
  );
}
