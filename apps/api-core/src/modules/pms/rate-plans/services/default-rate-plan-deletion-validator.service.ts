import { Injectable } from '@nestjs/common';
import { IRatePlanDeletionValidator } from '../contracts/rate-plan-deletion-validator.interface';

@Injectable()
export class DefaultRatePlanDeletionValidator implements IRatePlanDeletionValidator {
  public async canDeleteRatePlan(
    _propertyId: string,
    _ratePlanId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // T04 baseline: permits deletion as long as T04 constraints pass
    return { allowed: true };
  }
}
