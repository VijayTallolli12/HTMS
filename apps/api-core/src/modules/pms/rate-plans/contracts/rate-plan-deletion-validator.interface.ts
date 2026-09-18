export interface IRatePlanDeletionValidator {
  canDeleteRatePlan(
    propertyId: string,
    ratePlanId: string,
  ): Promise<{ allowed: boolean; reason?: string }>;
}

export const RATE_PLAN_DELETION_VALIDATOR = 'RATE_PLAN_DELETION_VALIDATOR';
