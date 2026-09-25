import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';
import {
  GoodsReceiptDto,
  GoodsReceiptItemDto,
  InventoryItemDto,
  PurchaseOrderDto,
  PurchaseOrderItemDto,
  PurchaseOrderStatus,
  StockBalanceDto,
  SupplierDto,
} from '@hms/api-contracts';
import {
  CreateGoodsReceiptDto,
  CreateInventoryItemDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  UpdateInventoryItemDto,
  UpdateSupplierDto,
} from '../dto/procurement.dto';

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // SUPPLIERS
  // ============================================================================

  async findSuppliers(propertyId: string, activeOnly?: boolean): Promise<SupplierDto[]> {
    const where: Prisma.SupplierWhereInput = {
      propertyId,
      deletedAt: null,
      ...(activeOnly !== undefined ? { active: activeOnly } : {}),
    };

    const suppliers = await this.prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return suppliers.map(this.mapSupplier);
  }

  async findSupplierById(propertyId: string, id: string): Promise<SupplierDto> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, propertyId, deletedAt: null },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier '${id}' not found for property`);
    }
    return this.mapSupplier(supplier);
  }

  async createSupplier(propertyId: string, dto: CreateSupplierDto): Promise<SupplierDto> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.supplier.findUnique({
      where: {
        uq_supplier_property_code: { propertyId, code },
      },
    });

    if (existing && !existing.deletedAt) {
      throw new ConflictException(`Supplier with code '${code}' already exists`);
    }

    const supplier = await this.prisma.supplier.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        code,
        name: dto.name.trim(),
        contact: dto.contact?.trim() || null,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        active: dto.active ?? true,
      },
    });

    return this.mapSupplier(supplier);
  }

  async updateSupplier(propertyId: string, id: string, dto: UpdateSupplierDto): Promise<SupplierDto> {
    await this.findSupplierById(propertyId, id);

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.contact !== undefined && { contact: dto.contact?.trim() || null }),
        ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });

    return this.mapSupplier(updated);
  }

  async deleteSupplier(propertyId: string, id: string): Promise<void> {
    await this.findSupplierById(propertyId, id);
    await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }

  // ============================================================================
  // INVENTORY ITEMS
  // ============================================================================

  async findItems(propertyId: string, category?: string, activeOnly?: boolean): Promise<InventoryItemDto[]> {
    const where: Prisma.InventoryItemWhereInput = {
      propertyId,
      deletedAt: null,
      ...(category ? { category: category.trim().toUpperCase() } : {}),
      ...(activeOnly !== undefined ? { active: activeOnly } : {}),
    };

    const items = await this.prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return items.map(this.mapInventoryItem);
  }

  async findItemById(propertyId: string, id: string): Promise<InventoryItemDto> {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, propertyId, deletedAt: null },
    });
    if (!item) {
      throw new NotFoundException(`Inventory item '${id}' not found for property`);
    }
    return this.mapInventoryItem(item);
  }

  async createItem(propertyId: string, dto: CreateInventoryItemDto): Promise<InventoryItemDto> {
    const sku = dto.sku.trim().toUpperCase();
    const existing = await this.prisma.inventoryItem.findUnique({
      where: {
        uq_inventory_item_property_sku: { propertyId, sku },
      },
    });

    if (existing && !existing.deletedAt) {
      throw new ConflictException(`Inventory item with SKU '${sku}' already exists`);
    }

    const itemId = generateUuidV7();

    const item = await this.prisma.$transaction(async (tx) => {
      const createdItem = await tx.inventoryItem.create({
        data: {
          id: itemId,
          propertyId,
          sku,
          name: dto.name.trim(),
          category: dto.category.trim().toUpperCase(),
          unit: dto.unit.trim().toUpperCase(),
          reorderLevel: dto.reorderLevel ?? 0,
          active: dto.active ?? true,
        },
      });

      // Initialize stock balance record
      await tx.stockBalance.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          inventoryItemId: itemId,
          onHand: 0,
          reserved: 0,
          available: 0,
          reorderLevel: dto.reorderLevel ?? 0,
          version: 0,
        },
      });

      return createdItem;
    });

    return this.mapInventoryItem(item);
  }

  async updateItem(propertyId: string, id: string, dto: UpdateInventoryItemDto): Promise<InventoryItemDto> {
    await this.findItemById(propertyId, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.category !== undefined && { category: dto.category.trim().toUpperCase() }),
          ...(dto.unit !== undefined && { unit: dto.unit.trim().toUpperCase() }),
          ...(dto.reorderLevel !== undefined && { reorderLevel: dto.reorderLevel }),
          ...(dto.active !== undefined && { active: dto.active }),
        },
      });

      if (dto.reorderLevel !== undefined) {
        await tx.stockBalance.updateMany({
          where: { propertyId, inventoryItemId: id },
          data: { reorderLevel: dto.reorderLevel },
        });
      }

      return item;
    });

    return this.mapInventoryItem(updated);
  }

  async deleteItem(propertyId: string, id: string): Promise<void> {
    await this.findItemById(propertyId, id);
    await this.prisma.inventoryItem.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }

  // ============================================================================
  // PURCHASE ORDERS
  // ============================================================================

  async findPurchaseOrders(
    propertyId: string,
    status?: PurchaseOrderStatus,
    supplierId?: string,
  ): Promise<PurchaseOrderDto[]> {
    const where: Prisma.PurchaseOrderWhereInput = {
      propertyId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(supplierId ? { supplierId } : {}),
    };

    const pos = await this.prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        items: {
          include: { inventoryItem: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pos.map(this.mapPurchaseOrder);
  }

  async findPurchaseOrderById(propertyId: string, id: string): Promise<PurchaseOrderDto> {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, propertyId, deletedAt: null },
      include: {
        supplier: true,
        items: {
          include: { inventoryItem: true },
        },
      },
    });

    if (!po) {
      throw new NotFoundException(`Purchase order '${id}' not found for property`);
    }

    return this.mapPurchaseOrder(po);
  }

  async createPurchaseOrder(
    propertyId: string,
    dto: CreatePurchaseOrderDto,
    actorId?: string,
  ): Promise<PurchaseOrderDto> {
    // 1. Validate supplier
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, propertyId, deletedAt: null, active: true },
    });
    if (!supplier) {
      throw new BadRequestException(`Supplier '${dto.supplierId}' not found or inactive for property`);
    }

    // 2. Validate PO Number uniqueness
    const poNumber = dto.poNumber.trim().toUpperCase();
    const existing = await this.prisma.purchaseOrder.findUnique({
      where: {
        uq_purchase_order_property_number: { propertyId, poNumber },
      },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException(`Purchase order with number '${poNumber}' already exists`);
    }

    // 3. Validate line items and calculate totals using Decimal
    let poTotalAmount = new Prisma.Decimal(0);
    const itemRecords: Array<{
      id: string;
      inventoryItemId: string;
      quantity: number;
      unitCost: Prisma.Decimal;
      totalCost: Prisma.Decimal;
    }> = [];

    for (const item of dto.items) {
      const invItem = await this.prisma.inventoryItem.findFirst({
        where: { id: item.inventoryItemId, propertyId, deletedAt: null },
      });
      if (!invItem) {
        throw new BadRequestException(`Inventory item '${item.inventoryItemId}' not found`);
      }

      const unitCostDecimal = new Prisma.Decimal(item.unitCost);
      const lineTotalDecimal = unitCostDecimal.mul(item.quantity);
      poTotalAmount = poTotalAmount.plus(lineTotalDecimal);

      itemRecords.push({
        id: generateUuidV7(),
        inventoryItemId: item.inventoryItemId,
        quantity: item.quantity,
        unitCost: unitCostDecimal,
        totalCost: lineTotalDecimal,
      });
    }

    const poId = generateUuidV7();
    const orderDate = dto.orderDate ? new Date(dto.orderDate) : new Date();
    const expectedDate = dto.expectedDate ? new Date(dto.expectedDate) : null;

    const po = await this.prisma.$transaction(async (tx) => {
      const createdPo = await tx.purchaseOrder.create({
        data: {
          id: poId,
          propertyId,
          supplierId: dto.supplierId,
          poNumber,
          status: 'DRAFT',
          orderDate,
          expectedDate,
          totalAmount: poTotalAmount,
          notes: dto.notes?.trim() || null,
          version: 0,
          items: {
            create: itemRecords.map((r) => ({
              id: r.id,
              inventoryItemId: r.inventoryItemId,
              quantity: r.quantity,
              unitCost: r.unitCost,
              totalCost: r.totalCost,
            })),
          },
        },
        include: {
          supplier: true,
          items: {
            include: { inventoryItem: true },
          },
        },
      });

      return createdPo;
    });

    return this.mapPurchaseOrder(po);
  }

  async updatePurchaseOrderStatus(
    propertyId: string,
    id: string,
    targetStatus: PurchaseOrderStatus,
    actorId?: string,
  ): Promise<PurchaseOrderDto> {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, propertyId, deletedAt: null },
      include: { items: true },
    });
    if (!po) {
      throw new NotFoundException(`Purchase order '${id}' not found`);
    }

    // Validate state machine transitions
    const validTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
      DRAFT: ['SUBMITTED', 'CANCELLED'],
      SUBMITTED: ['APPROVED', 'CANCELLED'],
      APPROVED: ['CANCELLED'], // transitions to PARTIALLY_RECEIVED/RECEIVED happen automatically via GoodsReceipt
      PARTIALLY_RECEIVED: ['CANCELLED'],
      RECEIVED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[po.status as PurchaseOrderStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition from '${po.status}' to '${targetStatus}'. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: targetStatus,
        version: { increment: 1 },
      },
      include: {
        supplier: true,
        items: { include: { inventoryItem: true } },
      },
    });

    return this.mapPurchaseOrder(updated);
  }

  // ============================================================================
  // GOODS RECEIPTS & STOCK BALANCE UPDATES
  // ============================================================================

  async findGoodsReceipts(propertyId: string, purchaseOrderId?: string): Promise<GoodsReceiptDto[]> {
    const where: Prisma.GoodsReceiptWhereInput = {
      propertyId,
      deletedAt: null,
      ...(purchaseOrderId ? { purchaseOrderId } : {}),
    };

    const receipts = await this.prisma.goodsReceipt.findMany({
      where,
      include: {
        purchaseOrder: { include: { supplier: true, items: true } },
        items: { include: { inventoryItem: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return receipts.map(this.mapGoodsReceipt);
  }

  async findGoodsReceiptById(propertyId: string, id: string): Promise<GoodsReceiptDto> {
    const receipt = await this.prisma.goodsReceipt.findFirst({
      where: { id, propertyId, deletedAt: null },
      include: {
        purchaseOrder: { include: { supplier: true, items: true } },
        items: { include: { inventoryItem: true } },
      },
    });

    if (!receipt) {
      throw new NotFoundException(`Goods receipt '${id}' not found`);
    }

    return this.mapGoodsReceipt(receipt);
  }

  async createGoodsReceipt(
    propertyId: string,
    dto: CreateGoodsReceiptDto,
    actorId?: string,
  ): Promise<GoodsReceiptDto> {
    const receiptNumber = dto.receiptNumber.trim().toUpperCase();
    const idempotencyKey = `procurement_receipt_${propertyId}_${receiptNumber}`;

    // 1. Idempotency Check: if receipt already exists with same key, return it without duplicate stock increment
    const existing = await this.prisma.goodsReceipt.findUnique({
      where: { idempotencyKey },
      include: {
        purchaseOrder: { include: { supplier: true, items: true } },
        items: { include: { inventoryItem: true } },
      },
    });

    if (existing) {
      this.logger.warn(`Idempotent replay detected for GoodsReceipt '${idempotencyKey}'`);
      return this.mapGoodsReceipt(existing);
    }

    // 2. Validate PO status
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: dto.purchaseOrderId, propertyId, deletedAt: null },
      include: { items: true },
    });

    if (!po) {
      throw new NotFoundException(`Purchase order '${dto.purchaseOrderId}' not found`);
    }

    if (po.status === 'DRAFT' || po.status === 'SUBMITTED') {
      throw new BadRequestException(`Cannot receive goods for purchase order in status '${po.status}'. PO must be APPROVED.`);
    }

    if (po.status === 'RECEIVED') {
      throw new BadRequestException(`Purchase order '${po.poNumber}' is already completely received.`);
    }

    if (po.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot receive goods for cancelled purchase order '${po.poNumber}'.`);
    }

    const receiptId = generateUuidV7();
    const receivedDate = dto.receivedDate ? new Date(dto.receivedDate) : new Date();

    // 3. Transactional execution: GoodsReceipt + GoodsReceiptItems + StockBalance increment + PO status update + OutboxEvent
    const receipt = await this.prisma.$transaction(async (tx) => {
      // a. Create goods receipt record
      const createdReceipt = await tx.goodsReceipt.create({
        data: {
          id: receiptId,
          propertyId,
          purchaseOrderId: dto.purchaseOrderId,
          receiptNumber,
          receivedDate,
          status: 'POSTED',
          notes: dto.notes?.trim() || null,
          idempotencyKey,
          version: 1,
          items: {
            create: dto.items.map((item) => ({
              id: generateUuidV7(),
              inventoryItemId: item.inventoryItemId,
              orderedQuantity: item.orderedQuantity,
              receivedQuantity: item.receivedQuantity,
            })),
          },
        },
        include: {
          purchaseOrder: { include: { supplier: true, items: true } },
          items: { include: { inventoryItem: true } },
        },
      });

      // b. Update stock balances for each received item
      for (const item of dto.items) {
        const existingBalance = await tx.stockBalance.findUnique({
          where: {
            uq_stock_balance_property_item: {
              propertyId,
              inventoryItemId: item.inventoryItemId,
            },
          },
        });

        if (existingBalance) {
          await tx.stockBalance.update({
            where: { id: existingBalance.id },
            data: {
              onHand: { increment: item.receivedQuantity },
              available: { increment: item.receivedQuantity },
              version: { increment: 1 },
            },
          });
        } else {
          const invItem = await tx.inventoryItem.findUnique({
            where: { id: item.inventoryItemId },
          });

          await tx.stockBalance.create({
            data: {
              id: generateUuidV7(),
              propertyId,
              inventoryItemId: item.inventoryItemId,
              onHand: item.receivedQuantity,
              reserved: 0,
              available: item.receivedQuantity,
              reorderLevel: invItem?.reorderLevel ?? 0,
              version: 1,
            },
          });
        }
      }

      // c. Evaluate cumulative fulfillment against PO
      // Fetch all receipt items for this PO (including the ones just committed in this tx)
      const allReceiptItems = await tx.goodsReceiptItem.findMany({
        where: {
          receipt: {
            purchaseOrderId: po.id,
          },
        },
      });

      const totalReceivedByItem = new Map<string, number>();
      for (const ri of allReceiptItems) {
        const cur = totalReceivedByItem.get(ri.inventoryItemId) || 0;
        totalReceivedByItem.set(ri.inventoryItemId, cur + ri.receivedQuantity);
      }

      let allFulfilled = true;
      for (const poItem of po.items) {
        const received = totalReceivedByItem.get(poItem.inventoryItemId) || 0;
        if (received < poItem.quantity) {
          allFulfilled = false;
          break;
        }
      }

      const targetPoStatus: PurchaseOrderStatus = allFulfilled ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: targetPoStatus,
          version: { increment: 1 },
        },
      });

      // d. Create OutboxEvent for receipt posting
      const event = createCloudEvent({
        type: 'procurement.receipt.posted',
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/procurement/receipts/${receiptId}`,
        subject: receiptId,
        propertyId,
        data: {
          propertyId,
          receiptId,
          receiptNumber,
          purchaseOrderId: po.id,
          poNumber: po.poNumber,
          receivedDate: receivedDate.toISOString(),
          items: dto.items,
          poStatus: targetPoStatus,
          actorId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: event.id,
          specversion: event.specversion,
          type: event.type,
          source: event.source,
          subject: event.subject,
          propertyId,
          datacontenttype: event.datacontenttype,
          time: new Date(event.time),
          data: event.data as any,
          correlationId: idempotencyKey,
          causationId: receiptId,
        },
      });

      return createdReceipt;
    });

    return this.mapGoodsReceipt(receipt);
  }

  // ============================================================================
  // STOCK BALANCES
  // ============================================================================

  async findStockBalances(propertyId: string): Promise<StockBalanceDto[]> {
    const balances = await this.prisma.stockBalance.findMany({
      where: { propertyId, deletedAt: null },
      include: { inventoryItem: true },
      orderBy: { inventoryItem: { name: 'asc' } },
    });

    return balances.map(this.mapStockBalance);
  }

  async findStockBalanceByItemId(propertyId: string, inventoryItemId: string): Promise<StockBalanceDto> {
    const balance = await this.prisma.stockBalance.findFirst({
      where: { propertyId, inventoryItemId, deletedAt: null },
      include: { inventoryItem: true },
    });

    if (!balance) {
      throw new NotFoundException(`Stock balance for item '${inventoryItemId}' not found`);
    }

    return this.mapStockBalance(balance);
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapSupplier = (s: any): SupplierDto => ({
    id: s.id,
    propertyId: s.propertyId,
    name: s.name,
    code: s.code,
    contact: s.contact,
    email: s.email,
    phone: s.phone,
    active: s.active,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  });

  private mapInventoryItem = (i: any): InventoryItemDto => ({
    id: i.id,
    propertyId: i.propertyId,
    name: i.name,
    sku: i.sku,
    category: i.category,
    unit: i.unit,
    reorderLevel: i.reorderLevel,
    active: i.active,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  });

  private mapPurchaseOrder = (p: any): PurchaseOrderDto => ({
    id: p.id,
    propertyId: p.propertyId,
    supplierId: p.supplierId,
    poNumber: p.poNumber,
    status: p.status as PurchaseOrderStatus,
    orderDate: p.orderDate instanceof Date ? p.orderDate.toISOString().slice(0, 10) : String(p.orderDate),
    expectedDate: p.expectedDate ? (p.expectedDate instanceof Date ? p.expectedDate.toISOString().slice(0, 10) : String(p.expectedDate)) : null,
    totalAmount: Number(p.totalAmount),
    notes: p.notes,
    version: p.version,
    supplier: p.supplier ? this.mapSupplier(p.supplier) : undefined,
    items: (p.items || []).map((item: any): PurchaseOrderItemDto => ({
      id: item.id,
      purchaseOrderId: item.purchaseOrderId,
      inventoryItemId: item.inventoryItemId,
      quantity: item.quantity,
      unitCost: Number(item.unitCost),
      totalCost: Number(item.totalCost),
      inventoryItem: item.inventoryItem ? this.mapInventoryItem(item.inventoryItem) : undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  });

  private mapGoodsReceipt = (gr: any): GoodsReceiptDto => ({
    id: gr.id,
    propertyId: gr.propertyId,
    purchaseOrderId: gr.purchaseOrderId,
    receiptNumber: gr.receiptNumber,
    receivedDate: gr.receivedDate instanceof Date ? gr.receivedDate.toISOString().slice(0, 10) : String(gr.receivedDate),
    status: gr.status,
    notes: gr.notes,
    idempotencyKey: gr.idempotencyKey,
    version: gr.version,
    purchaseOrder: gr.purchaseOrder ? this.mapPurchaseOrder(gr.purchaseOrder) : undefined,
    items: (gr.items || []).map((item: any): GoodsReceiptItemDto => ({
      id: item.id,
      receiptId: item.receiptId,
      inventoryItemId: item.inventoryItemId,
      orderedQuantity: item.orderedQuantity,
      receivedQuantity: item.receivedQuantity,
      inventoryItem: item.inventoryItem ? this.mapInventoryItem(item.inventoryItem) : undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    createdAt: gr.createdAt.toISOString(),
    updatedAt: gr.updatedAt.toISOString(),
  });

  private mapStockBalance = (sb: any): StockBalanceDto => ({
    id: sb.id,
    propertyId: sb.propertyId,
    inventoryItemId: sb.inventoryItemId,
    onHand: sb.onHand,
    reserved: sb.reserved,
    available: sb.available,
    reorderLevel: sb.reorderLevel,
    version: sb.version,
    inventoryItem: sb.inventoryItem ? this.mapInventoryItem(sb.inventoryItem) : undefined,
    createdAt: sb.createdAt.toISOString(),
    updatedAt: sb.updatedAt.toISOString(),
  });
}

