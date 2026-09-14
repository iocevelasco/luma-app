/**
 * Claves de TanStack Query, centralizadas.
 *
 * Una clave escrita a mano en un hook es una invalidación que un día no va a
 * encontrar su caché. Toda query nueva agrega su clave acá.
 */
export enum QueryKeys {
  currentUser = 'current-user',
  emailVerification = 'email-verification',
  projects = 'projects',
  project = 'project',
  organization = 'organization',
  activities = 'activities',
  materials = 'materials',
}
