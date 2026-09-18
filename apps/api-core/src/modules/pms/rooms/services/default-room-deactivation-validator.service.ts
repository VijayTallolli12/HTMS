import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { IRoomDeactivationValidator } from '../contracts/room-deactivation-validator.interface';

@Injectable()
export class DefaultRoomDeactivationValidator implements IRoomDeactivationValidator {
  constructor(private readonly prisma?: PrismaService) {}

  public async canDeactivateOrDeleteRoom(
    propertyId: string,
    roomId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.prisma) {
      return { allowed: true };
    }

    const activeBlock = await this.prisma.roomMaintenanceBlock.findFirst({
      where: {
        propertyId,
        roomId,
        status: 'ACTIVE',
        deletedAt: null,
        endDate: { gt: new Date() },
      },
    });

    if (activeBlock) {
      return {
        allowed: false,
        reason: `Room has active or scheduled maintenance block (${activeBlock.type} from ${activeBlock.startDate.toISOString().slice(0, 10)} to ${activeBlock.endDate.toISOString().slice(0, 10)})`,
      };
    }

    return { allowed: true };
  }
}
