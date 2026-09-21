import { ReservationDto } from './reservation.contract';
import { RoomStatusDto } from './room-operations.contract';

export enum FolioStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  CITY_LEDGER = 'CITY_LEDGER',
}

export enum PaymentStatus {
  COMPLETED = 'COMPLETED',
  VOIDED = 'VOIDED',
}

export interface CreateFolioDto {
  reservationId: string;
  folioNumber?: string;
}

export interface PostChargeDto {
  transactionCode: string;
  description: string;
  amount: string; // Decimal as string: total financial effect
  taxAmount?: string; // Decimal as string: informational tax component
  reasonCode?: string; // Mandatory for credits (negative amounts)
}

export interface RecordPaymentDto {
  amount: string; // Decimal as string: must be > 0
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  // NOTE: Currency is server-derived from Folio.currency; client cannot override
}

export interface FolioDto {
  id: string;
  propertyId: string;
  reservationId: string;
  guestId: string;
  folioNumber: string;
  status: FolioStatus;
  currency: string;
  balance: string; // Decimal as string
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  closedAt: string | null;
  closedBy: string | null;
}

export interface FolioTransactionDto {
  id: string;
  propertyId: string;
  folioId: string;
  transactionCode: string;
  description: string;
  amount: string; // Decimal as string
  taxAmount: string; // Decimal as string
  reasonCode: string | null;
  postedAt: string;
  postedBy: string;
}

export interface PaymentDto {
  id: string;
  propertyId: string;
  folioId: string;
  amount: string; // Decimal as string
  currency: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  status: PaymentStatus;
  processedAt: string;
  processedBy: string;
}

export interface FolioDetailDto extends FolioDto {
  transactions: FolioTransactionDto[];
  payments: PaymentDto[];
}

export interface CheckoutSummaryItemDto {
  folioId: string;
  folioNumber: string;
  finalBalance: string;
  totalCharges: string;
  totalPayments: string;
}

export interface CheckoutResponseDto {
  reservation: ReservationDto;
  room: RoomStatusDto;
  checkOutAt: string;
  checkedOutBy: string;
  foliosSummary: CheckoutSummaryItemDto[];
}
