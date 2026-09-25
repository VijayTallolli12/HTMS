import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  OutletType,
  TableStatus,
  FnbOrderStatus,
  SettlementType,
  FnbPaymentMethod,
} from '@hms/api-contracts';

// ----------------------------------------------------------------------
// Outlet DTOs
// ----------------------------------------------------------------------
export class CreateOutletDto {
  @ApiProperty({ example: 'OUTLET-TGR', description: 'Unique outlet code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Tokyo Grandeur Restaurant', description: 'Display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: ['RESTAURANT', 'BAR', 'ROOM_SERVICE', 'CAFE'], default: 'RESTAURANT' })
  @IsOptional()
  @IsIn(['RESTAURANT', 'BAR', 'ROOM_SERVICE', 'CAFE'])
  outletType?: OutletType;
}

// ----------------------------------------------------------------------
// Menu Category DTOs
// ----------------------------------------------------------------------
export class CreateMenuCategoryDto {
  @ApiProperty({ example: 'CAT-BRK', description: 'Category code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Breakfast', description: 'Category name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ----------------------------------------------------------------------
// Menu Item DTOs
// ----------------------------------------------------------------------
export class CreateMenuItemDto {
  @ApiProperty({ description: 'Category UUID' })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({ example: 'ITEM-BRK-01', description: 'Item unique code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Grand Continental Breakfast', description: 'Item name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Item description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: '3800.00', description: 'Price in outlet currency' })
  @IsNotEmpty()
  price!: string | number;

  @ApiPropertyOptional({ example: 'JPY', default: 'JPY' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ----------------------------------------------------------------------
// Table DTOs
// ----------------------------------------------------------------------
export class CreateTableDto {
  @ApiProperty({ example: 'T01', description: 'Table label or number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  tableNumber!: string;

  @ApiPropertyOptional({ example: 4, default: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ enum: ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'] })
  @IsOptional()
  @IsIn(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'])
  status?: TableStatus;
}

export class UpdateTableStatusDto {
  @ApiProperty({ enum: ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'] })
  @IsIn(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'])
  status!: TableStatus;
}

// ----------------------------------------------------------------------
// Order DTOs
// ----------------------------------------------------------------------
export class CreateOrderDto {
  @ApiProperty({ description: 'Outlet UUID' })
  @IsString()
  @IsNotEmpty()
  outletId!: string;

  @ApiPropertyOptional({ description: 'Optional table UUID' })
  @IsOptional()
  @IsString()
  tableId?: string;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ApiPropertyOptional({ example: 'Server Kenji', description: 'Server/waiter name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serverName?: string;

  @ApiPropertyOptional({ description: 'Special dietary or table notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: '104', description: 'In-house room number for room charge' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  roomNumber?: string;

  @ApiPropertyOptional({ example: 'Daniel Craig', description: 'Guest name' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  guestName?: string;

  @ApiPropertyOptional({ description: 'Optional Reservation UUID if known' })
  @IsOptional()
  @IsString()
  reservationId?: string;
}

export class AddOrderItemDto {
  @ApiProperty({ description: 'MenuItem UUID' })
  @IsString()
  @IsNotEmpty()
  menuItemId!: string;

  @ApiProperty({ example: 1, default: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ example: 'No onions, medium rare', description: 'Line item prep notes' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: ['ORDERED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'],
    description: 'Target lifecycle status',
  })
  @IsIn(['ORDERED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'])
  status!: FnbOrderStatus;

  @ApiPropertyOptional({ description: 'Reason for status change (required for cancellation)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class CloseOrderDto {
  @ApiProperty({
    enum: ['ROOM_CHARGE', 'DIRECT_PAY'],
    description: 'Settlement channel: ROOM_CHARGE (posts to guest folio) or DIRECT_PAY (cash/card)',
    default: 'ROOM_CHARGE',
  })
  @IsIn(['ROOM_CHARGE', 'DIRECT_PAY'])
  settlementType!: SettlementType;

  @ApiPropertyOptional({
    enum: ['CASH', 'CREDIT_CARD', 'ROOM_CHARGE'],
    description: 'Payment method for DIRECT_PAY or ROOM_CHARGE',
  })
  @IsOptional()
  @IsIn(['CASH', 'CREDIT_CARD', 'ROOM_CHARGE'])
  paymentMethod?: FnbPaymentMethod;

  @ApiPropertyOptional({ example: '104', description: 'In-house room number if ROOM_CHARGE' })
  @IsOptional()
  @IsString()
  roomNumber?: string;

  @ApiPropertyOptional({ description: 'Explicit Reservation UUID if known' })
  @IsOptional()
  @IsString()
  reservationId?: string;

  @ApiPropertyOptional({ description: 'Explicit Folio UUID if known' })
  @IsOptional()
  @IsString()
  folioId?: string;
}

export class QueryFnbOrdersDto {
  @ApiPropertyOptional({ description: 'Filter by outlet UUID' })
  @IsOptional()
  @IsString()
  outletId?: string;

  @ApiPropertyOptional({ description: 'Filter by table UUID' })
  @IsOptional()
  @IsString()
  tableId?: string;

  @ApiPropertyOptional({ enum: ['OPEN', 'ORDERED', 'PREPARING', 'READY', 'SERVED', 'CLOSED', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['OPEN', 'ORDERED', 'PREPARING', 'READY', 'SERVED', 'CLOSED', 'CANCELLED'])
  status?: FnbOrderStatus;

  @ApiPropertyOptional({ description: 'Limit results (default 50)' })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Page offset (default 1)' })
  @IsOptional()
  page?: number;
}

