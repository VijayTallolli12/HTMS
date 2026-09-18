export interface IRoomDeactivationValidator {
  canDeactivateOrDeleteRoom(
    propertyId: string,
    roomId: string,
  ): Promise<{ allowed: boolean; reason?: string }>;
}

export const ROOM_DEACTIVATION_VALIDATOR = 'ROOM_DEACTIVATION_VALIDATOR';
