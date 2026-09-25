import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';
import { Prisma } from '@prisma/client';

export async function seedEvents(propertyId: string): Promise<void> {
  const prisma = getPrismaClient();
  console.log('Seeding Events & Banquets baseline...');

  // 1. Venues
  const venues = [
    {
      code: 'V-BALLROOM',
      name: 'Grand Ballroom',
      venueType: 'BALLROOM',
      capacity: 300,
      location: 'Main Tower, Level 2',
    },
    {
      code: 'V-PAVILION',
      name: 'Garden Pavilion',
      venueType: 'OUTDOOR',
      capacity: 120,
      location: 'East Wing Botanical Courtyard',
    },
    {
      code: 'V-EXEC',
      name: 'Executive Meeting Room',
      venueType: 'MEETING_ROOM',
      capacity: 25,
      location: 'Business Center, Level 3',
    },
  ];

  const venueMap = new Map<string, string>();
  for (const v of venues) {
    let venue = await prisma.eventVenue.findFirst({
      where: { propertyId, code: v.code },
    });
    if (!venue) {
      venue = await prisma.eventVenue.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          code: v.code,
          name: v.name,
          venueType: v.venueType,
          capacity: v.capacity,
          location: v.location,
          isActive: true,
        },
      });
      console.log(`  Created Event Venue: ${venue.name} (${venue.code})`);
    }
    venueMap.set(v.code, venue.id);
  }

  // 2. Packages
  const packages = [
    {
      code: 'PKG-WEDDING',
      name: 'Wedding Reception',
      description: '5-course gourmet banquet, champagne toast, floral centerpieces, bridal suite access, and dedicated butler service.',
      pricePerGuest: new Prisma.Decimal(15000),
      currency: 'JPY',
      minGuests: 50,
    },
    {
      code: 'PKG-CONF',
      name: 'Corporate Conference',
      description: 'Full-day meeting package with morning & afternoon tea breaks, executive buffet lunch, and full audiovisual support.',
      pricePerGuest: new Prisma.Decimal(8000),
      currency: 'JPY',
      minGuests: 20,
    },
    {
      code: 'PKG-EXEC',
      name: 'Executive Meeting',
      description: 'Half-day boardroom package, artisanal coffee service, light executive lunch, and high-speed conference AV.',
      pricePerGuest: new Prisma.Decimal(5000),
      currency: 'JPY',
      minGuests: 5,
    },
  ];

  const packageMap = new Map<string, string>();
  for (const p of packages) {
    let pkg = await prisma.eventPackage.findFirst({
      where: { propertyId, code: p.code },
    });
    if (!pkg) {
      pkg = await prisma.eventPackage.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          code: p.code,
          name: p.name,
          description: p.description,
          pricePerGuest: p.pricePerGuest,
          currency: p.currency,
          minGuests: p.minGuests,
          isActive: true,
        },
      });
      console.log(`  Created Event Package: ${pkg.name} (${pkg.code})`);
    }
    packageMap.set(p.code, pkg.id);
  }

  // 3. Resources
  const resources = [
    {
      name: 'Tables',
      resourceType: 'FURNITURE',
      totalQuantity: 50,
    },
    {
      name: 'Chairs',
      resourceType: 'FURNITURE',
      totalQuantity: 400,
    },
    {
      name: 'Projectors',
      resourceType: 'AUDIO_VISUAL',
      totalQuantity: 10,
    },
    {
      name: 'Sound System',
      resourceType: 'AUDIO_VISUAL',
      totalQuantity: 6,
    },
  ];

  const resourceMap = new Map<string, string>();
  for (const r of resources) {
    let res = await prisma.eventResource.findFirst({
      where: { propertyId, name: r.name },
    });
    if (!res) {
      res = await prisma.eventResource.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          name: r.name,
          resourceType: r.resourceType,
          totalQuantity: r.totalQuantity,
          isActive: true,
        },
      });
      console.log(`  Created Event Resource: ${res.name} (Qty: ${res.totalQuantity})`);
    }
    resourceMap.set(r.name, res.id);
  }

  // 4. In-House Guest Lookup for Demo Linking
  const checkedInReservation = await prisma.reservation.findFirst({
    where: {
      propertyId,
      status: 'CHECKED_IN',
      assignedRoom: { isNot: null },
    },
    include: {
      guest: true,
      assignedRoom: true,
    },
  });

  const checkedInRoom = checkedInReservation?.assignedRoom?.roomNumber || '104';
  const checkedInGuest = checkedInReservation?.guest
    ? `${checkedInReservation.guest.firstName} ${checkedInReservation.guest.lastName}`
    : 'Daniel Craig';

  // 5. Bookings
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const bookings = [
    {
      bookingNumber: 'EVT-20261001-1001',
      venueId: venueMap.get('V-BALLROOM')!,
      packageId: packageMap.get('PKG-CONF'),
      hostName: checkedInGuest,
      hostEmail: 'dcraig@example.com',
      hostPhone: '+81-90-5555-0101',
      eventName: 'Asia-Pacific Hospitality Tech Summit 2026',
      eventType: 'CONFERENCE',
      startTime: new Date(`${tomorrow.toISOString().split('T')[0]}T09:00:00.000Z`),
      endTime: new Date(`${tomorrow.toISOString().split('T')[0]}T17:00:00.000Z`),
      expectedGuests: 150,
      estimatedAmount: new Prisma.Decimal(1200000), // 150 * 8000
      status: 'CONFIRMED',
      notes: 'Keynote starts at 09:30. Simultaneous translation in Japanese and English required.',
      roomNumber: checkedInRoom,
      reservationId: checkedInReservation?.id,
      allocations: [
        { resourceName: 'Tables', quantity: 20 },
        { resourceName: 'Chairs', quantity: 150 },
        { resourceName: 'Projectors', quantity: 2 },
        { resourceName: 'Sound System', quantity: 1 },
      ],
    },
    {
      bookingNumber: 'EVT-20261002-1002',
      venueId: venueMap.get('V-PAVILION')!,
      packageId: packageMap.get('PKG-WEDDING'),
      hostName: 'Kenji & Sakura Sato',
      hostEmail: 'sato.wedding@tokyograndeur.jp',
      hostPhone: '+81-90-5555-0102',
      eventName: 'Sato Spring Garden Wedding Celebration',
      eventType: 'WEDDING',
      startTime: new Date(`${dayAfter.toISOString().split('T')[0]}T15:00:00.000Z`),
      endTime: new Date(`${dayAfter.toISOString().split('T')[0]}T21:00:00.000Z`),
      expectedGuests: 80,
      estimatedAmount: new Prisma.Decimal(1200000), // 80 * 15000
      status: 'TENTATIVE',
      notes: 'Awaiting final floral delivery confirmation. Vegetarian menu option for 12 guests.',
      allocations: [
        { resourceName: 'Tables', quantity: 10 },
        { resourceName: 'Chairs', quantity: 80 },
        { resourceName: 'Sound System', quantity: 1 },
      ],
    },
    {
      bookingNumber: 'EVT-20261001-1003',
      venueId: venueMap.get('V-EXEC')!,
      packageId: packageMap.get('PKG-EXEC'),
      hostName: 'Dr. Aris Thorne',
      hostEmail: 'thorne@biocore-intl.com',
      hostPhone: '+81-3-5555-0103',
      eventName: 'BioCore Executive Board Meeting',
      eventType: 'MEETING',
      startTime: new Date(`${tomorrow.toISOString().split('T')[0]}T13:00:00.000Z`),
      endTime: new Date(`${tomorrow.toISOString().split('T')[0]}T17:00:00.000Z`),
      expectedGuests: 15,
      estimatedAmount: new Prisma.Decimal(75000), // 15 * 5000
      status: 'CONFIRMED',
      notes: 'Confidential corporate strategy session. Strict NDA on catering attendants.',
      allocations: [
        { resourceName: 'Chairs', quantity: 15 },
        { resourceName: 'Projectors', quantity: 1 },
      ],
    },
  ];

  for (const b of bookings) {
    const existing = await prisma.eventBooking.findFirst({
      where: { propertyId, bookingNumber: b.bookingNumber },
    });
    if (!existing) {
      const booking = await prisma.eventBooking.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          bookingNumber: b.bookingNumber,
          venueId: b.venueId,
          packageId: b.packageId,
          hostName: b.hostName,
          hostEmail: b.hostEmail,
          hostPhone: b.hostPhone,
          eventName: b.eventName,
          eventType: b.eventType,
          startTime: b.startTime,
          endTime: b.endTime,
          expectedGuests: b.expectedGuests,
          estimatedAmount: b.estimatedAmount,
          currency: 'JPY',
          status: b.status,
          notes: b.notes,
          roomNumber: b.roomNumber,
          reservationId: b.reservationId,
          version: 1,
        },
      });

      // Allocations
      for (const alloc of b.allocations) {
        const resourceId = resourceMap.get(alloc.resourceName);
        if (resourceId) {
          await prisma.eventBookingResource.create({
            data: {
              id: generateUuidV7(),
              bookingId: booking.id,
              resourceId,
              quantity: alloc.quantity,
            },
          });
        }
      }

      console.log(`  Created Event Booking: ${booking.eventName} (${booking.bookingNumber}) [${booking.status}]`);
    }
  }

  console.log('Events & Banquets seeding complete.');
}

