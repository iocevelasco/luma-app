import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PageLayout } from '@/components/layout/page-layout';
import { DocumentFileManager } from '@/components/documents/document-file-manager';
import { CATEGORY_ORDER } from '@/components/documents/document-tree';
import { useProjectDocuments } from '@/hooks/documents/use-document-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';

/**
 * La documentación de la obra como un explorador de archivos: una carpeta por
 * tipo de documento y, dentro de planos y renders, una por espacio. Qué se
 * puede hacer y cómo se arma el árbol vive en `DocumentFileManager`.
 */
export function ProjectDocumentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading, isError } = useProjectDocuments(projectId);
  const { can } = useProjectCapabilities(projectId);

  // El resumen de la obra enlaza acá con `?category=render|plano`: se abre
  // directo en esa carpeta en vez de en la raíz.
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('category');
  const initialCategory = CATEGORY_ORDER.find((category) => category === requested);

  const documents = useMemo(() => data?.documents ?? [], [data]);

  if (isError) return <PageLayout isError />;
  if (isLoading || !data) return <PageLayout isLoading />;

  return (
    <PageLayout width="full" fill>
      <DocumentFileManager
        projectId={projectId!}
        documents={documents}
        canWrite={can('document.write')}
        initialCategory={initialCategory}
        className="flex-1"
      />
    </PageLayout>
  );
}

export default ProjectDocumentsPage;
