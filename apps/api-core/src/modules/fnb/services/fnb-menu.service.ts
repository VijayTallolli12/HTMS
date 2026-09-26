import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';
import { Prisma } from '@prisma/client';
import {
  MenuCategoryDto,
  MenuItemDto,
  MenuItemDetailDto,
  MenuItemVariantDto,
  ModifierGroupDto,
  ModifierDto,
  MenuItemPriceDto,
  MenuItemAvailability,
} from '@hms/api-contracts';
import {
  CreateMenuCategoryDto,
  CreateMenuItemDto,
  CreateMenuItemVariantDto,
  UpdateMenuItemVariantDto,
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
  CreateModifierDto,
  UpdateModifierDto,
  UpdateMenuItemDto,
  UpdateMenuItemAvailabilityDto,
  UpdateMenuItemPriceDto,
  QueryMenuItemsDto,
} from '../dto/fnb.dto';

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
      availability: i.availability as MenuItemAvailability,
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
      availability: created.availability as MenuItemAvailability,
      displayOrder: created.displayOrder,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  // ----------------------------------------------------------------------
  // Menu Item Detail (with variants and modifiers)
  // ----------------------------------------------------------------------
  async findMenuItemDetail(
    propertyId: string,
    outletId: string,
    menuItemId: string,
  ): Promise<MenuItemDetailDto> {
    const item = await this.prisma.fnbMenuItem.findFirst({
      where: { id: menuItemId, outletId, propertyId },
      include: {
        category: { select: { name: true } },
        variants: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
        modifierGroups: {
          where: { isActive: true },
          include: {
            modifiers: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    return {
      id: item.id,
      propertyId: item.propertyId,
      outletId: item.outletId,
      categoryId: item.categoryId,
      categoryName: item.category?.name,
      code: item.code,
      name: item.name,
      description: item.description,
      price: item.price.toFixed(2),
      currency: item.currency,
      availability: item.availability as MenuItemAvailability,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      variants: item.variants.map((v) => ({
        id: v.id,
        propertyId: v.propertyId,
        menuItemId: v.menuItemId,
        code: v.code,
        name: v.name,
        price: v.price.toFixed(2),
        currency: v.currency,
        displayOrder: v.displayOrder,
        isActive: v.isActive,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
      modifierGroups: item.modifierGroups.map((g) => ({
        id: g.id,
        propertyId: g.propertyId,
        menuItemId: g.menuItemId,
        name: g.name,
        selectionType: g.selectionType as 'SINGLE' | 'MULTIPLE',
        minSelections: g.minSelections,
        maxSelections: g.maxSelections,
        isActive: g.isActive,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
        modifiers: g.modifiers.map((m) => ({
          id: m.id,
          propertyId: m.propertyId,
          modifierGroupId: m.modifierGroupId,
          name: m.name,
          priceAdjustment: m.priceAdjustment.toFixed(2),
          currency: m.currency,
          isActive: m.isActive,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        })),
      })),
    };
  }

  // ----------------------------------------------------------------------
  // Menu Item CRUD
  // ----------------------------------------------------------------------
  async updateMenuItem(
    propertyId: string,
    outletId: string,
    menuItemId: string,
    dto: UpdateMenuItemDto,
  ): Promise<MenuItemDetailDto> {
    const existing = await this.prisma.fnbMenuItem.findFirst({
      where: { id: menuItemId, outletId, propertyId },
    });
    if (!existing) {
      throw new NotFoundException('Menu item not found');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim();
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price.toString());
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.availability !== undefined) data.availability = dto.availability;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.fnbMenuItem.update({
      where: { id: menuItemId },
      data,
      include: {
        category: { select: { name: true } },
        variants: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
        modifierGroups: {
          where: { isActive: true },
          include: {
            modifiers: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      outletId: updated.outletId,
      categoryId: updated.categoryId,
      categoryName: updated.category?.name,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      price: updated.price.toFixed(2),
      currency: updated.currency,
      availability: updated.availability as MenuItemAvailability,
      displayOrder: updated.displayOrder,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      variants: updated.variants.map((v) => ({
        id: v.id,
        propertyId: v.propertyId,
        menuItemId: v.menuItemId,
        code: v.code,
        name: v.name,
        price: v.price.toFixed(2),
        currency: v.currency,
        displayOrder: v.displayOrder,
        isActive: v.isActive,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
      modifierGroups: updated.modifierGroups.map((g) => ({
        id: g.id,
        propertyId: g.propertyId,
        menuItemId: g.menuItemId,
        name: g.name,
        selectionType: g.selectionType as 'SINGLE' | 'MULTIPLE',
        minSelections: g.minSelections,
        maxSelections: g.maxSelections,
        isActive: g.isActive,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
        modifiers: g.modifiers.map((m) => ({
          id: m.id,
          propertyId: m.propertyId,
          modifierGroupId: m.modifierGroupId,
          name: m.name,
          priceAdjustment: m.priceAdjustment.toFixed(2),
          currency: m.currency,
          isActive: m.isActive,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        })),
      })),
    };
  }

  async updateMenuItemAvailability(
    propertyId: string,
    outletId: string,
    menuItemId: string,
    dto: UpdateMenuItemAvailabilityDto,
  ): Promise<MenuItemDetailDto> {
    return this.updateMenuItem(propertyId, outletId, menuItemId, { availability: dto.availability });
  }

  async updateMenuItemPrice(
    propertyId: string,
    outletId: string,
    menuItemId: string,
    dto: UpdateMenuItemPriceDto,
  ): Promise<MenuItemPriceDto> {
    const existing = await this.prisma.fnbMenuItem.findFirst({
      where: { id: menuItemId, outletId, propertyId },
    });
    if (!existing) {
      throw new NotFoundException('Menu item not found');
    }

    const updated = await this.prisma.fnbMenuItem.update({
      where: { id: menuItemId },
      data: { price: new Prisma.Decimal(dto.price.toString()) },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      basePrice: updated.price.toFixed(2),
      currency: updated.currency,
      availability: updated.availability as MenuItemAvailability,
      variants: updated.variants.map((v) => ({
        id: v.id,
        propertyId: v.propertyId,
        menuItemId: v.menuItemId,
        code: v.code,
        name: v.name,
        price: v.price.toFixed(2),
        currency: v.currency,
        displayOrder: v.displayOrder,
        isActive: v.isActive,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
    };
  }

  async findMenuItemsPaginated(
    propertyId: string,
    query: QueryMenuItemsDto,
  ): Promise<{ items: MenuItemDto[]; total: number; page: number; limit: number }> {
    const where: any = { propertyId, deletedAt: null };
    if (query.outletId) where.outletId = query.outletId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.availability) where.availability = query.availability;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.fnbMenuItem.findMany({
        where,
        include: { category: { select: { name: true } } },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.fnbMenuItem.count({ where }),
    ]);

    return {
      items: items.map((i) => ({
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
        availability: i.availability as MenuItemAvailability,
        displayOrder: i.displayOrder,
        isActive: i.isActive,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  // ----------------------------------------------------------------------
  // Variants
  // ----------------------------------------------------------------------
  async createVariant(
    propertyId: string,
    outletId: string,
    dto: CreateMenuItemVariantDto,
  ): Promise<MenuItemVariantDto> {
    const menuItem = await this.prisma.fnbMenuItem.findFirst({
      where: { id: dto.menuItemId, outletId, propertyId },
    });
    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    const existing = await this.prisma.fnbMenuItemVariant.findFirst({
      where: { menuItemId: dto.menuItemId, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Variant with code '${dto.code}' already exists for this menu item`);
    }

    const created = await this.prisma.fnbMenuItemVariant.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        menuItemId: dto.menuItemId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        price: new Prisma.Decimal(dto.price.toString()),
        currency: dto.currency || 'JPY',
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    return {
      id: created.id,
      propertyId: created.propertyId,
      menuItemId: created.menuItemId,
      code: created.code,
      name: created.name,
      price: created.price.toFixed(2),
      currency: created.currency,
      displayOrder: created.displayOrder,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateVariant(
    propertyId: string,
    outletId: string,
    variantId: string,
    dto: UpdateMenuItemVariantDto,
  ): Promise<MenuItemVariantDto> {
    const variant = await this.prisma.fnbMenuItemVariant.findFirst({
      where: { id: variantId },
      include: { menuItem: { select: { outletId: true, propertyId: true } } },
    });
    if (!variant || variant.menuItem.outletId !== outletId || variant.menuItem.propertyId !== propertyId) {
      throw new NotFoundException('Variant not found');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price.toString());
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.fnbMenuItemVariant.update({
      where: { id: variantId },
      data,
    });

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      menuItemId: updated.menuItemId,
      code: updated.code,
      name: updated.name,
      price: updated.price.toFixed(2),
      currency: updated.currency,
      displayOrder: updated.displayOrder,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteVariant(propertyId: string, outletId: string, variantId: string): Promise<void> {
    const variant = await this.prisma.fnbMenuItemVariant.findFirst({
      where: { id: variantId },
      include: { menuItem: { select: { outletId: true, propertyId: true } } },
    });
    if (!variant || variant.menuItem.outletId !== outletId || variant.menuItem.propertyId !== propertyId) {
      throw new NotFoundException('Variant not found');
    }

    await this.prisma.fnbMenuItemVariant.delete({ where: { id: variantId } });
  }

  // ----------------------------------------------------------------------
  // Modifier Groups
  // ----------------------------------------------------------------------
  async createModifierGroup(
    propertyId: string,
    outletId: string,
    dto: CreateModifierGroupDto,
  ): Promise<ModifierGroupDto> {
    const menuItem = await this.prisma.fnbMenuItem.findFirst({
      where: { id: dto.menuItemId, outletId, propertyId },
    });
    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    const existing = await this.prisma.fnbModifierGroup.findFirst({
      where: { menuItemId: dto.menuItemId, name: dto.name.trim() },
    });
    if (existing) {
      throw new ConflictException(`Modifier group with name '${dto.name}' already exists for this menu item`);
    }

    const created = await this.prisma.fnbModifierGroup.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        menuItemId: dto.menuItemId,
        name: dto.name.trim(),
        selectionType: dto.selectionType ?? 'MULTIPLE',
        minSelections: dto.minSelections ?? 0,
        maxSelections: dto.maxSelections ?? 5,
        isActive: dto.isActive ?? true,
      },
    });

    return {
      id: created.id,
      propertyId: created.propertyId,
      menuItemId: created.menuItemId,
      name: created.name,
      selectionType: created.selectionType as 'SINGLE' | 'MULTIPLE',
      minSelections: created.minSelections,
      maxSelections: created.maxSelections,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateModifierGroup(
    propertyId: string,
    outletId: string,
    modifierGroupId: string,
    dto: UpdateModifierGroupDto,
  ): Promise<ModifierGroupDto> {
    const group = await this.prisma.fnbModifierGroup.findFirst({
      where: { id: modifierGroupId },
      include: { menuItem: { select: { outletId: true, propertyId: true } } },
    });
    if (!group || group.menuItem.outletId !== outletId || group.menuItem.propertyId !== propertyId) {
      throw new NotFoundException('Modifier group not found');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.selectionType !== undefined) data.selectionType = dto.selectionType;
    if (dto.minSelections !== undefined) data.minSelections = dto.minSelections;
    if (dto.maxSelections !== undefined) data.maxSelections = dto.maxSelections;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.fnbModifierGroup.update({
      where: { id: modifierGroupId },
      data,
    });

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      menuItemId: updated.menuItemId,
      name: updated.name,
      selectionType: updated.selectionType as 'SINGLE' | 'MULTIPLE',
      minSelections: updated.minSelections,
      maxSelections: updated.maxSelections,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteModifierGroup(propertyId: string, outletId: string, modifierGroupId: string): Promise<void> {
    const group = await this.prisma.fnbModifierGroup.findFirst({
      where: { id: modifierGroupId },
      include: { menuItem: { select: { outletId: true, propertyId: true } } },
    });
    if (!group || group.menuItem.outletId !== outletId || group.menuItem.propertyId !== propertyId) {
      throw new NotFoundException('Modifier group not found');
    }

    await this.prisma.fnbModifierGroup.delete({ where: { id: modifierGroupId } });
  }

  // ----------------------------------------------------------------------
  // Modifiers
  // ----------------------------------------------------------------------
  async createModifier(
    propertyId: string,
    outletId: string,
    dto: CreateModifierDto,
  ): Promise<ModifierDto> {
    const group = await this.prisma.fnbModifierGroup.findFirst({
      where: { id: dto.modifierGroupId },
      include: { menuItem: { select: { outletId: true, propertyId: true } } },
    });
    if (!group || group.menuItem.outletId !== outletId || group.menuItem.propertyId !== propertyId) {
      throw new NotFoundException('Modifier group not found');
    }

    const created = await this.prisma.fnbModifier.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        modifierGroupId: dto.modifierGroupId,
        name: dto.name.trim(),
        priceAdjustment: new Prisma.Decimal(dto.priceAdjustment?.toString() ?? '0'),
        currency: dto.currency || 'JPY',
        isActive: dto.isActive ?? true,
      },
    });

    return {
      id: created.id,
      propertyId: created.propertyId,
      modifierGroupId: created.modifierGroupId,
      name: created.name,
      priceAdjustment: created.priceAdjustment.toFixed(2),
      currency: created.currency,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateModifier(
    propertyId: string,
    outletId: string,
    modifierId: string,
    dto: UpdateModifierDto,
  ): Promise<ModifierDto> {
    const modifier = await this.prisma.fnbModifier.findFirst({
      where: { id: modifierId },
      include: { modifierGroup: { include: { menuItem: { select: { outletId: true, propertyId: true } } } } },
    });
    if (!modifier || modifier.modifierGroup.menuItem.outletId !== outletId || modifier.modifierGroup.menuItem.propertyId !== propertyId) {
      throw new NotFoundException('Modifier not found');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.priceAdjustment !== undefined) data.priceAdjustment = new Prisma.Decimal(dto.priceAdjustment.toString());
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.fnbModifier.update({
      where: { id: modifierId },
      data,
    });

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      modifierGroupId: updated.modifierGroupId,
      name: updated.name,
      priceAdjustment: updated.priceAdjustment.toFixed(2),
      currency: updated.currency,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteModifier(propertyId: string, outletId: string, modifierId: string): Promise<void> {
    const modifier = await this.prisma.fnbModifier.findFirst({
      where: { id: modifierId },
      include: { modifierGroup: { include: { menuItem: { select: { outletId: true, propertyId: true } } } } },
    });
    if (!modifier || modifier.modifierGroup.menuItem.outletId !== outletId || modifier.modifierGroup.menuItem.propertyId !== propertyId) {
      throw new NotFoundException('Modifier not found');
    }

    await this.prisma.fnbModifier.delete({ where: { id: modifierId } });
  }
}