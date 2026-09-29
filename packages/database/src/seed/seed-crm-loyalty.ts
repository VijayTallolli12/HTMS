import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';

// Local enum definitions to avoid cross-package import issues
enum LoyaltyTier {
  STANDARD = 'STANDARD',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

enum LoyaltyTransactionType {
  EARN = 'EARN',
  REDEEM = 'REDEEM',
  ADJUST = 'ADJUST',
  EXPIRE = 'EXPIRE',
}

export async function seedCrmLoyalty(propertyId: string): Promise<void> {
  const prisma = getPrismaClient();
  console.log('Seeding CRM & Loyalty demo data...');

  // Get existing guests
  const guests = await prisma.guest.findMany({
    where: { propertyId, deletedAt: null },
  });

  const guestMap = new Map(guests.map((g) => [`${g.firstName} ${g.lastName}`, g.id]));

  // Daniel Craig -> GOLD (5000+ lifetime points)
  const danielId = guestMap.get('Daniel Thomas');
  if (danielId) {
    await upsertCrmProfile(prisma, propertyId, danielId, {
      vipFlag: true,
      notes: 'Frequent business traveler. Prefers high floors and quiet rooms. Celebrates anniversary in March.',
      marketingConsent: true,
      tags: ['business', 'anniversary-march', 'high-value'],
    });

    await upsertPreferences(prisma, propertyId, danielId, [
      { category: 'ROOM', preference: 'floor', value: 'high floor (15+)' },
      { category: 'ROOM', preference: 'view', value: 'city view' },
      { category: 'ROOM', preference: 'pillow', value: 'memory foam' },
      { category: 'DINING', preference: 'breakfast', value: 'continental, early service 6:30am' },
      { category: 'SERVICE', preference: 'newspaper', value: 'Financial Times' },
      { category: 'COMMUNICATION', preference: 'channel', value: 'email' },
    ]);

    const membership = await upsertLoyaltyMembership(prisma, propertyId, danielId, {
      tier: LoyaltyTier.GOLD,
      pointsBalance: 2500,
      lifetimePoints: 8500,
      joinedDate: new Date('2022-03-15'),
    });

    await seedLoyaltyTransactions(prisma, propertyId, membership.id, [
      { type: LoyaltyTransactionType.EARN, points: 1200, reference: 'RES-001', referenceType: 'RESERVATION', description: 'Stay - Deluxe King', createdAt: new Date('2023-01-15') },
      { type: LoyaltyTransactionType.EARN, points: 1500, reference: 'RES-002', referenceType: 'RESERVATION', description: 'Stay - Executive Suite', createdAt: new Date('2023-04-22') },
      { type: LoyaltyTransactionType.EARN, points: 1800, reference: 'RES-003', referenceType: 'RESERVATION', description: 'Stay - Presidential Suite', createdAt: new Date('2023-07-10') },
      { type: LoyaltyTransactionType.EARN, points: 2000, reference: 'RES-004', referenceType: 'RESERVATION', description: 'Stay - Deluxe King', createdAt: new Date('2023-10-05') },
      { type: LoyaltyTransactionType.EARN, points: 2000, reference: 'RES-005', referenceType: 'RESERVATION', description: 'Stay - Executive Suite', createdAt: new Date('2024-01-20') },
      { type: LoyaltyTransactionType.REDEEM, points: -500, reference: 'FOLIO-001', referenceType: 'FOLIO', description: 'Spa treatment redemption', createdAt: new Date('2023-08-15') },
      { type: LoyaltyTransactionType.REDEEM, points: -1000, reference: 'FOLIO-002', referenceType: 'FOLIO', description: 'Room upgrade redemption', createdAt: new Date('2024-02-10') },
    ]);
    console.log('  Created CRM & Loyalty for Daniel Thomas (GOLD)');
  }

  // Emma Wilson -> SILVER (1000-4999 lifetime points)
  const emmaId = guestMap.get('Sara Khan'); // Using Sara Khan as Emma Wilson doesn't exist
  if (emmaId) {
    await upsertCrmProfile(prisma, propertyId, emmaId, {
      vipFlag: false,
      notes: 'Leisure traveler. Enjoys spa and dining. Birthday in June.',
      marketingConsent: true,
      tags: ['leisure', 'spa-lover', 'birthday-june'],
    });

    await upsertPreferences(prisma, propertyId, emmaId, [
      { category: 'ROOM', preference: 'floor', value: 'mid floor (8-12)' },
      { category: 'ROOM', preference: 'bed', value: 'king bed' },
      { category: 'DINING', preference: 'dietary', value: 'vegetarian' },
      { category: 'SERVICE', preference: 'spa', value: 'aromatherapy massage' },
      { category: 'AMENITY', preference: 'bath', value: 'bath salts' },
    ]);

    const membership = await upsertLoyaltyMembership(prisma, propertyId, emmaId, {
      tier: LoyaltyTier.SILVER,
      pointsBalance: 800,
      lifetimePoints: 3200,
      joinedDate: new Date('2023-06-10'),
    });

    await seedLoyaltyTransactions(prisma, propertyId, membership.id, [
      { type: LoyaltyTransactionType.EARN, points: 800, reference: 'RES-010', referenceType: 'RESERVATION', description: 'Stay - Premium Queen', createdAt: new Date('2023-06-15') },
      { type: LoyaltyTransactionType.EARN, points: 900, reference: 'RES-011', referenceType: 'RESERVATION', description: 'Stay - Deluxe King', createdAt: new Date('2023-09-20') },
      { type: LoyaltyTransactionType.EARN, points: 1500, reference: 'RES-012', referenceType: 'RESERVATION', description: 'Stay - Junior Suite', createdAt: new Date('2024-01-05') },
      { type: LoyaltyTransactionType.REDEEM, points: -500, reference: 'FOLIO-010', referenceType: 'FOLIO', description: 'Dining credit', createdAt: new Date('2023-11-10') },
      { type: LoyaltyTransactionType.REDEEM, points: -900, reference: 'FOLIO-011', referenceType: 'FOLIO', description: 'Late checkout', createdAt: new Date('2024-02-15') },
    ]);
    console.log('  Created CRM & Loyalty for Sara Khan (SILVER)');
  }

  // Michael Chen -> PLATINUM (20000+ lifetime points)
  const michaelId = guestMap.get('James Wright');
  if (michaelId) {
    await upsertCrmProfile(prisma, propertyId, michaelId, {
      vipFlag: true,
      notes: 'VIP corporate account. CEO of tech company. Requires absolute privacy. Prefers corner suites.',
      marketingConsent: false,
      tags: ['vip', 'corporate', 'privacy', 'ceo'],
    });

    await upsertPreferences(prisma, propertyId, michaelId, [
      { category: 'ROOM', preference: 'room_type', value: 'corner suite only' },
      { category: 'ROOM', preference: 'privacy', value: 'no housekeeping unless requested' },
      { category: 'ROOM', preference: 'temperature', value: '20°C / 68°F' },
      { category: 'DINING', preference: 'in_room', value: 'chef\'s tasting menu available 24h' },
      { category: 'SERVICE', preference: 'transport', value: 'private car service on standby' },
      { category: 'COMMUNICATION', preference: 'channel', value: 'phone - direct line' },
      { category: 'AMENITY', preference: 'tech', value: 'dual monitors, docking station' },
    ]);

    const membership = await upsertLoyaltyMembership(prisma, propertyId, michaelId, {
      tier: LoyaltyTier.PLATINUM,
      pointsBalance: 15000,
      lifetimePoints: 28500,
      joinedDate: new Date('2021-01-20'),
    });

    await seedLoyaltyTransactions(prisma, propertyId, membership.id, [
      { type: LoyaltyTransactionType.EARN, points: 3000, reference: 'RES-020', referenceType: 'RESERVATION', description: 'Stay - Presidential Suite', createdAt: new Date('2021-03-15') },
      { type: LoyaltyTransactionType.EARN, points: 3500, reference: 'RES-021', referenceType: 'RESERVATION', description: 'Stay - Presidential Suite', createdAt: new Date('2021-06-22') },
      { type: LoyaltyTransactionType.EARN, points: 4000, reference: 'RES-022', referenceType: 'RESERVATION', description: 'Stay - Royal Suite', createdAt: new Date('2021-09-10') },
      { type: LoyaltyTransactionType.EARN, points: 3500, reference: 'RES-023', referenceType: 'RESERVATION', description: 'Stay - Presidential Suite', createdAt: new Date('2021-12-05') },
      { type: LoyaltyTransactionType.EARN, points: 4000, reference: 'RES-024', referenceType: 'RESERVATION', description: 'Stay - Royal Suite', createdAt: new Date('2022-03-20') },
      { type: LoyaltyTransactionType.EARN, points: 3500, reference: 'RES-025', referenceType: 'RESERVATION', description: 'Stay - Presidential Suite', createdAt: new Date('2022-06-15') },
      { type: LoyaltyTransactionType.EARN, points: 4000, reference: 'RES-026', referenceType: 'RESERVATION', description: 'Stay - Royal Suite', createdAt: new Date('2022-09-10') },
      { type: LoyaltyTransactionType.EARN, points: 3000, reference: 'RES-027', referenceType: 'RESERVATION', description: 'Stay - Presidential Suite', createdAt: new Date('2023-01-05') },
      { type: LoyaltyTransactionType.REDEEM, points: -2000, reference: 'FOLIO-020', referenceType: 'FOLIO', description: 'Private dining experience', createdAt: new Date('2022-07-15') },
      { type: LoyaltyTransactionType.REDEEM, points: -3000, reference: 'FOLIO-021', referenceType: 'FOLIO', description: 'Helicopter transfer', createdAt: new Date('2023-03-10') },
    ]);
    console.log('  Created CRM & Loyalty for James Wright (PLATINUM)');
  }

  // Sarah Johnson -> STANDARD (0-999 lifetime points)
  const sarahId = guestMap.get('Maria Fernandes');
  if (sarahId) {
    await upsertCrmProfile(prisma, propertyId, sarahId, {
      vipFlag: false,
      notes: 'First-time guest. Couple traveling for honeymoon in August.',
      marketingConsent: true,
      tags: ['honeymoon', 'first-visit', 'couple'],
    });

    await upsertPreferences(prisma, propertyId, sarahId, [
      { category: 'ROOM', preference: 'bed', value: 'king bed with rose petals' },
      { category: 'DINING', preference: 'romantic', value: 'private dinner on balcony' },
      { category: 'AMENITY', preference: 'welcome', value: 'champagne and chocolates' },
    ]);

    const membership = await upsertLoyaltyMembership(prisma, propertyId, sarahId, {
      tier: LoyaltyTier.STANDARD,
      pointsBalance: 150,
      lifetimePoints: 650,
      joinedDate: new Date('2024-05-01'),
    });

    await seedLoyaltyTransactions(prisma, propertyId, membership.id, [
      { type: LoyaltyTransactionType.EARN, points: 500, reference: 'RES-030', referenceType: 'RESERVATION', description: 'Stay - Deluxe King', createdAt: new Date('2024-05-15') },
      { type: LoyaltyTransactionType.EARN, points: 150, reference: 'FOLIO-030', referenceType: 'FOLIO', description: 'Welcome bonus', createdAt: new Date('2024-05-01') },
    ]);
    console.log('  Created CRM & Loyalty for Maria Fernandes (STANDARD)');
  }

  // Add CRM profiles for remaining guests without loyalty
  for (const guest of guests) {
    const hasProfile = await prisma.guestCrmProfile.findFirst({
      where: { propertyId, guestId: guest.id },
    });

    if (!hasProfile) {
      await prisma.guestCrmProfile.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          guestId: guest.id,
          vipFlag: false,
          marketingConsent: false,
          tags: [],
        },
      });
    }
  }

  console.log('CRM & Loyalty demo seeding completed.');
}

