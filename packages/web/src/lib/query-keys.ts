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
  organizationMembers = 'organization-members',
  activities = 'activities',
  materials = 'materials',
  laborRecords = 'labor-records',
  budget = 'budget',
  providers = 'providers',
  activityProviders = 'activity-providers',
  providerActivities = 'provider-activities',
  providerEngagements = 'provider-engagements',
  crewMembers = 'crew-members',
  crewGoals = 'crew-goals',
  activityCrew = 'activity-crew',
}
