export interface IRoomTypeDeletionValidator {
  canDeleteRoomType(
    propertyId: string,
    roomTypeId: string,
  ): Promise<{ allowed: boolean; reason?: string }>;
}

export const ROOM_TYPE_DELETION_VALIDATOR = 'ROOM_TYPE_DELETION_VALIDATOR';
