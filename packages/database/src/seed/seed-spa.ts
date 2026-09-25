import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';
import { Prisma } from '@prisma/client';

export async function seedSpa(propertyId: string): Promise<void> {
  const prisma = getPrismaClient();
  console.log('Seeding Spa Operations baseline...');

  // 1. Services
  const services = [
    {
      code: 'SPA-SIG',
      name: 'Signature Massage',
      description: 'Our bespoke full-body therapy integrating Swedish techniques and warm volcanic stones.',
      durationMinutes: 90,
      price: new Prisma.Decimal(18000),
      currency: 'JPY',
    },
    {
      code: 'SPA-DEEP',
      name: 'Deep Tissue Massage',
      description: 'Intensive muscle recovery focusing on pressure points to alleviate chronic tension.',
      durationMinutes: 60,
      price: new Prisma.Decimal(15000),
      currency: 'JPY',
    },
    {
      code: 'SPA-AROMA',
      name: 'Aromatherapy',
      description: 'Gentle restorative massage infused with custom organic botanical Japanese essential oils.',
      durationMinutes: 60,
      price: new Prisma.Decimal(14000),
      currency: 'JPY',
    },
    {
      code: 'SPA-FACIAL',
      name: 'Facial Treatment',
      description: 'Rejuvenating antioxidant facial utilizing marine collagen and active botanical serums.',
      durationMinutes: 45,
      price: new Prisma.Decimal(12000),
      currency: 'JPY',
    },
    {
      code: 'SPA-COUPLE',
      name: 'Couples Wellness',
      description: 'Harmonious side-by-side retreat including dual private aromatic bath and head-to-toe massage.',
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
          code: s.code,
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          price: s.price,
          currency: s.currency,
          isActive: true,
        },
      });
      console.log(`  Created Spa Service: ${service.name} (${service.code})`);
    }
    serviceMap.set(s.code, service.id);
  }

  // 2. Therapists
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

  // 3. Treatment Rooms
  const rooms = [
    { name: 'Lotus Suite', roomType: 'SINGLE' },
    { name: 'Zen Sanctuary', roomType: 'COUPLES' },
    { name: 'Bamboo Pavilion', roomType: 'HYDROTHERAPY' },
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

  // 4. Initial Appointments
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

  console.log('Spa baseline seeding completed.');
}

