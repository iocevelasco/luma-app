import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { DocumentFileManager } from '@/components/documents/document-file-manager';
import { CATEGORY_ORDER } from '@/components/documents/document-tree';
import { ErrorBoundary } from '@/components/error-boundary';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { useProjectDocuments } from '@/hooks/documents/use-document-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';

/**
 * La documentación de la obra como un explorador de archivos: una carpeta por
 * tipo de documento y, dentro de planos y renders, una por espacio. Qué se
 * puede hacer y cómo se arma el árbol vive en `DocumentFileManager`.
 */
export function ProjectDocumentsPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading, isError } = useProjectDocuments(projectId);
  const { can } = useProjectCapabilities(projectId);

  // El resumen de la obra enlaza acá con `?category=render|plano`: se abre
  // directo en esa carpeta en vez de en la raíz.
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('category');
  const initialCategory = CATEGORY_ORDER.find((category) => category === requested);

  const documents = useMemo(() => data?.documents ?? [], [data]);
  const uploadsEnabled = data?.uploadsEnabled !== false;

  if (isError) return <PageLayout isError />;
  if (isLoading || !data) return <PageLayout isLoading />;

  return (
    <PageLayout width="full" fill>
      {!uploadsEnabled && (
        <p className="text-sm text-muted-foreground">{t('document.uploadsDisabled')}</p>
      )}
      <ErrorBoundary
        resetKey={projectId}
        label="documentos"
        fallback={(reset) => (
          <div className="flex flex-1 flex-col items-start justify-center gap-3 p-6">
            <p className="text-sm">{t('document.fm.crashed')}</p>
            <Button type="button" variant="outline" onClick={reset}>
              {t('routeError.retry')}
            </Button>
          </div>
        )}
      >
        <DocumentFileManager
          projectId={projectId!}
          documents={documents}
          canWrite={can('document.write')}
          uploadsEnabled={uploadsEnabled}
          initialCategory={initialCategory}
          className="flex-1"
        />
      </ErrorBoundary>
    </PageLayout>
  );
}

export default ProjectDocumentsPage;
