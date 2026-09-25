import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';
import { Prisma } from '@prisma/client';
import {
  MenuCategoryDto,
  MenuItemDto,
} from '@hms/api-contracts';
import { CreateMenuCategoryDto, CreateMenuItemDto } from '../dto/fnb.dto';

@Injectable()
export class FnbMenuService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllCategories(propertyId: string, outletId: string): Promise<MenuCategoryDto[]> {
    const categories = await this.prisma.fnbMenuCategory.findMany({
      where: { outletId, propertyId },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    return categories.map((c) => ({
      id: c.id,
      propertyId: c.propertyId,
      outletId: c.outletId,
      code: c.code,
      name: c.name,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  async createCategory(
    propertyId: string,
    outletId: string,
    dto: CreateMenuCategoryDto,
  ): Promise<MenuCategoryDto> {
    const existing = await this.prisma.fnbMenuCategory.findFirst({
      where: { outletId, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Menu category with code '${dto.code}' already exists`);
    }

    const created = await this.prisma.fnbMenuCategory.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        outletId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    return {
      id: created.id,
      propertyId: created.propertyId,
      outletId: created.outletId,
      code: created.code,
      name: created.name,
      displayOrder: created.displayOrder,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async findAllMenuItems(
    propertyId: string,
    outletId: string,
    categoryId?: string,
  ): Promise<MenuItemDto[]> {
    const where: any = { outletId, propertyId };
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const items = await this.prisma.fnbMenuItem.findMany({
      where,
      include: {
        category: {
          select: { name: true },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    return items.map((i) => ({
      id: i.id,
      propertyId: i.propertyId,
      outletId: i.outletId,
      categoryId: i.categoryId,
      categoryName: i.category?.name,
      code: i.code,
      name: i.name,
      description: i.description,
      price: i.price.toFixed(2),
      currency: i.currency,
      displayOrder: i.displayOrder,
      isActive: i.isActive,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }));
  }

  async createMenuItem(
    propertyId: string,
    outletId: string,
    dto: CreateMenuItemDto,
  ): Promise<MenuItemDto> {
    const category = await this.prisma.fnbMenuCategory.findFirst({
      where: { id: dto.categoryId, outletId },
    });
    if (!category) {
      throw new NotFoundException(`Menu category '${dto.categoryId}' not found for outlet`);
    }

    const existing = await this.prisma.fnbMenuItem.findFirst({
      where: { outletId, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Menu item with code '${dto.code}' already exists`);
    }

    const priceDecimal = new Prisma.Decimal(dto.price.toString());

    const created = await this.prisma.fnbMenuItem.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        outletId,
        categoryId: dto.categoryId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
        price: priceDecimal,
        currency: dto.currency || 'JPY',
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: {
        category: {
          select: { name: true },
        },
      },
    });

    return {
      id: created.id,
      propertyId: created.propertyId,
      outletId: created.outletId,
      categoryId: created.categoryId,
      categoryName: created.category?.name,
      code: created.code,
      name: created.name,
      description: created.description,
      price: created.price.toFixed(2),
      currency: created.currency,
      displayOrder: created.displayOrder,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }
}

