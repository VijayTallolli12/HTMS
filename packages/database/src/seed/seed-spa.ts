import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';
import { Prisma } from '@prisma/client';

export async function seedSpa(propertyId: string): Promise<void> {
  const prisma = getPrismaClient();
  console.log('Seeding Spa Operations baseline...');

  // 1. Service Categories
  const categories = [
    {
      code: 'MASSAGE',
      name: 'Massages',
      description: 'Therapeutic massage treatments for relaxation and recovery',
      displayOrder: 1,
    },
    {
      code: 'FACIAL',
      name: 'Facials',
      description: 'Rejuvenating facial treatments and skin therapies',
      displayOrder: 2,
    },
    {
      code: 'BODY',
      name: 'Body Treatments',
      description: 'Exfoliating, wrapping, and detoxifying body treatments',
      displayOrder: 3,
    },
    {
      code: 'BEAUTY',
      name: 'Beauty',
      description: 'Nail care, waxing, and beauty enhancement services',
      displayOrder: 4,
    },
    {
      code: 'WELLNESS',
      name: 'Wellness',
      description: 'Holistic wellness and specialty therapies',
      displayOrder: 5,
    },
  ];

  const categoryMap = new Map<string, string>();
  for (const c of categories) {
    let category = await prisma.spaServiceCategory.findFirst({
      where: { propertyId, code: c.code },
    });
    if (!category) {
      category = await prisma.spaServiceCategory.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          code: c.code,
          name: c.name,
          description: c.description,
          displayOrder: c.displayOrder,
          isActive: true,
        },
      });
      console.log(`  Created Spa Category: ${category.name} (${category.code})`);
    }
    categoryMap.set(c.code, category.id);
  }

  // 2. Services
  const services = [
    {
      code: 'SPA-SIG',
      name: 'Signature Massage',
      description: 'Our bespoke full-body therapy integrating Swedish techniques and warm volcanic stones.',
      categoryCode: 'MASSAGE',
      durationMinutes: 90,
      price: new Prisma.Decimal(18000),
      currency: 'JPY',
    },
    {
      code: 'SPA-DEEP',
      name: 'Deep Tissue Massage',
      description: 'Intensive muscle recovery focusing on pressure points to alleviate chronic tension.',
      categoryCode: 'MASSAGE',
      durationMinutes: 60,
      price: new Prisma.Decimal(15000),
      currency: 'JPY',
    },
    {
      code: 'SPA-SWEDISH',
      name: 'Swedish Massage',
      description: 'Classic relaxation massage with long, flowing strokes to improve circulation.',
      categoryCode: 'MASSAGE',
      durationMinutes: 60,
      price: new Prisma.Decimal(14000),
      currency: 'JPY',
    },
    {
      code: 'SPA-HOTSTONE',
      name: 'Hot Stone Massage',
      description: 'Heated basalt stones placed on key points to melt away deep tension.',
      categoryCode: 'MASSAGE',
      durationMinutes: 75,
      price: new Prisma.Decimal(17000),
      currency: 'JPY',
    },
    {
      code: 'SPA-AROMA',
      name: 'Aromatherapy',
      description: 'Gentle restorative massage infused with custom organic botanical Japanese essential oils.',
      categoryCode: 'MASSAGE',
      durationMinutes: 60,
      price: new Prisma.Decimal(14000),
      currency: 'JPY',
    },
    {
      code: 'SPA-FACIAL',
      name: 'Facial Treatment',
      description: 'Rejuvenating antioxidant facial utilizing marine collagen and active botanical serums.',
      categoryCode: 'FACIAL',
      durationMinutes: 45,
      price: new Prisma.Decimal(12000),
      currency: 'JPY',
    },
    {
      code: 'SPA-FACIAL-DLX',
      name: 'Deluxe Anti-Aging Facial',
      description: 'Advanced peptide and retinol therapy with LED light treatment for visible lifting.',
      categoryCode: 'FACIAL',
      durationMinutes: 60,
      price: new Prisma.Decimal(18000),
      currency: 'JPY',
    },
    {
      code: 'SPA-SCRUB',
      name: 'Body Scrub',
      description: 'Exfoliating sea salt and rice bran scrub followed by hydrating body butter application.',
      categoryCode: 'BODY',
      durationMinutes: 45,
      price: new Prisma.Decimal(13000),
      currency: 'JPY',
    },
    {
      code: 'SPA-WRAP',
      name: 'Detox Body Wrap',
      description: 'Marine algae wrap with infrared therapy to eliminate toxins and tone skin.',
      categoryCode: 'BODY',
      durationMinutes: 60,
      price: new Prisma.Decimal(16000),
      currency: 'JPY',
    },
    {
      code: 'SPA-MANI',
      name: 'Luxury Manicure',
      description: 'Cuticle care, exfoliation, massage, and premium polish application.',
      categoryCode: 'BEAUTY',
      durationMinutes: 45,
      price: new Prisma.Decimal(8000),
      currency: 'JPY',
    },
    {
      code: 'SPA-PEDI',
      name: 'Luxury Pedicure',
      description: 'Foot soak, callus removal, massage, and premium polish application.',
      categoryCode: 'BEAUTY',
      durationMinutes: 60,
      price: new Prisma.Decimal(10000),
      currency: 'JPY',
    },
    {
      code: 'SPA-COUPLE',
      name: 'Couples Wellness',
      description: 'Harmonious side-by-side retreat including dual private aromatic bath and head-to-toe massage.',
      categoryCode: 'WELLNESS',
      durationMinutes: 120,
      price: new Prisma.Decimal(32000),
      currency: 'JPY',
    },
  ];

  const serviceMap = new Map<string, string>();
  for (const s of services) {
    let service = await prisma.spaService.findFirst({
      where: { propertyId, code: s.code },
    });
    if (!service) {
      service = await prisma.spaService.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          categoryId: categoryMap.get(s.categoryCode),
          code: s.code,
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          price: s.price,
          currency: s.currency,
          isActive: true,
          availability: 'AVAILABLE',
        },
      });
      console.log(`  Created Spa Service: ${service.name} (${service.code})`);
    }
    serviceMap.set(s.code, service.id);
  }

  // 3. Service Addons (for a few services)
  const addons = [
    {
      serviceCode: 'SPA-SIG',
      code: 'ADDON-HOTSTONE',
      name: 'Hot Stone Enhancement',
      description: 'Add heated basalt stones to any massage',
      priceAdjustment: new Prisma.Decimal(3000),
      currency: 'JPY',
    },
    {
      serviceCode: 'SPA-FACIAL',
      code: 'ADDON-LED',
      name: 'LED Light Therapy',
      description: 'Red/blue LED therapy for collagen stimulation',
      priceAdjustment: new Prisma.Decimal(4000),
      currency: 'JPY',
    },
    {
      serviceCode: 'SPA-SCRUB',
      code: 'ADDON-AROMA',
      name: 'Aromatherapy Upgrade',
      description: 'Custom essential oil blend for scrub',
      priceAdjustment: new Prisma.Decimal(2000),
      currency: 'JPY',
    },
  ];

  for (const a of addons) {
    const serviceId = serviceMap.get(a.serviceCode);
    if (serviceId) {
      let addon = await prisma.spaServiceAddon.findFirst({
        where: { serviceId, code: a.code },
      });
      if (!addon) {
        addon = await prisma.spaServiceAddon.create({
          data: {
            id: generateUuidV7(),
            propertyId,
            serviceId,
            code: a.code,
            name: a.name,
            description: a.description,
            priceAdjustment: a.priceAdjustment,
            currency: a.currency,
            isActive: true,
          },
        });
        console.log(`  Created Spa Addon: ${addon.name} (${addon.code}) for service ${a.serviceCode}`);
      }
    }
  }

  // 4. Therapists
  const therapists = [
    {
      name: 'Aoi Takahashi',
      specialty: 'Deep Tissue & Sports Therapy',
      phone: '+81 3-5555-0301',
      email: 'aoi.takahashi@tokyograndeur.com',
    },
    {
      name: 'Ren Tanaka',
      specialty: 'Aromatherapy & Shiatsu',
      phone: '+81 3-5555-0302',
      email: 'ren.tanaka@tokyograndeur.com',
    },
    {
      name: 'Sakura Ito',
      specialty: 'Holistic Wellness & Facials',
      phone: '+81 3-5555-0303',
      email: 'sakura.ito@tokyograndeur.com',
    },
    {
      name: 'Yuki Nakamura',
      specialty: 'Beauty & Nail Care',
      phone: '+81 3-5555-0304',
      email: 'yuki.nakamura@tokyograndeur.com',
    },
    {
      name: 'Hiroshi Yamamoto',
      specialty: 'Traditional Japanese Therapies',
      phone: '+81 3-5555-0305',
      email: 'hiroshi.yamamoto@tokyograndeur.com',
    },
  ];

  const therapistMap = new Map<string, string>();
  for (const th of therapists) {
    let therapist = await prisma.spaTherapist.findFirst({
      where: { propertyId, name: th.name },
    });
    if (!therapist) {
      therapist = await prisma.spaTherapist.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          name: th.name,
          specialty: th.specialty,
          phone: th.phone,
          email: th.email,
          isActive: true,
        },
      });
      console.log(`  Created Spa Therapist: ${therapist.name}`);
    }
    therapistMap.set(th.name, therapist.id);
  }

  // 5. Treatment Rooms
  const rooms = [
    { name: 'Lotus Suite', roomType: 'SINGLE' },
    { name: 'Zen Sanctuary', roomType: 'COUPLES' },
    { name: 'Bamboo Pavilion', roomType: 'HYDROTHERAPY' },
    { name: 'Sakura Room', roomType: 'FACIAL' },
  ];

  const roomMap = new Map<string, string>();
  for (const r of rooms) {
    let spaRoom = await prisma.spaRoom.findFirst({
      where: { propertyId, name: r.name },
    });
    if (!spaRoom) {
      spaRoom = await prisma.spaRoom.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          name: r.name,
          roomType: r.roomType,
          status: 'AVAILABLE',
        },
      });
      console.log(`  Created Spa Room: ${spaRoom.name} (${spaRoom.roomType})`);
    }
    roomMap.set(r.name, spaRoom.id);
  }

  // 6. Initial Appointments
  const existingAppt = await prisma.spaAppointment.findFirst({
    where: { propertyId },
  });

  if (!existingAppt) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);

    // Find checked-in guest (e.g. Room 104 Daniel Craig) if available
    const checkedInRes = await prisma.reservation.findFirst({
      where: { propertyId, status: 'CHECKED_IN' },
      include: { guest: true, assignedRoom: true },
    });

    const openFolio = checkedInRes
      ? await prisma.folio.findFirst({
          where: { propertyId, reservationId: checkedInRes.id, status: 'OPEN' },
        })
      : null;

    // Appointment 1: Completed earlier today (Signature Massage)
    const start1 = new Date(`${dateStr}T10:00:00.000Z`);
    const end1 = new Date(`${dateStr}T11:30:00.000Z`);
    await prisma.spaAppointment.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        appointmentNumber: 'SPA-2026-0001',
        serviceId: serviceMap.get('SPA-SIG')!,
        therapistId: therapistMap.get('Sakura Ito')!,
        roomId: roomMap.get('Lotus Suite')!,
        startTime: start1,
        endTime: end1,
        durationMinutes: 90,
        price: new Prisma.Decimal(18000),
        currency: 'JPY',
        status: 'COMPLETED',
        guestName: checkedInRes?.guest ? `${checkedInRes.guest.firstName} ${checkedInRes.guest.lastName}` : 'Daniel Craig',
        roomNumber: checkedInRes?.assignedRoom?.roomNumber || '104',
        reservationId: checkedInRes?.id,
        folioId: openFolio?.id,
        settlementType: 'ROOM_CHARGE',
        paymentMethod: 'ROOM_CHARGE',
        completedAt: end1,
        notes: 'VIP guest requested high pressure and lavender essential oils.',
      },
    });

    // Appointment 2: Confirmed afternoon today (Aromatherapy)
    const start2 = new Date(`${dateStr}T14:00:00.000Z`);
    const end2 = new Date(`${dateStr}T15:00:00.000Z`);
    await prisma.spaAppointment.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        appointmentNumber: 'SPA-2026-0002',
        serviceId: serviceMap.get('SPA-AROMA')!,
        therapistId: therapistMap.get('Ren Tanaka')!,
        roomId: roomMap.get('Lotus Suite')!,
        startTime: start2,
        endTime: end2,
        durationMinutes: 60,
        price: new Prisma.Decimal(14000),
        currency: 'JPY',
        status: 'CONFIRMED',
        guestName: 'Elena Rostova',
        guestPhone: '+81 90-1234-5678',
        notes: 'First time spa guest, gentle pressure requested.',
      },
    });

    // Appointment 3: Scheduled evening today (Couples Wellness)
    const start3 = new Date(`${dateStr}T17:00:00.000Z`);
    const end3 = new Date(`${dateStr}T19:00:00.000Z`);
    await prisma.spaAppointment.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        appointmentNumber: 'SPA-2026-0003',
        serviceId: serviceMap.get('SPA-COUPLE')!,
        therapistId: therapistMap.get('Aoi Takahashi')!,
        roomId: roomMap.get('Zen Sanctuary')!,
        startTime: start3,
        endTime: end3,
        durationMinutes: 120,
        price: new Prisma.Decimal(32000),
        currency: 'JPY',
        status: 'SCHEDULED',
        guestName: 'Marcus & Jessica Vance',
        guestPhone: '+1 415-555-8822',
        notes: 'Anniversary celebration. Champagne service requested upon arrival.',
      },
    });

    console.log('  Created 3 Demo Spa Appointments.');
  }

  // 7. Market Rate Providers (Revenue Management) - Using raw SQL due to Prisma client issue
  const marketProviders = [
    {
      providerName: 'Tokyo Luxury Compset',
      providerType: 'DEMO_COMPSET',
      configuration: { competitors: ['COMP-TOK-001', 'COMP-TOK-002', 'COMP-TOK-003'] },
    },
    {
      providerName: 'Tokyo OTA Rates',
      providerType: 'DEMO_OTA',
      configuration: { endpoints: ['https://demo-ota.example.com/rates'] },
    },
  ];

  for (const mp of marketProviders) {
    // Use raw SQL with explicit cast to enum type
    const providers = await prisma.$queryRaw<Array<{id: string}>>`
      SELECT id FROM pms_schema.market_rate_providers
      WHERE property_id = ${propertyId} AND provider_name = ${mp.providerName}
      LIMIT 1
    `;
    
    if (!providers || providers.length === 0) {
      const id = generateUuidV7();
      await prisma.$executeRaw`
        INSERT INTO pms_schema.market_rate_providers (id, property_id, provider_name, provider_type, configuration, is_enabled, created_at, updated_at)
        VALUES (${id}, ${propertyId}, ${mp.providerName}, ${mp.providerType}::pms_schema."MarketRateProviderType", ${JSON.stringify(mp.configuration)}::jsonb, true, now(), now())
      `;
      console.log(`  Created Market Rate Provider: ${mp.providerName}`);
    }
  }

  // 8. Competitor Set
  const competitors = [
    {
      competitorCode: 'COMP-TOK-001',
      competitorName: 'The Peninsula Tokyo',
      segment: 'LUXURY',
      distanceKm: 2.1,
    },
    {
      competitorCode: 'COMP-TOK-002',
      competitorName: 'Park Hyatt Tokyo',
      segment: 'LUXURY',
      distanceKm: 3.5,
    },
    {
      competitorCode: 'COMP-TOK-003',
      competitorName: 'Shangri-La Tokyo',
      segment: 'LUXURY',
      distanceKm: 4.2,
    },
  ];

  for (const c of competitors) {
    // Use raw SQL to avoid Prisma client issue with segment enum
    const competitors_result = await prisma.$queryRaw<Array<{id: string}>>`
      SELECT id FROM pms_schema.competitor_set
      WHERE property_id = ${propertyId} AND competitor_code = ${c.competitorCode}
      LIMIT 1
    `;
    
    if (!competitors_result || competitors_result.length === 0) {
      const id = generateUuidV7();
      await prisma.$executeRaw`
        INSERT INTO pms_schema.competitor_set (id, property_id, competitor_code, competitor_name, segment, distance_km, is_active, created_at, updated_at)
        VALUES (${id}, ${propertyId}, ${c.competitorCode}, ${c.competitorName}, ${c.segment}::pms_schema."CompetitorSegment", ${c.distanceKm}, true, now(), now())
      `;
      console.log(`  Created Competitor: ${c.competitorName} (${c.competitorCode})`);
    }
  }

  console.log('  Created Market Rate Providers and Competitor Set.');
  console.log('Spa baseline seeding completed.');
}