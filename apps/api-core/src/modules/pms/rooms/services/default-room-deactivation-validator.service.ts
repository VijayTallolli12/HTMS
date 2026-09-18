import { Injectable } from '@nestjs/common';
import { IRoomDeactivationValidator } from '../contracts/room-deactivation-validator.interface';

@Injectable()
export class DefaultRoomDeactivationValidator implements IRoomDeactivationValidator {
  public async canDeactivateOrDeleteRoom(
    _propertyId: string,
    _roomId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // T04 baseline: permits deactivation/deletion as long as T04 constraints pass
    return { allowed: true };
  }
}
