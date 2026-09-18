import { Injectable } from '@nestjs/common';
import { AtsCalculationResult } from '@hms/api-contracts';

export interface InventoryCounts {
  totalRooms: number;
  outOfOrderCount: number;
  outOfServiceCount: number;
  blockedCount: number;
  bookedCount: number;
  overbookingLimit: number;
}

@Injectable()
export class AtsCalculatorService {
  /**
   * Sole authoritative calculation method for Available-to-Sell (ATS).
   * MUST be used across availability quotes, calendar views, and reservation mutations.
   *
   * Capacity = total_rooms - out_of_order_count - blocked_count - (includeOOS ? out_of_service_count : 0)
   * physicalAvailable = max(0, Capacity)
   * maxSellable = physicalAvailable + overbooking_limit
   * ATS = max(0, maxSellable - booked_count)
   */
  public calculateDailyAts(
    inventory: InventoryCounts,
    includeOutOfServiceInAts: boolean = false,
  ): AtsCalculationResult {
    const oosDeduction = includeOutOfServiceInAts ? inventory.outOfServiceCount : 0;

    const rawPhysical =
      inventory.totalRooms - inventory.outOfOrderCount - oosDeduction - inventory.blockedCount;
    const physicalAvailable = Math.max(0, rawPhysical);

    const maxSellable = physicalAvailable + inventory.overbookingLimit;
    const ats = Math.max(0, maxSellable - inventory.bookedCount);

    return { ats, physicalAvailable, maxSellable };
  }
}
