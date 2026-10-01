import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { FolioService } from '../../pms/finance/services/folio.service';
import { generateUuidV7 } from '@hms/shared';
import { Prisma } from '@prisma/client';
import {
  FnbOrderDto,
  FnbOrderItemDto,
  FnbOrderStatus,
  SecurityContext,
} from '@hms/api-contracts';
import {
  CreateOrderDto,
  AddOrderItemDto,
  UpdateOrderStatusDto,
  CloseOrderDto,
  QueryFnbOrdersDto,
} from '../dto/fnb.dto';

const TAX_RATE = 0.10; // 10% standard F&B consumption tax

@Injectable()
export class FnbOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly folioService: FolioService,
  ) {}

  async createOrder(
    propertyId: string,
    dto: CreateOrderDto,
    userId: string,
  ): Promise<FnbOrderDto> {
    const outlet = await this.prisma.fnbOutlet.findFirst({
      where: { id: dto.outletId, propertyId, deletedAt: null },
    });
    if (!outlet) {
      throw new NotFoundException(`Outlet '${dto.outletId}' not found for property`);
    }

    const property = await this.prisma.property.findFirst({
      where: { id: propertyId },
      select: { currency: true },
    });
    if (!property) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }
    const orderCurrency = property.currency;

    let tableNumber: string | null = null;
    let tableToOccupyId: string | null = null;

    if (dto.tableId) {
      const table = await this.prisma.restaurantTable.findFirst({
        where: { id: dto.tableId, outletId: dto.outletId, propertyId },
      });
      if (!table) {
        throw new NotFoundException(`Table '${dto.tableId}' not found in outlet`);
      }

      if (table.status === 'OCCUPIED' || table.activeOrderId) {
        if (table.activeOrderId) {
          const activeOrder = await this.prisma.fnbOrder.findUnique({
            where: { id: table.activeOrderId },
          });
          if (
            activeOrder &&
            ['OPEN', 'ORDERED', 'PREPARING', 'READY', 'SERVED'].includes(activeOrder.status)
          ) {
            throw new ConflictException(
              `Table ${table.tableNumber} is already occupied by active order ${activeOrder.orderNumber}`,
            );
          }
        }
        if (table.status === 'OCCUPIED') {
          throw new ConflictException(`Table ${table.tableNumber} is already occupied`);
        }
      }

      if (table.status === 'OUT_OF_SERVICE') {
        throw new ConflictException(`Table ${table.tableNumber} is currently out of service`);
      }

      tableNumber = table.tableNumber;
      tableToOccupyId = table.id;
    }

    const orderSeq = Math.floor(1000 + Math.random() * 9000);
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const orderNumber = `ORD-${datePrefix}-${orderSeq}`;

    // Execute order creation and table occupancy in a transaction
    const createdOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.fnbOrder.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          outletId: dto.outletId,
          tableId: tableToOccupyId,
          orderNumber,
          status: 'OPEN',
          guestCount: dto.guestCount || 1,
          serverName: dto.serverName?.trim(),
          notes: dto.notes?.trim(),
          roomNumber: dto.roomNumber?.trim(),
          guestName: dto.guestName?.trim(),
          reservationId: dto.reservationId,
          subtotal: new Prisma.Decimal('0.00'),
          taxAmount: new Prisma.Decimal('0.00'),
          totalAmount: new Prisma.Decimal('0.00'),
          currency: orderCurrency,
          settlementType: 'ROOM_CHARGE',
        },
        include: {
          outlet: true,
          table: true,
          items: true,
        },
      });

      if (tableToOccupyId) {
        await tx.restaurantTable.update({
          where: { id: tableToOccupyId },
          data: {
            status: 'OCCUPIED',
            activeOrderId: order.id,
            version: { increment: 1 },
          },
        });
      }

      return order;
    });

    return this.mapToDto(createdOrder);
  }

  async addOrderItem(
    propertyId: string,
    orderId: string,
    dto: AddOrderItemDto,
  ): Promise<FnbOrderDto> {
    const order = await this.prisma.fnbOrder.findFirst({
      where: { id: orderId, propertyId },
      include: { outlet: true, table: true, items: true },
    });
    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    if (!['OPEN', 'ORDERED'].includes(order.status)) {
      throw new BadRequestException(
        `Cannot add items to order with status '${order.status}'. Order must be OPEN or ORDERED.`,
      );
    }

    const menuItem = await this.prisma.fnbMenuItem.findFirst({
      where: { id: dto.menuItemId, outletId: order.outletId, isActive: true },
    });
    if (!menuItem) {
      throw new NotFoundException(`Active menu item '${dto.menuItemId}' not found in outlet`);
    }

    const quantity = dto.quantity || 1;
    const unitPrice = menuItem.price;
    const subtotal = unitPrice.mul(quantity);
    const taxAmount = subtotal.mul(TAX_RATE);
    const totalAmount = subtotal.add(taxAmount);

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.fnbOrderItem.create({
        data: {
          id: generateUuidV7(),
          orderId: order.id,
          menuItemId: menuItem.id,
          itemName: menuItem.name,
          quantity,
          unitPrice,
          subtotal,
          taxAmount,
          totalAmount,
          notes: dto.notes?.trim(),
          status: 'ORDERED',
        },
      });

      const allItems = await tx.fnbOrderItem.findMany({
        where: { orderId: order.id, status: { not: 'CANCELLED' } },
      });

      let newSubtotal = new Prisma.Decimal('0.00');
      let newTax = new Prisma.Decimal('0.00');
      let newTotal = new Prisma.Decimal('0.00');

      for (const item of allItems) {
        newSubtotal = newSubtotal.add(item.subtotal);
        newTax = newTax.add(item.taxAmount);
        newTotal = newTotal.add(item.totalAmount);
      }

      return tx.fnbOrder.update({
        where: { id: order.id },
        data: {
          subtotal: newSubtotal,
          taxAmount: newTax,
          totalAmount: newTotal,
          version: { increment: 1 },
        },
        include: {
          outlet: true,
          table: true,
          items: true,
        },
      });
    });

    return this.mapToDto(updatedOrder);
  }

  async removeOrderItem(
    propertyId: string,
    orderId: string,
    itemId: string,
  ): Promise<FnbOrderDto> {
    const order = await this.prisma.fnbOrder.findFirst({
      where: { id: orderId, propertyId },
    });
    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    if (order.status !== 'OPEN') {
      throw new BadRequestException(`Items can only be removed while order is in OPEN status`);
    }

    const item = await this.prisma.fnbOrderItem.findFirst({
      where: { id: itemId, orderId },
    });
    if (!item) {
      throw new NotFoundException(`Order item '${itemId}' not found`);
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.fnbOrderItem.delete({
        where: { id: itemId },
      });

      const remainingItems = await tx.fnbOrderItem.findMany({
        where: { orderId },
      });

      let newSubtotal = new Prisma.Decimal('0.00');
      let newTax = new Prisma.Decimal('0.00');
      let newTotal = new Prisma.Decimal('0.00');

      for (const it of remainingItems) {
        newSubtotal = newSubtotal.add(it.subtotal);
        newTax = newTax.add(it.taxAmount);
        newTotal = newTotal.add(it.totalAmount);
      }

      return tx.fnbOrder.update({
        where: { id: orderId },
        data: {
          subtotal: newSubtotal,
          taxAmount: newTax,
          totalAmount: newTotal,
          version: { increment: 1 },
        },
        include: {
          outlet: true,
          table: true,
          items: true,
        },
      });
    });

    return this.mapToDto(updatedOrder);
  }

  async submitOrder(propertyId: string, orderId: string): Promise<FnbOrderDto> {
    const order = await this.prisma.fnbOrder.findFirst({
      where: { id: orderId, propertyId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    if (order.status !== 'OPEN') {
      throw new BadRequestException(`Order is already submitted (current status: ${order.status})`);
    }

    if (order.items.length === 0) {
      throw new BadRequestException(`Cannot submit an order with no items`);
    }

    const updated = await this.prisma.fnbOrder.update({
      where: { id: orderId },
      data: {
        status: 'ORDERED',
        version: { increment: 1 },
      },
      include: {
        outlet: true,
        table: true,
        items: true,
      },
    });

    return this.mapToDto(updated);
  }

  async updateOrderStatus(
    propertyId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
    userId: string,
  ): Promise<FnbOrderDto> {
    const order = await this.prisma.fnbOrder.findFirst({
      where: { id: orderId, propertyId },
      include: { table: true },
    });
    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    const currentStatus = order.status;
    const targetStatus = dto.status;

    const validTransitions: Record<string, string[]> = {
      OPEN: ['ORDERED', 'CANCELLED'],
      ORDERED: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY', 'CANCELLED'],
      READY: ['SERVED'],
      SERVED: ['CLOSED'],
      CLOSED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed: [${allowed.join(', ')}]`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const ord = await tx.fnbOrder.update({
        where: { id: orderId },
        data: {
          status: targetStatus,
          version: { increment: 1 },
        },
        include: {
          outlet: true,
          table: true,
          items: true,
        },
      });

      if (targetStatus === 'CANCELLED' && ord.tableId) {
        await tx.restaurantTable.update({
          where: { id: ord.tableId },
          data: {
            status: 'AVAILABLE',
            activeOrderId: null,
            version: { increment: 1 },
          },
        });
      }

      return ord;
    });

    return this.mapToDto(updated);
  }

  async closeOrder(
    propertyId: string,
    orderId: string,
    dto: CloseOrderDto,
    actor: SecurityContext,
  ): Promise<FnbOrderDto> {
    const order = await this.prisma.fnbOrder.findFirst({
      where: { id: orderId, propertyId },
      include: { outlet: true, table: true, items: true },
    });
    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    if (order.status === 'CLOSED') {
      throw new ConflictException(`Order '${order.orderNumber}' is already closed`);
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot close a cancelled order`);
    }

    if (!order.items || order.items.length === 0) {
      throw new BadRequestException('Cannot close an order with no items');
    }

    let resolvedFolioId: string | null = null;
    let resolvedReservationId: string | null = null;
    let resolvedTransactionId: string | null = null;
    let resolvedRoomNumber: string | null = dto.roomNumber || order.roomNumber || null;
    let resolvedGuestName: string | null = order.guestName || null;

    if (dto.settlementType === 'ROOM_CHARGE') {
      let targetReservation: any = null;

      if (dto.folioId) {
        const folio = await this.prisma.folio.findFirst({
          where: { id: dto.folioId, propertyId, status: 'OPEN' },
        });
        if (!folio) {
          throw new NotFoundException(`Open Folio '${dto.folioId}' not found`);
        }
        resolvedFolioId = folio.id;
        targetReservation = await this.prisma.reservation.findFirst({
          where: { id: folio.reservationId, propertyId },
          include: { guest: true, assignedRoom: true },
        });
      } else if (dto.roomNumber) {
        // Find checked-in reservation by room number
        const room = await this.prisma.room.findFirst({
          where: { propertyId, roomNumber: dto.roomNumber.trim() },
        });
        if (!room) {
          throw new NotFoundException(`Room '${dto.roomNumber}' not found in property`);
        }

        targetReservation = await this.prisma.reservation.findFirst({
          where: {
            propertyId,
            assignedRoomId: room.id,
            status: 'CHECKED_IN',
          },
          include: { guest: true, assignedRoom: true },
        });

        if (!targetReservation) {
          throw new NotFoundException(
            `No active checked-in guest found in Room ${dto.roomNumber}`,
          );
        }

        const openFolio = await this.prisma.folio.findFirst({
          where: { propertyId, reservationId: targetReservation.id, status: 'OPEN' },
        });
        if (!openFolio) {
          throw new ConflictException(
            `Checked-in reservation ${targetReservation.confirmationNumber} has no open billing folio`,
          );
        }
        resolvedFolioId = openFolio.id;
      } else if (dto.reservationId || order.reservationId) {
        const resId = dto.reservationId || order.reservationId!;
        targetReservation = await this.prisma.reservation.findFirst({
          where: { id: resId, propertyId },
          include: { guest: true, assignedRoom: true },
        });
        if (!targetReservation) {
          throw new NotFoundException(`Reservation '${resId}' not found`);
        }
        const openFolio = await this.prisma.folio.findFirst({
          where: { propertyId, reservationId: targetReservation.id, status: 'OPEN' },
        });
        if (!openFolio) {
          throw new ConflictException(`Reservation has no open billing folio`);
        }
        resolvedFolioId = openFolio.id;
      } else {
        throw new BadRequestException(
          'Room Number, Reservation ID, or Folio ID is required for ROOM_CHARGE settlement',
        );
      }

      if (targetReservation) {
        resolvedReservationId = targetReservation.id;
        resolvedRoomNumber = targetReservation.assignedRoom?.roomNumber || resolvedRoomNumber;
        resolvedGuestName = targetReservation.guest
          ? `${targetReservation.guest.firstName} ${targetReservation.guest.lastName}`
          : resolvedGuestName;
      }

      // Post charge to Folio via FolioService (reusing existing folio cashiering engine)
      const chargeDescription = `Restaurant Dining - ${order.outlet.name} - Table ${order.table?.tableNumber || 'To-Go'} (Order #${order.orderNumber})`;
      const idempotencyKey = `fnb_order_close_${order.id}`;

      const txResult = await this.folioService.postCharge(
        propertyId,
        resolvedFolioId!,
        {
          transactionCode: 'RESTAURANT',
          description: chargeDescription,
          amount: order.totalAmount.toFixed(2),
          taxAmount: order.taxAmount.toFixed(2),
        },
        actor,
        idempotencyKey,
      );

      resolvedTransactionId = txResult.id;
    }

    // Close order and release table
    const closedOrder = await this.prisma.$transaction(async (tx) => {
      const ord = await tx.fnbOrder.update({
        where: { id: order.id },
        data: {
          status: 'CLOSED',
          settlementType: dto.settlementType,
          paymentMethod: dto.settlementType === 'ROOM_CHARGE' ? 'ROOM_CHARGE' : (dto.paymentMethod || 'CASH'),
          folioId: resolvedFolioId,
          folioTransactionId: resolvedTransactionId,
          reservationId: resolvedReservationId,
          roomNumber: resolvedRoomNumber,
          guestName: resolvedGuestName,
          closedAt: new Date(),
          closedBy: actor.userId,
          version: { increment: 1 },
        },
        include: {
          outlet: true,
          table: true,
          items: true,
        },
      });

      if (ord.tableId) {
        await tx.restaurantTable.update({
          where: { id: ord.tableId },
          data: {
            status: 'AVAILABLE',
            activeOrderId: null,
            version: { increment: 1 },
          },
        });
      }

      return ord;
    });

    return this.mapToDto(closedOrder);
  }

  async findOrders(propertyId: string, query: QueryFnbOrdersDto): Promise<FnbOrderDto[]> {
    const where: any = { propertyId };

    if (query.outletId) where.outletId = query.outletId;
    if (query.tableId) where.tableId = query.tableId;
    if (query.status) where.status = query.status;

    const orders = await this.prisma.fnbOrder.findMany({
      where,
      include: {
        outlet: true,
        table: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit || 50,
      skip: query.page && query.page > 1 ? (query.page - 1) * (query.limit || 50) : 0,
    });

    return orders.map((o) => this.mapToDto(o));
  }

  async findOrderById(propertyId: string, orderId: string): Promise<FnbOrderDto> {
    const order = await this.prisma.fnbOrder.findFirst({
      where: { id: orderId, propertyId },
      include: {
        outlet: true,
        table: true,
        items: true,
      },
    });
    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    return this.mapToDto(order);
  }

  async getInHouseGuests(propertyId: string): Promise<Array<{
    reservationId: string;
    confirmationNumber: string;
    roomNumber: string;
    guestName: string;
    folioId: string | null;
  }>> {
    const checkedIn = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: 'CHECKED_IN',
        assignedRoomId: { not: null },
      },
      include: {
        guest: true,
        assignedRoom: true,
      },
    });

    const resIds = checkedIn.map((r) => r.id);
    const openFolios = await this.prisma.folio.findMany({
      where: {
        propertyId,
        reservationId: { in: resIds },
        status: 'OPEN',
      },
    });

    const folioMap = new Map<string, string>();
    for (const f of openFolios) {
      if (!folioMap.has(f.reservationId)) {
        folioMap.set(f.reservationId, f.id);
      }
    }

    return checkedIn.map((r) => ({
      reservationId: r.id,
      confirmationNumber: r.confirmationNumber,
      roomNumber: r.assignedRoom?.roomNumber || 'Unknown',
      guestName: r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : 'Guest',
      folioId: folioMap.get(r.id) || null,
    }));
  }

  private mapToDto(order: any): FnbOrderDto {
    return {
      id: order.id,
      propertyId: order.propertyId,
      outletId: order.outletId,
      outletName: order.outlet?.name,
      orderNumber: order.orderNumber,
      tableId: order.tableId,
      tableNumber: order.table?.tableNumber,
      status: order.status as FnbOrderStatus,
      guestCount: order.guestCount,
      serverName: order.serverName,
      notes: order.notes,
      subtotal: order.subtotal ? order.subtotal.toFixed(2) : '0.00',
      taxAmount: order.taxAmount ? order.taxAmount.toFixed(2) : '0.00',
      totalAmount: order.totalAmount ? order.totalAmount.toFixed(2) : '0.00',
      currency: order.currency || 'JPY',
      settlementType: order.settlementType as any,
      paymentMethod: order.paymentMethod,
      reservationId: order.reservationId,
      folioId: order.folioId,
      folioTransactionId: order.folioTransactionId,
      roomNumber: order.roomNumber,
      guestName: order.guestName,
      closedAt: order.closedAt ? (order.closedAt.toISOString ? order.closedAt.toISOString() : String(order.closedAt)) : null,
      closedBy: order.closedBy,
      version: order.version ?? 1,
      createdAt: order.createdAt?.toISOString ? order.createdAt.toISOString() : (order.createdAt || new Date().toISOString()),
      updatedAt: order.updatedAt?.toISOString ? order.updatedAt.toISOString() : (order.updatedAt || new Date().toISOString()),
      items: (order.items || []).map((i: any) => ({
        id: i.id,
        orderId: i.orderId,
        menuItemId: i.menuItemId,
        itemName: i.itemName,
        quantity: i.quantity,
        unitPrice: i.unitPrice ? (typeof i.unitPrice === 'string' ? i.unitPrice : i.unitPrice.toFixed(2)) : '0.00',
        subtotal: i.subtotal ? (typeof i.subtotal === 'string' ? i.subtotal : i.subtotal.toFixed(2)) : '0.00',
        taxAmount: i.taxAmount ? (typeof i.taxAmount === 'string' ? i.taxAmount : i.taxAmount.toFixed(2)) : '0.00',
        totalAmount: i.totalAmount ? (typeof i.totalAmount === 'string' ? i.totalAmount : i.totalAmount.toFixed(2)) : '0.00',
        notes: i.notes,
        status: i.status,
        createdAt: i.createdAt?.toISOString ? i.createdAt.toISOString() : (i.createdAt || new Date().toISOString()),
        updatedAt: i.updatedAt?.toISOString ? i.updatedAt.toISOString() : (i.updatedAt || new Date().toISOString()),
      })),
    };
  }
}
