export enum LoyaltyTier {
  STANDARD = 'STANDARD',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

export enum LoyaltyTransactionType {
  EARN = 'EARN',
  REDEEM = 'REDEEM',
  ADJUST = 'ADJUST',
  EXPIRE = 'EXPIRE',
}

export enum GuestPreferenceCategory {
  ROOM = 'ROOM',
  DINING = 'DINING',
  SERVICE = 'SERVICE',
  AMENITY = 'AMENITY',
  COMMUNICATION = 'COMMUNICATION',
  OTHER = 'OTHER',
}

export interface GuestCrmProfileDto {
  id: string;
  propertyId: string;
  guestId: string;
  vipFlag: boolean;
  notes?: string | null;
  communicationPreferences?: Record<string, any> | null;
  marketingConsent: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateGuestCrmProfileDto {
  vipFlag?: boolean;
  notes?: string;
  communicationPreferences?: Record<string, any>;
  marketingConsent?: boolean;
  tags?: string[];
}

export interface UpdateGuestCrmProfileDto {
  vipFlag?: boolean;
  notes?: string;
  communicationPreferences?: Record<string, any>;
  marketingConsent?: boolean;
  tags?: string[];
}

export interface GuestPreferenceDto {
  id: string;
  propertyId: string;
  guestId: string;
  category: GuestPreferenceCategory;
  preference: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGuestPreferenceDto {
  category: GuestPreferenceCategory;
  preference: string;
  value: string;
}

export interface UpdateGuestPreferenceDto {
  value: string;
}

export interface LoyaltyMembershipDto {
  id: string;
  propertyId: string;
  guestId: string;
  membershipNumber: string;
  tier: LoyaltyTier;
  pointsBalance: number;
  lifetimePoints: number;
  joinedDate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLoyaltyMembershipDto {
  guestId: string;
  tier?: LoyaltyTier;
  pointsBalance?: number;
}

export interface LoyaltyTransactionDto {
  id: string;
  propertyId: string;
  membershipId: string;
  type: LoyaltyTransactionType;
  points: number;
  reference?: string | null;
  referenceType?: string | null;
  description?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateLoyaltyTransactionDto {
  membershipId: string;
  type: LoyaltyTransactionType;
  points: number;
  reference?: string;
  referenceType?: string;
  description?: string;
  idempotencyKey?: string;
}

export interface AwardPointsDto {
  membershipId: string;
  points: number;
  reference?: string;
  referenceType?: string;
  description?: string;
  idempotencyKey?: string;
}

export interface RedeemPointsDto {
  membershipId: string;
  points: number;
  reference?: string;
  referenceType?: string;
  description?: string;
  idempotencyKey?: string;
}

export interface AdjustPointsDto {
  membershipId: string;
  points: number;
  description: string;
  idempotencyKey?: string;
}

export interface QueryLoyaltyTransactionsDto {
  membershipId?: string;
  type?: LoyaltyTransactionType;
  page?: number;
  limit?: number;
}

export interface GuestSearchResultDto {
  id: string;
  propertyId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  vipFlag: boolean;
  loyaltyTier?: LoyaltyTier | null;
  pointsBalance?: number | null;
  createdAt: string;
}

export interface GuestSearchDto {
  query?: string;
  vipOnly?: boolean;
  tier?: LoyaltyTier;
  page?: number;
  limit?: number;
}

export interface GuestRelationshipViewDto {
  guest: {
    id: string;
    propertyId: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    identificationType?: string | null;
    identificationNumber?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  crmProfile?: GuestCrmProfileDto | null;
  preferences: GuestPreferenceDto[];
  loyaltyMembership?: LoyaltyMembershipDto | null;
  loyaltyTransactions: LoyaltyTransactionDto[];
  reservations: {
    id: string;
    confirmationNumber: string;
    status: string;
    arrivalDate: string;
    departureDate: string;
    totalAmount: number;
    currency: string;
    createdAt: string;
  }[];
  folios: {
    id: string;
    folioNumber: string;
    status: string;
    balance: number;
    currency: string;
    createdAt: string;
  }[];
}

export interface LoyaltyTierThresholds {
  STANDARD: { min: 0; max: 999 };
  SILVER: { min: 1000; max: 4999 };
  GOLD: { min: 5000; max: 19999 };
  PLATINUM: { min: 20000; max: null };
}