async function upsertCrmProfile(
  prisma: any,
  propertyId: string,
  guestId: string,
  data: { vipFlag: boolean; notes?: string; marketingConsent: boolean; tags: string[] },
) {
  let profile = await prisma.guestCrmProfile.findFirst({
    where: { propertyId, guestId },
  });

  if (profile) {
    profile = await prisma.guestCrmProfile.update({
      where: { id: profile.id },
      data,
    });
  } else {
    profile = await prisma.guestCrmProfile.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        guestId,
        ...data,
      },
    });
  }
  return profile;
}

async function upsertPreferences(
  prisma: any,
  propertyId: string,
  guestId: string,
  prefs: Array<{ category: string; preference: string; value: string }>,
) {
  for (const p of prefs) {
    // Use raw SQL to avoid Prisma client limitation with compound unique keys in upsert
    await prisma.$executeRaw`
      INSERT INTO pms_schema.guest_preferences (id, property_id, guest_id, category, preference, value, created_at, updated_at)
      VALUES (gen_random_uuid(), ${propertyId}, ${guestId}, ${p.category}, ${p.preference}, ${p.value}, now(), now())
      ON CONFLICT (property_id, guest_id, category, preference)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
  }
}

async function upsertLoyaltyMembership(
  prisma: any,
  propertyId: string,
  guestId: string,
  data: { tier: LoyaltyTier; pointsBalance: number; lifetimePoints: number; joinedDate: Date },
) {
  let membership = await prisma.loyaltyMembership.findFirst({
    where: { propertyId, guestId },
  });

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  const prefix = property?.code?.substring(0, 3).toUpperCase() || 'HMS';

  if (membership) {
    membership = await prisma.loyaltyMembership.update({
      where: { id: membership.id },
      data,
    });
  } else {
    // membership_number is GLOBALLY unique, so a per-property count collides
    // across properties. Derive a deterministic number from the last 8 chars
    // of the guest id (stable across re-runs, unique per guest, collision-free).
    const guestSuffix = guestId.replace(/-/g, '').slice(-8).toUpperCase();
    const membershipNumber = `${prefix}-${guestSuffix}`;

    membership = await prisma.loyaltyMembership.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        guestId,
        membershipNumber,
        ...data,
        active: true,
      },
    });
  }
  return membership;
}

async function seedLoyaltyTransactions(
  prisma: any,
  propertyId: string,
  membershipId: string,
  transactions: Array<{
    type: LoyaltyTransactionType;
    points: number;
    reference: string;
    referenceType: string;
    description: string;
    createdAt: Date;
  }>,
) {
  for (const tx of transactions) {
    // Use a valid UUID for created_by (using a fixed system UUID)
    const systemUserId = '00000000-0000-0000-0000-000000000001' as const;
    await prisma.$executeRaw`
      INSERT INTO pms_schema.loyalty_transactions (id, property_id, membership_id, type, points, reference, reference_type, description, created_by, created_at)
      VALUES (${generateUuidV7()}::uuid, ${propertyId}::uuid, ${membershipId}::uuid, ${tx.type}, ${tx.points}, ${tx.reference}, ${tx.referenceType}, ${tx.description}, ${systemUserId}::uuid, ${tx.createdAt})
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

if (require.main === module) {
  (async () => {
    const prisma = getPrismaClient();
    const property = await prisma.property.findUnique({ where: { code: 'PROP-TYO-001' } });
    if (property) {
      await seedCrmLoyalty(property.id);
    }
    await prisma.$disconnect();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}