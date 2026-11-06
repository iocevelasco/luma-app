import type { AccountHealthKey, MembershipBucket } from '@luma/shared';
import type { BadgeVariant } from '@/components/ui/badge';

/**
 * El tono de cada estado de la membresía y de cada señal del semáforo. Lo usan
 * el censo, el embudo y el seguimiento: el mismo estado se ve igual en las tres.
 */
export const MEMBERSHIP_TONE: Record<MembershipBucket, BadgeVariant> = {
  trial: 'info',
  paying: 'success',
  unlimited: 'neutral',
  expired: 'danger',
};

export const HEALTH_TONE: Record<AccountHealthKey, BadgeVariant> = {
  expired: 'danger',
  paymentFailed: 'danger',
  unconfirmed: 'danger',
  noProject: 'danger',
  paymentReview: 'warning',
  cold: 'warning',
  trialEnding: 'warning',
  new: 'neutral',
  ok: 'success',
};
