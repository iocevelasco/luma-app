import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/common/empty-state';

/**
 * Home del panel, vacía a propósito.
 *
 * La base no tiene producto: el chrome de navegación está armado y la sesión
 * funciona, pero acá no hay nada que mostrar hasta que se defina el dominio.
 * Es el lugar donde va la primera pantalla real.
 */
export function AdminHomePage() {
  const { t } = useTranslation();

  return (
    <EmptyState
      variant="list"
      title={t('layout.emptyHomeTitle')}
      description={t('layout.emptyHomeBody')}
    />
  );
}

export default AdminHomePage;
