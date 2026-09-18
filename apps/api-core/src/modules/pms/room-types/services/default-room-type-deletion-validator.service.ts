import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { IRoomTypeDeletionValidator } from '../contracts/room-type-deletion-validator.interface';

@Injectable()
export class DefaultRoomTypeDeletionValidator implements IRoomTypeDeletionValidator {
  constructor(private readonly prisma: PrismaService) {}

  public async canDeleteRoomType(
    propertyId: string,
    roomTypeId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // T04 constraint check only: verify 0 physical rooms exist for this room type
    const physicalRoomCount = await this.prisma.room.count({
      where: { propertyId, roomTypeId, deletedAt: null },
    });
    if (physicalRoomCount > 0) {
      return { allowed: false, reason: 'ACTIVE_ROOMS_EXIST' };
    }
    return { allowed: true };
  }
}
