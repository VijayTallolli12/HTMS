import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';
import { Prisma } from '@prisma/client';

export async function seedFnb(propertyId: string): Promise<{ outletId: string }> {
  const prisma = getPrismaClient();
  console.log('Seeding F&B / Restaurant baseline...');

  // 1. Outlet: Tokyo Grandeur Restaurant
  let outlet = await prisma.fnbOutlet.findFirst({
    where: { propertyId, code: 'OUTLET-TGR' },
  });

  if (!outlet) {
    outlet = await prisma.fnbOutlet.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        code: 'OUTLET-TGR',
        name: 'Tokyo Grandeur Restaurant',
        description: 'Flagship fine dining and all-day dining restaurant offering contemporary Japanese-French cuisine.',
        outletType: 'RESTAURANT',
        status: 'ACTIVE',
      },
    });
    console.log(`  Created Outlet: ${outlet.name} (${outlet.code})`);
  } else {
    console.log(`  Outlet exists: ${outlet.name}`);
  }

  // 2. Tables: T01 to T06
  const tables = [
    { tableNumber: 'T01', capacity: 2 },
    { tableNumber: 'T02', capacity: 2 },
    { tableNumber: 'T03', capacity: 4 },
    { tableNumber: 'T04', capacity: 4 },
    { tableNumber: 'T05', capacity: 6 },
    { tableNumber: 'T06', capacity: 8 },
  ];

  for (const t of tables) {
    const existingTable = await prisma.restaurantTable.findFirst({
      where: { outletId: outlet.id, tableNumber: t.tableNumber },
    });
    if (!existingTable) {
      await prisma.restaurantTable.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          outletId: outlet.id,
          tableNumber: t.tableNumber,
          capacity: t.capacity,
          status: 'AVAILABLE',
        },
      });
      console.log(`  Created Table: ${t.tableNumber} (Cap: ${t.capacity})`);
    }
  }

  // 3. Menu Categories
  const categories = [
    { code: 'CAT-BRK', name: 'Breakfast', displayOrder: 1 },
    { code: 'CAT-STR', name: 'Starters', displayOrder: 2 },
    { code: 'CAT-MNC', name: 'Main Course', displayOrder: 3 },
    { code: 'CAT-DST', name: 'Desserts', displayOrder: 4 },
    { code: 'CAT-BEV', name: 'Beverages', displayOrder: 5 },
  ];

  const catMap = new Map<string, string>();
  for (const cat of categories) {
    let category = await prisma.fnbMenuCategory.findFirst({
      where: { outletId: outlet.id, code: cat.code },
    });
    if (!category) {
      category = await prisma.fnbMenuCategory.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          outletId: outlet.id,
          code: cat.code,
          name: cat.name,
          displayOrder: cat.displayOrder,
          isActive: true,
        },
      });
      console.log(`  Created Menu Category: ${category.name}`);
    }
    catMap.set(cat.code, category.id);
  }

  // 4. Menu Items (12 items total, >= 10 as required)
  const menuItems = [
    // Breakfast
    {
      catCode: 'CAT-BRK',
      code: 'ITEM-BRK-01',
      name: 'Grand Continental Breakfast',
      description: 'Artisanal pastries, seasonal fruit platter, fresh juices, and organic eggs your way.',
      price: new Prisma.Decimal('3800.00'),
      displayOrder: 1,
    },
    {
      catCode: 'CAT-BRK',
      code: 'ITEM-BRK-02',
      name: 'Traditional Japanese Morning Set',
      description: 'Grilled salmon, koshihikari rice, dashi tamagoyaki, miso soup, and nori.',
      price: new Prisma.Decimal('4200.00'),
      displayOrder: 2,
    },
    // Starters
    {
      catCode: 'CAT-STR',
      code: 'ITEM-STR-01',
      name: 'Hokkaido Scallop Crudo',
      description: 'Thinly sliced raw scallops with yuzu ponzu, sea urchin emulsion, and shiso cress.',
      price: new Prisma.Decimal('3400.00'),
      displayOrder: 1,
    },
    {
      catCode: 'CAT-STR',
      code: 'ITEM-STR-02',
      name: 'Truffle Wagyu Carpaccio',
      description: 'A5 Wagyu tenderloin with black truffle vinaigrette, parmesan crisp, and caperberries.',
      price: new Prisma.Decimal('4600.00'),
      displayOrder: 2,
    },
    // Main Course
    {
      catCode: 'CAT-MNC',
      code: 'ITEM-MNC-01',
      name: 'Miyazaki A5 Wagyu Sirloin (150g)',
      description: 'Charcoal grilled A5 beef, wasabi butter glaze, kinoko mushrooms, red wine reduction.',
      price: new Prisma.Decimal('14500.00'),
      displayOrder: 1,
    },
    {
      catCode: 'CAT-MNC',
      code: 'ITEM-MNC-02',
      name: 'Miso Glazed Black Cod',
      description: 'Sweet Saikyo miso-marinated cod with pickled ginger root and baby bok choy.',
      price: new Prisma.Decimal('8200.00'),
      displayOrder: 2,
    },
    {
      catCode: 'CAT-MNC',
      code: 'ITEM-MNC-03',
      name: 'King Crab & Truffle Tagliolini',
      description: 'Handmade egg tagliolini, Red King Crab claw meat, black winter truffle sauce.',
      price: new Prisma.Decimal('6800.00'),
      displayOrder: 3,
    },
    // Desserts
    {
      catCode: 'CAT-DST',
      code: 'ITEM-DST-01',
      name: 'Matcha Opera Gateau',
      description: 'Uji ceremonial matcha layered sponge, dark Valrhona ganache, and gold leaf.',
      price: new Prisma.Decimal('2200.00'),
      displayOrder: 1,
    },
    {
      catCode: 'CAT-DST',
      code: 'ITEM-DST-02',
      name: 'Yuzu Soufflé with White Sesame Gelato',
      description: 'Light citrus soufflé served warm with house-churned sesame gelato.',
      price: new Prisma.Decimal('2400.00'),
      displayOrder: 2,
    },
    // Beverages
    {
      catCode: 'CAT-BEV',
      code: 'ITEM-BEV-01',
      name: 'Dassai 23 Junmai Daiginjo (Glass)',
      description: 'Ultra-refined sake with delicate fruity aroma and silk finish.',
      price: new Prisma.Decimal('3200.00'),
      displayOrder: 1,
    },
    {
      catCode: 'CAT-BEV',
      code: 'ITEM-BEV-02',
      name: 'Dom Pérignon Vintage 2013 (Glass)',
      description: 'Prestige cuvée champagne with notes of mirabelle plum, mint, and toasted almond.',
      price: new Prisma.Decimal('5800.00'),
      displayOrder: 2,
    },
    {
      catCode: 'CAT-BEV',
      code: 'ITEM-BEV-03',
      name: 'Kyoto Gyokuro Green Tea (Pot)',
      description: 'Shaded noble tea rich in umami, brewed at precise 60°C.',
      price: new Prisma.Decimal('1600.00'),
      displayOrder: 3,
    },
  ];

  for (const item of menuItems) {
    const categoryId = catMap.get(item.catCode);
    if (!categoryId) continue;

    const existing = await prisma.fnbMenuItem.findFirst({
      where: { outletId: outlet.id, code: item.code },
    });

    if (!existing) {
      await prisma.fnbMenuItem.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          outletId: outlet.id,
          categoryId,
          code: item.code,
          name: item.name,
          description: item.description,
          price: item.price,
          currency: 'JPY',
          displayOrder: item.displayOrder,
          isActive: true,
        },
      });
      console.log(`  Created Menu Item: ${item.name} (¥${item.price})`);
    }
  }

  console.log('F&B seed completed successfully.');
  return { outletId: outlet.id };
}

if (require.main === module) {
  const prisma = getPrismaClient();
  prisma.property
    .findFirst({ where: { code: 'PROP-TYO-001' } })
    .then((property) => {
      if (!property) throw new Error('Property PROP-TYO-001 not found');
      return seedFnb(property.id);
    })
    .then(() => {
      console.log('Standalone F&B seed complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

