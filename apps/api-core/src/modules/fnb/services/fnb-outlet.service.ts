import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';
import {
  OutletDto,
  RestaurantTableDto,
  TableStatus,
} from '@hms/api-contracts';
import { CreateOutletDto, CreateTableDto, UpdateTableStatusDto } from '../dto/fnb.dto';

@Injectable()
export class FnbOutletService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllOutlets(propertyId: string): Promise<OutletDto[]> {
    const outlets = await this.prisma.fnbOutlet.findMany({
      where: { propertyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    return outlets.map((o) => ({
      id: o.id,
      propertyId: o.propertyId,
      code: o.code,
      name: o.name,
      description: o.description,
      outletType: o.outletType as any,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    }));
  }

  async findOutletById(propertyId: string, outletId: string): Promise<OutletDto> {
    const outlet = await this.prisma.fnbOutlet.findFirst({
      where: { id: outletId, propertyId, deletedAt: null },
    });
    if (!outlet) {
      throw new NotFoundException(`F&B Outlet '${outletId}' not found for property`);
    }

    return {
      id: outlet.id,
      propertyId: outlet.propertyId,
      code: outlet.code,
      name: outlet.name,
      description: outlet.description,
      outletType: outlet.outletType as any,
      status: outlet.status,
      createdAt: outlet.createdAt.toISOString(),
      updatedAt: outlet.updatedAt.toISOString(),
    };
  }

  async createOutlet(propertyId: string, dto: CreateOutletDto): Promise<OutletDto> {
    const existing = await this.prisma.fnbOutlet.findFirst({
      where: { propertyId, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Outlet with code '${dto.code}' already exists`);
    }

    const created = await this.prisma.fnbOutlet.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
        outletType: dto.outletType || 'RESTAURANT',
        status: 'ACTIVE',
      },
    });

    return {
      id: created.id,
      propertyId: created.propertyId,
      code: created.code,
      name: created.name,
      description: created.description,
      outletType: created.outletType as any,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async findAllTables(propertyId: string, outletId: string): Promise<RestaurantTableDto[]> {
    await this.findOutletById(propertyId, outletId);

    const tables = await this.prisma.restaurantTable.findMany({
      where: { outletId, propertyId },
      include: {
        activeOrder: {
          include: {
            items: true,
          },
        },
      },
      orderBy: { tableNumber: 'asc' },
    });

    return tables.map((t) => ({
      id: t.id,
      propertyId: t.propertyId,
      outletId: t.outletId,
      tableNumber: t.tableNumber,
      capacity: t.capacity,
      status: t.status as TableStatus,
      activeOrderId: t.activeOrderId,
      activeOrder: t.activeOrder
        ? {
            id: t.activeOrder.id,
            propertyId: t.activeOrder.propertyId,
            outletId: t.activeOrder.outletId,
            orderNumber: t.activeOrder.orderNumber,
            tableId: t.activeOrder.tableId,
            tableNumber: t.tableNumber,
            status: t.activeOrder.status as any,
            guestCount: t.activeOrder.guestCount,
            serverName: t.activeOrder.serverName,
            notes: t.activeOrder.notes,
            subtotal: t.activeOrder.subtotal.toFixed(2),
            taxAmount: t.activeOrder.taxAmount.toFixed(2),
            totalAmount: t.activeOrder.totalAmount.toFixed(2),
            currency: t.activeOrder.currency,
            settlementType: t.activeOrder.settlementType as any,
            paymentMethod: t.activeOrder.paymentMethod,
            reservationId: t.activeOrder.reservationId,
            folioId: t.activeOrder.folioId,
            folioTransactionId: t.activeOrder.folioTransactionId,
            roomNumber: t.activeOrder.roomNumber,
            guestName: t.activeOrder.guestName,
            closedAt: t.activeOrder.closedAt?.toISOString() || null,
            closedBy: t.activeOrder.closedBy,
            version: t.activeOrder.version,
            createdAt: t.activeOrder.createdAt.toISOString(),
            updatedAt: t.activeOrder.updatedAt.toISOString(),
            items: t.activeOrder.items.map((i) => ({
              id: i.id,
              orderId: i.orderId,
              menuItemId: i.menuItemId,
              itemName: i.itemName,
              quantity: i.quantity,
              unitPrice: i.unitPrice.toFixed(2),
              subtotal: i.subtotal.toFixed(2),
              taxAmount: i.taxAmount.toFixed(2),
              totalAmount: i.totalAmount.toFixed(2),
              notes: i.notes,
              status: i.status,
              createdAt: i.createdAt.toISOString(),
              updatedAt: i.updatedAt.toISOString(),
            })),
          }
        : null,
      version: t.version,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  }

  async createTable(propertyId: string, outletId: string, dto: CreateTableDto): Promise<RestaurantTableDto> {
    await this.findOutletById(propertyId, outletId);

    const existing = await this.prisma.restaurantTable.findFirst({
      where: { outletId, tableNumber: dto.tableNumber.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Table '${dto.tableNumber}' already exists for outlet`);
    }

    const created = await this.prisma.restaurantTable.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        outletId,
        tableNumber: dto.tableNumber.trim().toUpperCase(),
        capacity: dto.capacity || 4,
        status: dto.status || 'AVAILABLE',
      },
    });

    return {
      id: created.id,
      propertyId: created.propertyId,
      outletId: created.outletId,
      tableNumber: created.tableNumber,
      capacity: created.capacity,
      status: created.status as TableStatus,
      activeOrderId: null,
      activeOrder: null,
      version: created.version,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateTableStatus(
    propertyId: string,
    outletId: string,
    tableId: string,
    dto: UpdateTableStatusDto,
  ): Promise<RestaurantTableDto> {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, outletId, propertyId },
    });
    if (!table) {
      throw new NotFoundException(`Table '${tableId}' not found`);
    }

    if (table.activeOrderId && dto.status === 'AVAILABLE') {
      throw new ConflictException(`Cannot mark table as AVAILABLE while active order '${table.activeOrderId}' is attached`);
    }

    const updated = await this.prisma.restaurantTable.update({
      where: { id: tableId },
      data: {
        status: dto.status,
        version: { increment: 1 },
      },
    });

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      outletId: updated.outletId,
      tableNumber: updated.tableNumber,
      capacity: updated.capacity,
      status: updated.status as TableStatus,
      activeOrderId: updated.activeOrderId,
      version: updated.version,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}

