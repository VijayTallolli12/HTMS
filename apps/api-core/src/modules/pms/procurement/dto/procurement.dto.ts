import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PurchaseOrderStatus } from '@hms/api-contracts';

// ==========================================
// SUPPLIERS
// ==========================================
export class CreateSupplierDto {
  @ApiProperty({ example: 'Global Linen Supply Co.', description: 'Supplier company name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'SUP-LINEN-01', description: 'Unique supplier code within property' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiPropertyOptional({ example: 'Jane Doe', description: 'Contact person' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact?: string;

  @ApiPropertyOptional({ example: 'orders@globallinen.com', description: 'Contact email' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ example: '+1-555-0199', description: 'Contact phone' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ default: true, description: 'Is supplier active' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateSupplierDto {
  @ApiPropertyOptional({ description: 'Supplier name' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Contact person' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ description: 'Is supplier active' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ==========================================
// INVENTORY ITEMS
// ==========================================
export class CreateInventoryItemDto {
  @ApiProperty({ example: 'Bath Towel 70x140cm', description: 'Item name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'HK-TWL-001', description: 'Unique SKU / code within property' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  sku!: string;

  @ApiProperty({ example: 'HOUSEKEEPING', description: 'Category (e.g. HOUSEKEEPING, FNB, AMENITIES, MAINTENANCE)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  category!: string;

  @ApiProperty({ example: 'PIECE', description: 'Unit of measure (e.g. PIECE, BOX, KG, LITER)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit!: string;

  @ApiPropertyOptional({ example: 20, default: 0, description: 'Threshold to trigger reordering' })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional({ default: true, description: 'Is item active' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateInventoryItemDto {
  @ApiPropertyOptional({ description: 'Item name' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Category' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiPropertyOptional({ description: 'Unit of measure' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: 'Reorder level' })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ==========================================
// PURCHASE ORDERS
// ==========================================
export class CreatePurchaseOrderItemDto {
  @ApiProperty({ description: 'Inventory Item ID' })
  @IsUUID()
  @IsNotEmpty()
  inventoryItemId!: string;

  @ApiProperty({ example: 50, description: 'Quantity ordered' })
  @IsInt()
  @IsPositive()
  quantity!: number;

  @ApiProperty({ example: 12.50, description: 'Cost per unit' })
  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'Supplier ID' })
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @ApiProperty({ example: 'PO-2026-0001', description: 'Unique PO Number within property' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  poNumber!: string;

  @ApiPropertyOptional({ example: '2026-10-02', description: 'Order date (ISO format, defaults to today)' })
  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @ApiPropertyOptional({ example: '2026-10-10', description: 'Expected delivery date' })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiPropertyOptional({ description: 'Order notes or terms' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreatePurchaseOrderItemDto], description: 'Order line items' })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  @ArrayMinSize(1)
  items!: CreatePurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderStatusDto {
  @ApiProperty({ enum: ['SUBMITTED', 'APPROVED', 'CANCELLED'], description: 'Target lifecycle status' })
  @IsIn(['SUBMITTED', 'APPROVED', 'CANCELLED'])
  status!: PurchaseOrderStatus;
}

// ==========================================
// GOODS RECEIPTS
// ==========================================
export class CreateGoodsReceiptItemDto {
  @ApiProperty({ description: 'Inventory Item ID' })
  @IsUUID()
  @IsNotEmpty()
  inventoryItemId!: string;

  @ApiProperty({ example: 50, description: 'Ordered quantity' })
  @IsInt()
  @Min(0)
  orderedQuantity!: number;

  @ApiProperty({ example: 50, description: 'Actually received quantity' })
  @IsInt()
  @Min(1)
  receivedQuantity!: number;
}

export class CreateGoodsReceiptDto {
  @ApiProperty({ description: 'Purchase Order ID' })
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderId!: string;

  @ApiProperty({ example: 'GR-2026-0001', description: 'Unique receipt number within property' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  receiptNumber!: string;

  @ApiPropertyOptional({ example: '2026-10-05', description: 'Received date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @ApiPropertyOptional({ description: 'Receipt notes or delivery remarks' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateGoodsReceiptItemDto], description: 'Receipt line items' })
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptItemDto)
  @ArrayMinSize(1)
  items!: CreateGoodsReceiptItemDto[];
}

