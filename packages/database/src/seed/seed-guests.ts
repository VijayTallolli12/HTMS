import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';

export interface GuestIds {
  guestAhmed: string; guestDaniel: string; guestSara: string; guestOmar: string;
  guestMaria: string; guestJames: string; guestFatima: string; guestHiroshi: string;
}

const GUESTS = [
  { firstName: 'Ahmed', lastName: 'Al Mansouri', email: 'ahmed.almansouri@demo.hms', phone: '+971-50-555-0101', identificationType: 'PASSPORT', identificationNumber: 'DEMO-AAM-001' },
  { firstName: 'Daniel', lastName: 'Thomas', email: 'daniel.thomas@demo.hms', phone: '+1-415-555-0202', identificationType: 'PASSPORT', identificationNumber: 'DEMO-DTH-002' },
  { firstName: 'Sara', lastName: 'Khan', email: 'sara.khan@demo.hms', phone: '+44-20-555-0303', identificationType: 'PASSPORT', identificationNumber: 'DEMO-SKH-003' },
  { firstName: 'Omar', lastName: 'Hassan', email: 'omar.hassan@demo.hms', phone: '+971-55-555-0404', identificationType: 'PASSPORT', identificationNumber: 'DEMO-OHA-004' },
  { firstName: 'Maria', lastName: 'Fernandes', email: 'maria.fernandes@demo.hms', phone: '+351-91-555-0505', identificationType: 'PASSPORT', identificationNumber: 'DEMO-MFE-005' },
  { firstName: 'James', lastName: 'Wright', email: 'james.wright@demo.hms', phone: '+61-2-555-0606', identificationType: 'DRIVERS_LICENSE', identificationNumber: 'DEMO-JWR-006' },
  { firstName: 'Fatima', lastName: 'Al Rashid', email: 'fatima.alrashid@demo.hms', phone: '+971-56-555-0707', identificationType: 'PASSPORT', identificationNumber: 'DEMO-FAR-007' },
  { firstName: 'Hiroshi', lastName: 'Tanaka', email: 'hiroshi.tanaka@demo.hms', phone: '+81-90-555-0808', identificationType: 'MY_NUMBER', identificationNumber: 'DEMO-HTA-008' },
];

export async function seedGuests(propertyId: string): Promise<GuestIds> {
  const prisma = getPrismaClient();
  console.log('Seeding guests...');
  const result: Record<string, string> = {};
  for (const g of GUESTS) {
    const key = `guest${g.firstName}`;
    let existing = await prisma.guest.findFirst({ where: { propertyId, email: g.email } });
    if (!existing) {
      existing = await prisma.guest.create({ data: { id: generateUuidV7(), propertyId, firstName: g.firstName, lastName: g.lastName, email: g.email, phone: g.phone, identificationType: g.identificationType, identificationNumber: g.identificationNumber } });
      console.log(`  Created Guest: ${g.firstName} ${g.lastName}`);
    } else { console.log(`  Guest exists: ${g.firstName} ${g.lastName}`); }
    result[key] = existing.id;
  }
  return result as GuestIds;
}
