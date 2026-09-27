import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';
import { Prisma } from '@prisma/client';

export async function seedProcurement(propertyId: string): Promise<void> {
  const prisma = getPrismaClient();
  console.log('Seeding Procurement & Inventory demo data...');

  // 1. Suppliers
  const suppliersData = [
    {
      code: 'SUP-LINEN',
      name: 'Tokyo Hospitality Linens & Textiles',
      contact: 'Kenji Sato',
      email: 'orders@tokyolinen.demo',
      phone: '+81-3-5555-0101',
    },
    {
      code: 'SUP-BEV',
      name: 'Fuji Springs Beverages & Teas',
      contact: 'Aoi Takahashi',
      email: 'sales@fujisprings.demo',
      phone: '+81-3-5555-0102',
    },
    {
      code: 'SUP-AMEN',
      name: 'Kyoto Botanical Amenities Co.',
      contact: 'Emi Tanaka',
      email: 'info@kyotobotanical.demo',
      phone: '+81-3-5555-0103',
    },
  ];

  const supplierMap = new Map<string, string>();

  for (const s of suppliersData) {
    let supplier = await prisma.supplier.findUnique({
      where: {
        uq_supplier_property_code: { propertyId, code: s.code },
      },
    });

    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          code: s.code,
          name: s.name,
          contact: s.contact,
          email: s.email,
          phone: s.phone,
          active: true,
        },
      });
      console.log(`  Created Supplier: ${supplier.name} (${supplier.code})`);
    } else {
      console.log(`  Supplier exists: ${supplier.name} (${supplier.code})`);
    }
    supplierMap.set(s.code, supplier.id);
  }

  // 2. Inventory Items
  const itemsData = [
    {
      sku: 'HK-TWL-001',
      name: 'Egyptian Cotton Bath Towel 70x140cm',
      category: 'HOUSEKEEPING',
      unit: 'PIECE',
      reorderLevel: 50,
      initialOnHand: 45,
    },
    {
      sku: 'HK-BED-001',
      name: 'Luxury Percale King Bed Sheet 300TC',
      category: 'HOUSEKEEPING',
      unit: 'PIECE',
      reorderLevel: 30,
      initialOnHand: 25,
    },
    {
      sku: 'FNB-WTR-001',
      name: 'Fuji Natural Mineral Water 750ml',
      category: 'FNB',
      unit: 'BOTTLE',
      reorderLevel: 100,
      initialOnHand: 150, // Backed by RECEIVED PO
    },
    {
      sku: 'FNB-TEA-001',
      name: 'Uji Ceremonial Grade Matcha 500g',
      category: 'FNB',
      unit: 'TIN',
      reorderLevel: 15,
      initialOnHand: 10, // Backed by RECEIVED PO
    },
    {
      sku: 'AMN-SHP-001',
      name: 'Organic Bamboo Charcoal Shampoo 50ml',
      category: 'AMENITIES',
      unit: 'BOTTLE',
      reorderLevel: 80,
      initialOnHand: 60,
    },
    {
      sku: 'MNT-BLB-001',
      name: 'Warm LED Recessed Spotlight Bulb 7W',
      category: 'MAINTENANCE',
      unit: 'BOX',
      reorderLevel: 25,
      initialOnHand: 30,
    },
  ];

  const itemMap = new Map<string, string>();

  for (const it of itemsData) {
    let item = await prisma.inventoryItem.findUnique({
      where: {
        uq_inventory_item_property_sku: { propertyId, sku: it.sku },
      },
    });

    if (!item) {
      item = await prisma.inventoryItem.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          sku: it.sku,
          name: it.name,
          category: it.category,
          unit: it.unit,
          reorderLevel: it.reorderLevel,
          active: true,
        },
      });
      console.log(`  Created Inventory Item: ${item.name} (${item.sku})`);
    } else {
      console.log(`  Inventory Item exists: ${item.name} (${item.sku})`);
    }
    itemMap.set(it.sku, item.id);

    // Upsert initial StockBalance
    const balance = await prisma.stockBalance.findUnique({
      where: {
        uq_stock_balance_property_item: { propertyId, inventoryItemId: item.id },
      },
    });

    if (!balance) {
      await prisma.stockBalance.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          inventoryItemId: item.id,
          onHand: it.initialOnHand,
          reserved: 0,
          available: it.initialOnHand,
          reorderLevel: it.reorderLevel,
          version: 1,
        },
      });
      console.log(`    Stock balance initialized: ${it.sku} = ${it.initialOnHand} on hand`);
    }
  }

  // 3. Purchase Orders covering all key states: DRAFT, SUBMITTED, APPROVED, RECEIVED
  const supLinenId = supplierMap.get('SUP-LINEN')!;
  const supBevId = supplierMap.get('SUP-BEV')!;
  const supAmenId = supplierMap.get('SUP-AMEN')!;

  // 3a. DRAFT PO
  const poDraftNumber = 'PO-2026-0001';
  let poDraft = await prisma.purchaseOrder.findUnique({
    where: { uq_purchase_order_property_number: { propertyId, poNumber: poDraftNumber } },
  });
  if (!poDraft) {
    const shampooId = itemMap.get('AMN-SHP-001')!;
    poDraft = await prisma.purchaseOrder.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        supplierId: supAmenId,
        poNumber: poDraftNumber,
        status: 'DRAFT',
        orderDate: new Date('2026-10-02'),
        expectedDate: new Date('2026-10-10'),
        totalAmount: new Prisma.Decimal('350.0000'),
        notes: 'Monthly guest amenities restocking draft order',
        items: {
          create: [
            {
              id: generateUuidV7(),
              inventoryItemId: shampooId,
              quantity: 100,
              unitCost: new Prisma.Decimal('3.5000'),
              totalCost: new Prisma.Decimal('350.0000'),
            },
          ],
        },
      },
    });
    console.log(`  Created Purchase Order: ${poDraft.poNumber} [DRAFT]`);
  }

  // 3b. SUBMITTED PO
  const poSubmittedNumber = 'PO-2026-0002';
  let poSubmitted = await prisma.purchaseOrder.findUnique({
    where: { uq_purchase_order_property_number: { propertyId, poNumber: poSubmittedNumber } },
  });
  if (!poSubmitted) {
    const waterId = itemMap.get('FNB-WTR-001')!;
    const matchaId = itemMap.get('FNB-TEA-001')!;
    poSubmitted = await prisma.purchaseOrder.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        supplierId: supBevId,
        poNumber: poSubmittedNumber,
        status: 'SUBMITTED',
        orderDate: new Date('2026-10-01'),
        expectedDate: new Date('2026-10-07'),
        totalAmount: new Prisma.Decimal('1140.0000'),
        notes: 'Submitted for GM approval: banquet beverage stock replenishment',
        items: {
          create: [
            {
              id: generateUuidV7(),
              inventoryItemId: waterId,
              quantity: 200,
              unitCost: new Prisma.Decimal('2.2000'),
              totalCost: new Prisma.Decimal('440.0000'),
            },
            {
              id: generateUuidV7(),
              inventoryItemId: matchaId,
              quantity: 20,
              unitCost: new Prisma.Decimal('35.0000'),
              totalCost: new Prisma.Decimal('700.0000'),
            },
          ],
        },
      },
    });
    console.log(`  Created Purchase Order: ${poSubmitted.poNumber} [SUBMITTED]`);
  }

  // 3c. APPROVED PO
  const poApprovedNumber = 'PO-2026-0003';
  let poApproved = await prisma.purchaseOrder.findUnique({
    where: { uq_purchase_order_property_number: { propertyId, poNumber: poApprovedNumber } },
  });
  if (!poApproved) {
    const towelId = itemMap.get('HK-TWL-001')!;
    const bedSheetId = itemMap.get('HK-BED-001')!;
    poApproved = await prisma.purchaseOrder.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        supplierId: supLinenId,
        poNumber: poApprovedNumber,
        status: 'APPROVED',
        orderDate: new Date('2026-09-28'),
        expectedDate: new Date('2026-10-05'),
        totalAmount: new Prisma.Decimal('3240.0000'),
        notes: 'Approved by GM: Autumn high occupancy turnover linen reserve',
        items: {
          create: [
            {
              id: generateUuidV7(),
              inventoryItemId: towelId,
              quantity: 80,
              unitCost: new Prisma.Decimal('18.0000'),
              totalCost: new Prisma.Decimal('1440.0000'),
            },
            {
              id: generateUuidV7(),
              inventoryItemId: bedSheetId,
              quantity: 40,
              unitCost: new Prisma.Decimal('45.0000'),
              totalCost: new Prisma.Decimal('1800.0000'),
            },
          ],
        },
      },
    });
    console.log(`  Created Purchase Order: ${poApproved.poNumber} [APPROVED]`);
  }

  // 3d. RECEIVED PO + Goods Receipt + Stock Balance Integration
  const poReceivedNumber = 'PO-2026-0004';
  let poReceived = await prisma.purchaseOrder.findUnique({
    where: { uq_purchase_order_property_number: { propertyId, poNumber: poReceivedNumber } },
  });
  if (!poReceived) {
    const waterId = itemMap.get('FNB-WTR-001')!;
    const matchaId = itemMap.get('FNB-TEA-001')!;
    poReceived = await prisma.purchaseOrder.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        supplierId: supBevId,
        poNumber: poReceivedNumber,
        status: 'RECEIVED',
        orderDate: new Date('2026-09-20'),
        expectedDate: new Date('2026-09-25'),
        totalAmount: new Prisma.Decimal('680.0000'),
        notes: 'Fully delivered and received into central pantry',
        items: {
          create: [
            {
              id: generateUuidV7(),
              inventoryItemId: waterId,
              quantity: 150,
              unitCost: new Prisma.Decimal('2.2000'),
              totalCost: new Prisma.Decimal('330.0000'),
            },
            {
              id: generateUuidV7(),
              inventoryItemId: matchaId,
              quantity: 10,
              unitCost: new Prisma.Decimal('35.0000'),
              totalCost: new Prisma.Decimal('350.0000'),
            },
          ],
        },
      },
    });
    console.log(`  Created Purchase Order: ${poReceived.poNumber} [RECEIVED]`);
  }

  // Create corresponding GoodsReceipt (independent of PO creation so re-runs
  // recover if a previous run crashed between PO and receipt)
  const waterId = itemMap.get('FNB-WTR-001')!;
  const matchaId = itemMap.get('FNB-TEA-001')!;
  const grNumber = 'GR-2026-0001';
  const idempotencyKey = `procurement_receipt_${propertyId}_${grNumber}`;

  const existingGr = await prisma.goodsReceipt.findUnique({
    where: { idempotencyKey },
  });

  if (!existingGr) {
    await prisma.goodsReceipt.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        purchaseOrderId: poReceived!.id,
          receiptNumber: grNumber,
          receivedDate: new Date('2026-09-25'),
          status: 'POSTED',
          notes: 'All cases inspected in good condition. Batch lot 2609A verified.',
          idempotencyKey,
          version: 1,
          items: {
            create: [
              {
                id: generateUuidV7(),
                inventoryItemId: waterId,
                orderedQuantity: 150,
                receivedQuantity: 150,
              },
              {
                id: generateUuidV7(),
                inventoryItemId: matchaId,
                orderedQuantity: 10,
                receivedQuantity: 10,
              },
            ],
          },
        },
      });
    console.log(`  Created Goods Receipt: ${grNumber} (IdempotencyKey: ${idempotencyKey})`);
  }

  console.log('Procurement & Inventory demo seeding completed successfully.');
}

