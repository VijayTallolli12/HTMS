export interface BedConfigurationItem {
  type: string; // e.g., 'KING', 'QUEEN', 'TWIN', 'SOFA_BED'
  count: number;
}

export interface RoomTypeDto {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  description: string | null;
  roomClass: string;
  baseOccupancy: number;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  bedConfiguration: BedConfigurationItem[];
  amenities: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateRoomTypeRequest {
  code: string;
  name: string;
  description?: string;
  roomClass: string;
  baseOccupancy: number;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  bedConfiguration: BedConfigurationItem[];
  amenities?: string[];
}

export interface UpdateRoomTypeRequest {
  name?: string;
  description?: string;
  roomClass?: string;
  baseOccupancy?: number;
  maxOccupancy?: number;
  maxAdults?: number;
  maxChildren?: number;
  bedConfiguration?: BedConfigurationItem[];
  amenities?: string[];
  isActive?: boolean;
}
