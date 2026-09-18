export interface RoomFeatures {
  connecting?: boolean;
  accessible?: boolean;
  smoking?: boolean;
  view?: string;
  [key: string]: any;
}

export interface RoomDto {
  id: string;
  propertyId: string;
  buildingId: string;
  floorId: string;
  roomTypeId: string;
  roomNumber: string;
  name: string | null;
  features: RoomFeatures | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateRoomRequest {
  buildingId: string;
  floorId: string;
  roomTypeId: string;
  roomNumber: string;
  name?: string;
  features?: RoomFeatures;
}

export interface UpdateRoomRequest {
  roomNumber?: string;
  roomTypeId?: string;
  name?: string;
  features?: RoomFeatures;
  isActive?: boolean;
}
