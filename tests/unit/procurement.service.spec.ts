import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProcurementService } from '../../apps/api-core/src/modules/pms/procurement/services/procurement.service';
import {
  CreateGoodsReceiptDto,
  CreateInventoryItemDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
} from '../../apps/api-core/src/modules/pms/procurement/dto/procurement.dto';

describe('Procurement & Inventory Service Suite', () => {
  const propertyId = '01a00000-0000-7000-0000-000000000001';
  const supplierId = '01a00000-0000-7000-0000-000000000100';
  const itemId = '01a00000-0000-7000-0000-000000000200';
  const poId = '01a00000-0000-7000-0000-000000000300';
  const receiptId = '01a00000-0000-7000-0000-000000000400';
  const stockBalanceId = '01a00000-0000-7000-0000-000000000500';

  let service: ProcurementService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      supplier: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryItem: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      purchaseOrder: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      goodsReceipt: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      goodsReceiptItem: {
        findMany: jest.fn(),
      },
      stockBalance: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
    };

    service = new ProcurementService(mockPrisma);
  });

  // ============================================================================
  // SUPPLIER TESTS
  // ============================================================================
  describe('Supplier Management', () => {
    it('should list active suppliers for a property', async () => {
      mockPrisma.supplier.findMany.mockResolvedValue([
        {
          id: supplierId,
          propertyId,
          name: 'Tokyo Food Wholesale',
          code: 'SUP-TFW',
          contact: 'Kenji Sato',
          email: 'sato@tfw.example.com',
          phone: '+81-3-5555-0100',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.findSuppliers(propertyId, true);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Tokyo Food Wholesale');
      expect(mockPrisma.supplier.findMany).toHaveBeenCalledWith({
        where: { propertyId, deletedAt: null, active: true },
        orderBy: { name: 'asc' },
      });
    });

    it('should throw ConflictException if supplier code already exists', async () => {
      mockPrisma.supplier.findUnique.mockResolvedValue({
        id: 'existing-id',
        code: 'SUP-TFW',
        deletedAt: null,
      });

      const dto: CreateSupplierDto = {
        name: 'Duplicate Supplier',
        code: 'SUP-TFW',
      };

      await expect(service.createSupplier(propertyId, dto)).rejects.toThrow(ConflictException);
    });

    it('should create supplier when code is unique', async () => {
      mockPrisma.supplier.findUnique.mockResolvedValue(null);
      mockPrisma.supplier.create.mockImplementation((args: any) => ({
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const dto: CreateSupplierDto = {
        name: 'New Supplier',
        code: 'SUP-NEW',
        contact: 'Alice',
      };

      const result = await service.createSupplier(propertyId, dto);
      expect(result.code).toBe('SUP-NEW');
      expect(result.name).toBe('New Supplier');
      expect(mockPrisma.supplier.create).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // INVENTORY ITEM TESTS
  // ============================================================================
  describe('Inventory Item Management', () => {
    it('should create item and initialize StockBalance within transaction', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null);
      mockPrisma.inventoryItem.create.mockImplementation((args: any) => ({
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      mockPrisma.stockBalance.create.mockResolvedValue({});

      const dto: CreateInventoryItemDto = {
        name: 'Matcha Tea 500g',
        sku: 'FNB-TEA-001',
        category: 'FNB',
        unit: 'BOX',
        reorderLevel: 10,
      };

      const result = await service.createItem(propertyId, dto);
      expect(result.sku).toBe('FNB-TEA-001');
      expect(mockPrisma.stockBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            propertyId,
            onHand: 0,
            available: 0,
            reorderLevel: 10,
          }),
        }),
      );
    });

    it('should throw ConflictException when item SKU already exists', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue({
        id: 'existing-id',
        sku: 'FNB-TEA-001',
        deletedAt: null,
      });

      const dto: CreateInventoryItemDto = {
        name: 'Duplicate Item',
        sku: 'FNB-TEA-001',
        category: 'FNB',
        unit: 'BOX',
      };

      await expect(service.createItem(propertyId, dto)).rejects.toThrow(ConflictException);
    });
  });

  // ============================================================================
  // PURCHASE ORDER TESTS
  // ============================================================================
  describe('Purchase Order Lifecycle', () => {
    it('should create PO in DRAFT status and accurately calculate totals using Decimal', async () => {
      mockPrisma.supplier.findFirst.mockResolvedValue({
        id: supplierId,
        propertyId,
        active: true,
        deletedAt: null,
      });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      mockPrisma.inventoryItem.findFirst.mockResolvedValue({
        id: itemId,
        propertyId,
        name: 'Matcha Tea',
        deletedAt: null,
      });

      mockPrisma.purchaseOrder.create.mockImplementation((args: any) => ({
        ...args.data,
        supplier: { id: supplierId, name: 'Supplier', code: 'SUP-1', createdAt: new Date(), updatedAt: new Date() },
        items: args.data.items.create.map((it: any) => ({
          ...it,
          inventoryItem: { id: it.inventoryItemId, name: 'Matcha Tea', sku: 'TEA-1', category: 'FNB', unit: 'BOX', reorderLevel: 5, active: true, createdAt: new Date(), updatedAt: new Date() },
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const dto: CreatePurchaseOrderDto = {
        supplierId,
        poNumber: 'PO-2026-0001',
        orderDate: '2026-10-02',
        items: [
          { inventoryItemId: itemId, quantity: 10, unitCost: 15.50 },
        ],
      };

      const result = await service.createPurchaseOrder(propertyId, dto);
      expect(result.status).toBe('DRAFT');
      expect(result.totalAmount).toBe(155.00);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].totalCost).toBe(155.00);
    });

    it('should allow valid status transitions: DRAFT -> SUBMITTED and SUBMITTED -> APPROVED', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: poId,
        propertyId,
        status: 'DRAFT',
        deletedAt: null,
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: poId,
        propertyId,
        status: 'SUBMITTED',
        orderDate: new Date(),
        totalAmount: new Prisma.Decimal(100),
        version: 1,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const submitted = await service.updatePurchaseOrderStatus(propertyId, poId, 'SUBMITTED');
      expect(submitted.status).toBe('SUBMITTED');

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: poId,
        propertyId,
        status: 'SUBMITTED',
        deletedAt: null,
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({
        id: poId,
        propertyId,
        status: 'APPROVED',
        orderDate: new Date(),
        totalAmount: new Prisma.Decimal(100),
        version: 2,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const approved = await service.updatePurchaseOrderStatus(propertyId, poId, 'APPROVED');
      expect(approved.status).toBe('APPROVED');
    });

    it('should disallow invalid status transitions (e.g. DRAFT directly to APPROVED)', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: poId,
        propertyId,
        status: 'DRAFT',
        deletedAt: null,
      });

      await expect(
        service.updatePurchaseOrderStatus(propertyId, poId, 'APPROVED'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================================
  // GOODS RECEIPT & IDEMPOTENCY TESTS
  // ============================================================================
  describe('Goods Receipt & Stock Idempotency', () => {
    it('should return existing receipt without mutating stock if idempotency key matches', async () => {
      const existingReceipt = {
        id: receiptId,
        propertyId,
        purchaseOrderId: poId,
        receiptNumber: 'GR-2026-0001',
        receivedDate: new Date(),
        status: 'POSTED',
        notes: 'Already processed',
        idempotencyKey: `procurement_receipt_${propertyId}_GR-2026-0001`,
        version: 1,
        items: [
          {
            id: 'item-receipt-1',
            receiptId,
            inventoryItemId: itemId,
            orderedQuantity: 10,
            receivedQuantity: 10,
            inventoryItem: { id: itemId, name: 'Item', sku: 'SKU-1', category: 'CAT', unit: 'EA', reorderLevel: 0, active: true, createdAt: new Date(), updatedAt: new Date() },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.goodsReceipt.findUnique.mockResolvedValue(existingReceipt);

      const dto: CreateGoodsReceiptDto = {
        purchaseOrderId: poId,
        receiptNumber: 'GR-2026-0001',
        items: [{ inventoryItemId: itemId, orderedQuantity: 10, receivedQuantity: 10 }],
      };

      const result = await service.createGoodsReceipt(propertyId, dto);

      expect(result.receiptNumber).toBe('GR-2026-0001');
      expect(result.idempotencyKey).toBe(`procurement_receipt_${propertyId}_GR-2026-0001`);
      // Crucial: stockBalance.update / create should NEVER be called on replay!
      expect(mockPrisma.stockBalance.update).not.toHaveBeenCalled();
      expect(mockPrisma.stockBalance.create).not.toHaveBeenCalled();
    });

    it('should reject goods receipt if purchase order is still DRAFT', async () => {
      mockPrisma.goodsReceipt.findUnique.mockResolvedValue(null);
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: poId,
        propertyId,
        poNumber: 'PO-DRAFT',
        status: 'DRAFT',
        deletedAt: null,
      });

      const dto: CreateGoodsReceiptDto = {
        purchaseOrderId: poId,
        receiptNumber: 'GR-DRAFT-FAIL',
        items: [{ inventoryItemId: itemId, orderedQuantity: 10, receivedQuantity: 10 }],
      };

      await expect(service.createGoodsReceipt(propertyId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should transactionally create receipt, increment stock balance, update PO to RECEIVED, and emit outbox event', async () => {
      mockPrisma.goodsReceipt.findUnique.mockResolvedValue(null);
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: poId,
        propertyId,
        poNumber: 'PO-2026-0001',
        status: 'APPROVED',
        deletedAt: null,
        items: [{ inventoryItemId: itemId, quantity: 10 }],
      });

      mockPrisma.goodsReceipt.create.mockResolvedValue({
        id: receiptId,
        propertyId,
        purchaseOrderId: poId,
        receiptNumber: 'GR-2026-0002',
        receivedDate: new Date(),
        status: 'POSTED',
        idempotencyKey: `procurement_receipt_${propertyId}_GR-2026-0002`,
        version: 1,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.stockBalance.findUnique.mockResolvedValue({
        id: stockBalanceId,
        propertyId,
        inventoryItemId: itemId,
        onHand: 5,
        available: 5,
      });
      mockPrisma.stockBalance.update.mockResolvedValue({});

      // Simulate that total received is 10
      mockPrisma.goodsReceiptItem.findMany.mockResolvedValue([
        { inventoryItemId: itemId, receivedQuantity: 10 },
      ]);
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockPrisma.outboxEvent.create.mockResolvedValue({});

      const dto: CreateGoodsReceiptDto = {
        purchaseOrderId: poId,
        receiptNumber: 'GR-2026-0002',
        items: [{ inventoryItemId: itemId, orderedQuantity: 10, receivedQuantity: 10 }],
      };

      const result = await service.createGoodsReceipt(propertyId, dto);

      expect(result.receiptNumber).toBe('GR-2026-0002');
      // Stock balance incremented
      expect(mockPrisma.stockBalance.update).toHaveBeenCalledWith({
        where: { id: stockBalanceId },
        data: {
          onHand: { increment: 10 },
          available: { increment: 10 },
          version: { increment: 1 },
        },
      });
      // PO status updated to RECEIVED
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: poId },
        data: {
          status: 'RECEIVED',
          version: { increment: 1 },
        },
      });
      // OutboxEvent created
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'procurement.receipt.posted',
            correlationId: `procurement_receipt_${propertyId}_GR-2026-0002`,
          }),
        }),
      );
    });

    it('should set PO status to PARTIALLY_RECEIVED when receivedQuantity is less than ordered', async () => {
      mockPrisma.goodsReceipt.findUnique.mockResolvedValue(null);
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: poId,
        propertyId,
        poNumber: 'PO-2026-0001',
        status: 'APPROVED',
        deletedAt: null,
        items: [{ inventoryItemId: itemId, quantity: 20 }],
      });

      mockPrisma.goodsReceipt.create.mockResolvedValue({
        id: receiptId,
        propertyId,
        purchaseOrderId: poId,
        receiptNumber: 'GR-PARTIAL',
        receivedDate: new Date(),
        status: 'POSTED',
        idempotencyKey: `procurement_receipt_${propertyId}_GR-PARTIAL`,
        version: 1,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.stockBalance.findUnique.mockResolvedValue(null);
      mockPrisma.inventoryItem.findUnique.mockResolvedValue({ id: itemId, reorderLevel: 5 });
      mockPrisma.stockBalance.create.mockResolvedValue({});

      // Received only 8 of 20
      mockPrisma.goodsReceiptItem.findMany.mockResolvedValue([
        { inventoryItemId: itemId, receivedQuantity: 8 },
      ]);
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      mockPrisma.outboxEvent.create.mockResolvedValue({});

      const dto: CreateGoodsReceiptDto = {
        purchaseOrderId: poId,
        receiptNumber: 'GR-PARTIAL',
        items: [{ inventoryItemId: itemId, orderedQuantity: 20, receivedQuantity: 8 }],
      };

      await service.createGoodsReceipt(propertyId, dto);

      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: poId },
        data: {
          status: 'PARTIALLY_RECEIVED',
          version: { increment: 1 },
        },
      });
    });
  });

  // ============================================================================
  // STOCK BALANCE QUERY TESTS
  // ============================================================================
  describe('Stock Balance Queries', () => {
    it('should return all stock balances with item details', async () => {
      mockPrisma.stockBalance.findMany.mockResolvedValue([
        {
          id: stockBalanceId,
          propertyId,
          inventoryItemId: itemId,
          onHand: 42,
          reserved: 2,
          available: 40,
          reorderLevel: 10,
          version: 3,
          inventoryItem: {
            id: itemId,
            name: 'Bed Sheets King',
            sku: 'HK-SHT-001',
            category: 'HOUSEKEEPING',
            unit: 'PIECE',
            reorderLevel: 10,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.findStockBalances(propertyId);
      expect(result).toHaveLength(1);
      expect(result[0].onHand).toBe(42);
      expect(result[0].available).toBe(40);
      expect(result[0].inventoryItem?.name).toBe('Bed Sheets King');
    });
  });
});

