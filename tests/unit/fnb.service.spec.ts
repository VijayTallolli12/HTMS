import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FnbOrderService } from '../../apps/api-core/src/modules/fnb/services/fnb-order.service';
import { FnbOutletService } from '../../apps/api-core/src/modules/fnb/services/fnb-outlet.service';
import { FnbMenuService } from '../../apps/api-core/src/modules/fnb/services/fnb-menu.service';
import {
  FnbOrderStatus,
  SecurityContext,
  TableStatus,
} from '@hms/api-contracts';

describe('F&B Restaurant Operations Service Suite', () => {
  const propertyId = '01a00000-0000-7000-0000-000000000001';
  const outletId = '01a00000-0000-7000-0000-000000000100';
  const tableId = '01a00000-0000-7000-0000-000000000200';
  const orderId = '01a00000-0000-7000-0000-000000000300';
  const menuItemId = '01a00000-0000-7000-0000-000000000400';
  const reservationId = '01a00000-0000-7000-0000-000000000500';
  const folioId = '01a00000-0000-7000-0000-000000000600';
  const actorId = '01a00000-0000-7000-0000-000000000999';

  const mockActor: SecurityContext = {
    userId: actorId,
    sessionId: 'session-1',
    correlationId: 'corr-1',
    activeContext: {
      hotelGroupId: '01a00000-0000-7000-0000-000000000000',
      propertyId,
    },
    user: {
      id: actorId,
      email: 'fnb@example.com',
      firstName: 'Restaurant',
      lastName: 'Server',
      status: 'ACTIVE',
    },
    isGlobalAdmin: false,
    roles: Object.freeze([]),
    permissions: new Set([
      'fnb.outlet.view',
      'fnb.order.view',
      'fnb.order.create',
      'fnb.order.manage',
      'fnb.order.close',
    ]),
    scopes: Object.freeze([]),
  };

  let orderService: FnbOrderService;
  let outletService: FnbOutletService;
  let menuService: FnbMenuService;
  let mockPrisma: any;
  let mockFolioService: any;

  beforeEach(() => {
    mockFolioService = {
      postCharge: jest.fn().mockResolvedValue({
        id: 'tx-12345',
        folioId,
        transactionCode: 'RESTAURANT',
        amount: '5500.00',
      }),
    };

    mockPrisma = {
      fnbOutlet: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: outletId,
          propertyId,
          code: 'OUTLET-TGR',
          name: 'Tokyo Grandeur Restaurant',
          outletType: 'RESTAURANT',
          status: 'ACTIVE',
        }),
        create: jest.fn(),
      },
      fnbMenuCategory: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: 'cat-1',
          propertyId,
          outletId,
          code: 'MAIN',
          name: 'Main Course',
          displayOrder: 1,
          isActive: true,
        }),
        create: jest.fn(),
      },
      fnbMenuItem: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue({
          id: menuItemId,
          propertyId,
          outletId,
          categoryId: 'cat-1',
          code: 'A5-WAGYU',
          name: 'A5 Miyazaki Wagyu Tenderloin',
          price: new Prisma.Decimal(5000),
          currency: 'JPY',
          isActive: true,
        }),
        create: jest.fn(),
      },
      restaurantTable: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: tableId,
          propertyId,
          outletId,
          tableNumber: 'T01',
          capacity: 4,
          status: 'AVAILABLE',
          version: 1,
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: tableId,
          propertyId,
          outletId,
          tableNumber: 'T01',
          capacity: 4,
          status: 'AVAILABLE',
          version: 1,
        }),
        update: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
      },
      fnbOrder: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      fnbOrderItem: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        delete: jest.fn(),
      },
      room: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'room-104',
          propertyId,
          roomNumber: '104',
        }),
      },
      reservation: {
        findFirst: jest.fn().mockResolvedValue({
          id: reservationId,
          propertyId,
          confirmationNumber: 'RES-104',
          status: 'CHECKED_IN',
          guest: {
            id: 'guest-1',
            firstName: 'Daniel',
            lastName: 'Craig',
          },
          assignedRoom: {
            id: 'room-104',
            roomNumber: '104',
          },
        }),
      },
      folio: {
        findFirst: jest.fn().mockResolvedValue({
          id: folioId,
          propertyId,
          reservationId,
          status: 'OPEN',
          folioNumber: 'FOL-104',
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    outletService = new FnbOutletService(mockPrisma);
    menuService = new FnbMenuService(mockPrisma);
    orderService = new FnbOrderService(mockPrisma, mockFolioService);
  });

  describe('Menu Categories', () => {
    it('creates a normalized category only for an outlet owned by the property', async () => {
      const now = new Date('2026-09-29T12:00:00.000Z');
      mockPrisma.fnbMenuCategory.findFirst.mockResolvedValueOnce(null);
      mockPrisma.fnbMenuCategory.create.mockResolvedValue({
        id: 'category-2', propertyId, outletId, code: 'BREAKFAST', name: 'Breakfast',
        displayOrder: 1, isActive: true, createdAt: now, updatedAt: now,
      });

      const category = await menuService.createCategory(propertyId, outletId, {
        code: ' breakfast ', name: ' Breakfast ', displayOrder: 1,
      });

      expect(mockPrisma.fnbOutlet.findFirst).toHaveBeenCalledWith({
        where: { id: outletId, propertyId, deletedAt: null }, select: { id: true },
      });
      expect(mockPrisma.fnbMenuCategory.findFirst).toHaveBeenCalledWith({
        where: { propertyId, outletId, code: 'BREAKFAST' },
      });
      expect(mockPrisma.fnbMenuCategory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ propertyId, outletId, code: 'BREAKFAST', name: 'Breakfast', displayOrder: 1 }),
      });
      expect(category).toMatchObject({ propertyId, outletId, code: 'BREAKFAST', name: 'Breakfast', displayOrder: 1 });
    });

    it('rejects duplicate category codes without creating another row', async () => {
      mockPrisma.fnbMenuCategory.findFirst.mockResolvedValue({ id: 'category-1', code: 'BREAKFAST' });

      await expect(menuService.createCategory(propertyId, outletId, {
        code: 'breakfast', name: 'Breakfast', displayOrder: 1,
      })).rejects.toThrow(ConflictException);
      expect(mockPrisma.fnbMenuCategory.create).not.toHaveBeenCalled();
    });

    it('rejects a category request for an outlet outside the property', async () => {
      mockPrisma.fnbOutlet.findFirst.mockResolvedValue(null);

      await expect(menuService.createCategory(propertyId, outletId, {
        code: 'BREAKFAST', name: 'Breakfast', displayOrder: 1,
      })).rejects.toThrow(NotFoundException);
      expect(mockPrisma.fnbMenuCategory.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.fnbMenuCategory.create).not.toHaveBeenCalled();
    });

    it('rejects invalid category fields before checking duplicates or writing', async () => {
      await expect(menuService.createCategory(propertyId, outletId, {
        code: 'BREAKFAST', name: '  ', displayOrder: -1,
      })).rejects.toThrow(BadRequestException);
      expect(mockPrisma.fnbMenuCategory.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.fnbMenuCategory.create).not.toHaveBeenCalled();
    });
  });

  describe('Menu Catalog Search', () => {
    it('scopes paginated menu queries to the current property and outlet without a nonexistent soft-delete field', async () => {
      await menuService.findMenuItemsPaginated(propertyId, { outletId, page: 1, limit: 20, isActive: true });

      expect(mockPrisma.fnbMenuItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { propertyId, outletId, isActive: true },
      }));
      expect(mockPrisma.fnbMenuItem.count).toHaveBeenCalledWith({ where: { propertyId, outletId, isActive: true } });
    });

  });

  describe('Table & Order Initiation', () => {
    it('should create an order and mark table as OCCUPIED', async () => {
      mockPrisma.fnbOrder.create.mockResolvedValue({
        id: orderId,
        propertyId,
        outletId,
        tableId,
        orderNumber: 'FNB-20260925-0001',
        status: 'OPEN',
        guestCount: 2,
        serverName: 'Kenji',
        subtotal: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(0),
        currency: 'JPY',
        settlementType: 'ROOM_CHARGE',
        version: 1,
        items: [],
        table: { tableNumber: 'T01' },
        outlet: { name: 'Tokyo Grandeur Restaurant' },
      });

      const order = await orderService.createOrder(
        propertyId,
        {
          outletId,
          tableId,
          guestCount: 2,
          serverName: 'Kenji',
        },
        actorId,
      );

      expect(order).toBeDefined();
      expect(order.status).toBe('OPEN');
      expect(order.orderNumber).toBe('FNB-20260925-0001');
      expect(mockPrisma.restaurantTable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: tableId },
          data: expect.objectContaining({
            status: 'OCCUPIED',
          }),
        }),
      );
    });

    it('should reject opening order if table is already OCCUPIED', async () => {
      mockPrisma.restaurantTable.findFirst.mockResolvedValue({
        id: tableId,
        propertyId,
        outletId,
        tableNumber: 'T01',
        capacity: 4,
        status: 'OCCUPIED',
      });

      await expect(
        orderService.createOrder(
          propertyId,
          {
            outletId,
            tableId,
            guestCount: 2,
          },
          actorId,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Item Addition and Pricing', () => {
    it('should add item, calculate subtotal, 10% tax, and total', async () => {
      const existingOrder = {
        id: orderId,
        propertyId,
        outletId,
        status: 'OPEN',
        currency: 'JPY',
        subtotal: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(0),
        items: [],
        table: { tableNumber: 'T01' },
        outlet: { name: 'Tokyo Grandeur Restaurant' },
      };

      mockPrisma.fnbOrder.findFirst.mockResolvedValue(existingOrder);

      mockPrisma.fnbOrder.update.mockResolvedValue({
        ...existingOrder,
        subtotal: new Prisma.Decimal(5000),
        taxAmount: new Prisma.Decimal(500),
        totalAmount: new Prisma.Decimal(5500),
        items: [
          {
            id: 'item-1',
            menuItemId,
            itemName: 'A5 Miyazaki Wagyu Tenderloin',
            quantity: 1,
            unitPrice: new Prisma.Decimal(5000),
            subtotal: new Prisma.Decimal(5000),
            taxAmount: new Prisma.Decimal(500),
            totalAmount: new Prisma.Decimal(5500),
            status: 'PENDING',
          },
        ],
      });

      const updated = await orderService.addOrderItem(
        propertyId,
        orderId,
        {
          menuItemId,
          quantity: 1,
        },
      );

      expect(updated.subtotal).toBe('5000.00');
      expect(updated.taxAmount).toBe('500.00');
      expect(updated.totalAmount).toBe('5500.00');
    });

    it('should forbid adding items to a CLOSED order', async () => {
      mockPrisma.fnbOrder.findFirst.mockResolvedValue({
        id: orderId,
        propertyId,
        outletId,
        status: 'CLOSED',
        items: [],
      });

      await expect(
        orderService.addOrderItem(
          propertyId,
          orderId,
          {
            menuItemId,
            quantity: 1,
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Order Lifecycle Transitions', () => {
    it('should transition status from OPEN to ORDERED to PREPARING to READY to SERVED', async () => {
      const order = {
        id: orderId,
        propertyId,
        outletId,
        status: 'OPEN',
        items: [{ id: 'item-1' }],
        table: { tableNumber: 'T01' },
        outlet: { name: 'Tokyo Grandeur Restaurant' },
      };

      mockPrisma.fnbOrder.findFirst.mockResolvedValue(order);
      mockPrisma.fnbOrder.update.mockResolvedValue({ ...order, status: 'ORDERED' });

      const transitioned = await orderService.updateOrderStatus(
        propertyId,
        orderId,
        { status: 'ORDERED' },
        actorId,
      );

      expect(transitioned.status).toBe('ORDERED');
    });

    it('should reject invalid transition skipping steps', async () => {
      const order = {
        id: orderId,
        propertyId,
        outletId,
        status: 'OPEN',
        items: [{ id: 'item-1' }],
      };

      mockPrisma.fnbOrder.findFirst.mockResolvedValue(order);

      await expect(
        orderService.updateOrderStatus(
          propertyId,
          orderId,
          { status: 'SERVED' },
          actorId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Order Settlement & Room Folio Posting', () => {
    it('should close order and post charge to hotel guest folio with RESTAURANT code', async () => {
      const activeOrder = {
        id: orderId,
        propertyId,
        outletId,
        tableId,
        orderNumber: 'FNB-20260925-0001',
        status: 'SERVED',
        currency: 'JPY',
        subtotal: new Prisma.Decimal(5000),
        taxAmount: new Prisma.Decimal(500),
        totalAmount: new Prisma.Decimal(5500),
        items: [
          {
            id: 'item-1',
            quantity: 1,
            unitPrice: new Prisma.Decimal(5000),
            totalAmount: new Prisma.Decimal(5500),
          },
        ],
        table: { tableNumber: 'T01' },
        outlet: { name: 'Tokyo Grandeur Restaurant' },
      };

      mockPrisma.fnbOrder.findFirst.mockResolvedValue(activeOrder);

      mockPrisma.fnbOrder.update.mockResolvedValue({
        ...activeOrder,
        status: 'CLOSED',
        settlementType: 'ROOM_CHARGE',
        paymentMethod: 'ROOM_CHARGE',
        folioId,
        folioTransactionId: 'tx-12345',
        reservationId,
        roomNumber: '104',
        guestName: 'Daniel Craig',
      });

      const closedOrder = await orderService.closeOrder(
        propertyId,
        orderId,
        {
          settlementType: 'ROOM_CHARGE',
          roomNumber: '104',
        },
        mockActor,
      );

      expect(closedOrder.status).toBe('CLOSED');
      expect(closedOrder.settlementType).toBe('ROOM_CHARGE');
      expect(mockFolioService.postCharge).toHaveBeenCalledWith(
        propertyId,
        folioId,
        expect.objectContaining({
          transactionCode: 'RESTAURANT',
          amount: '5500.00',
          taxAmount: '500.00',
        }),
        mockActor,
        `fnb_order_close_${orderId}`,
      );

      // Verify table released
      expect(mockPrisma.restaurantTable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: tableId },
          data: expect.objectContaining({
            status: 'AVAILABLE',
          }),
        }),
      );
    });

    it('should close order with DIRECT_PAY and release table without folio charge', async () => {
      const activeOrder = {
        id: orderId,
        propertyId,
        outletId,
        tableId,
        orderNumber: 'FNB-20260925-0001',
        status: 'SERVED',
        currency: 'JPY',
        subtotal: new Prisma.Decimal(3000),
        taxAmount: new Prisma.Decimal(300),
        totalAmount: new Prisma.Decimal(3300),
        items: [{ id: 'item-1' }],
        table: { tableNumber: 'T01' },
        outlet: { name: 'Tokyo Grandeur Restaurant' },
      };

      mockPrisma.fnbOrder.findFirst.mockResolvedValue(activeOrder);

      mockPrisma.fnbOrder.update.mockResolvedValue({
        ...activeOrder,
        status: 'CLOSED',
        settlementType: 'DIRECT_PAY',
        paymentMethod: 'CREDIT_CARD',
      });

      const closedOrder = await orderService.closeOrder(
        propertyId,
        orderId,
        {
          settlementType: 'DIRECT_PAY',
          paymentMethod: 'CREDIT_CARD',
        },
        mockActor,
      );

      expect(closedOrder.status).toBe('CLOSED');
      expect(mockFolioService.postCharge).not.toHaveBeenCalled();
      expect(mockPrisma.restaurantTable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: tableId },
          data: expect.objectContaining({
            status: 'AVAILABLE',
          }),
        }),
      );
    });

    it('should reject closing empty order with no items', async () => {
      const emptyOrder = {
        id: orderId,
        propertyId,
        outletId,
        status: 'OPEN',
        items: [],
      };

      mockPrisma.fnbOrder.findFirst.mockResolvedValue(emptyOrder);

      await expect(
        orderService.closeOrder(
          propertyId,
          orderId,
          { settlementType: 'DIRECT_PAY' },
          mockActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
