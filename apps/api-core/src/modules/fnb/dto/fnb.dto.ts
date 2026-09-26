import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
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
  MenuItemAvailability,
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

// ----------------------------------------------------------------------
// Menu Item Variant DTOs
// ----------------------------------------------------------------------
export class CreateMenuItemVariantDto {
  @ApiProperty({ description: 'Menu Item UUID' })
  @IsString()
  @IsNotEmpty()
  menuItemId!: string;

  @ApiProperty({ example: 'VAR-SM', description: 'Variant unique code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Small', description: 'Variant name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '3000.00', description: 'Variant price' })
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

export class UpdateMenuItemVariantDto {
  @ApiPropertyOptional({ description: 'Variant name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Variant price' })
  @IsOptional()
  price?: string | number;

  @ApiPropertyOptional({ example: 'JPY', description: 'Currency' })
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
// Modifier Group DTOs
// ----------------------------------------------------------------------
export class CreateModifierGroupDto {
  @ApiProperty({ description: 'Menu Item UUID' })
  @IsString()
  @IsNotEmpty()
  menuItemId!: string;

  @ApiProperty({ example: 'Doneness', description: 'Modifier group name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ enum: ['SINGLE', 'MULTIPLE'], default: 'MULTIPLE' })
  @IsOptional()
  @IsIn(['SINGLE', 'MULTIPLE'])
  selectionType?: 'SINGLE' | 'MULTIPLE';

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minSelections?: number;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxSelections?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateModifierGroupDto {
  @ApiPropertyOptional({ description: 'Modifier group name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: ['SINGLE', 'MULTIPLE'], description: 'Selection type' })
  @IsOptional()
  @IsIn(['SINGLE', 'MULTIPLE'])
  selectionType?: 'SINGLE' | 'MULTIPLE';

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minSelections?: number;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxSelections?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ----------------------------------------------------------------------
// Modifier DTOs
// ----------------------------------------------------------------------
export class CreateModifierDto {
  @ApiProperty({ description: 'Modifier Group UUID' })
  @IsString()
  @IsNotEmpty()
  modifierGroupId!: string;

  @ApiProperty({ example: 'Medium Rare', description: 'Modifier name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: '0.00', default: '0.00' })
  @IsOptional()
  priceAdjustment?: string | number;

  @ApiPropertyOptional({ example: 'JPY', default: 'JPY' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateModifierDto {
  @ApiPropertyOptional({ description: 'Modifier name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Price adjustment' })
  @IsOptional()
  priceAdjustment?: string | number;

  @ApiPropertyOptional({ example: 'JPY', description: 'Currency' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ----------------------------------------------------------------------
// Menu Item Update DTOs
// ----------------------------------------------------------------------
export class UpdateMenuItemDto {
  @ApiPropertyOptional({ description: 'Item name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Item description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Base price' })
  @IsOptional()
  price?: string | number;

  @ApiPropertyOptional({ example: 'JPY', description: 'Currency' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: ['AVAILABLE', 'UNAVAILABLE'], description: 'Availability status' })
  @IsOptional()
  @IsIn(['AVAILABLE', 'UNAVAILABLE'])
  availability?: MenuItemAvailability;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMenuItemAvailabilityDto {
  @ApiProperty({ enum: ['AVAILABLE', 'UNAVAILABLE'], description: 'Availability status' })
  @IsIn(['AVAILABLE', 'UNAVAILABLE'])
  availability!: MenuItemAvailability;
}

export class UpdateMenuItemPriceDto {
  @ApiProperty({ description: 'New base price' })
  price!: string | number;
}

export class QueryMenuItemsDto {
  @ApiPropertyOptional({ description: 'Filter by outlet UUID' })
  @IsOptional()
  @IsString()
  outletId?: string;

  @ApiPropertyOptional({ description: 'Filter by category UUID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ['AVAILABLE', 'UNAVAILABLE'], description: 'Filter by availability' })
  @IsOptional()
  @IsIn(['AVAILABLE', 'UNAVAILABLE'])
  availability?: MenuItemAvailability;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Search by name or code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number (default 1)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page (default 20)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

