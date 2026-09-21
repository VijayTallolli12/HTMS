import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';

function getDateOffset(days: number): Date {
  const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + days); return d;
}
function getTimestampOffset(days: number, hours: number = 0): Date {
  const d = new Date(); d.setUTCHours(hours, 0, 0, 0); d.setUTCDate(d.getUTCDate() + days); return d;
}

interface FolioDef {
  reservationConfirmation: string; guestKey: string; folioNumber: string; status: string;
  transactions: Array<{ transactionCode: string; description: string; amount: number; daysOffset: number; hoursOffset: number }>;
  payments: Array<{ amount: number; paymentMethod: string; referenceNumber: string; daysOffset: number; hoursOffset: number }>;
}

const FOLIOS: FolioDef[] = [
  {
    reservationConfirmation: 'DEMO-003', guestKey: 'guestSara', folioNumber: 'F-DEMO-003', status: 'OPEN',
    transactions: [
      { transactionCode: 'ROOM_CHARGE', description: 'Room charge - Night 1 (Presidential Suite)', amount: 150000, daysOffset: -2, hoursOffset: 14 },
      { transactionCode: 'ROOM_CHARGE', description: 'Room charge - Night 2 (Presidential Suite)', amount: 150000, daysOffset: -1, hoursOffset: 14 },
      { transactionCode: 'RESTAURANT', description: 'Restaurant - Sakura Dining (2 guests)', amount: 8500, daysOffset: -1, hoursOffset: 19 },
      { transactionCode: 'MINIBAR', description: 'Minibar - premium spirits & snacks', amount: 3200, daysOffset: 0, hoursOffset: 10 },
    ],
    payments: [{ amount: 200000, paymentMethod: 'CREDIT_CARD', referenceNumber: 'AUTH-DEMO-001', daysOffset: -2, hoursOffset: 15 }],
  },
  {
    reservationConfirmation: 'DEMO-006', guestKey: 'guestJames', folioNumber: 'F-DEMO-006', status: 'OPEN',
    transactions: [
      { transactionCode: 'ROOM_CHARGE', description: 'Room charge - Night 1 (Standard Room)', amount: 25000, daysOffset: -1, hoursOffset: 14 },
      { transactionCode: 'RESTAURANT', description: 'Restaurant - Bento Lunch', amount: 4500, daysOffset: 0, hoursOffset: 12 },
    ],
    payments: [{ amount: 29500, paymentMethod: 'CREDIT_CARD', referenceNumber: 'AUTH-DEMO-006', daysOffset: 0, hoursOffset: 13 }],
  },
  {
    reservationConfirmation: 'DEMO-002', guestKey: 'guestDaniel', folioNumber: 'F-DEMO-002', status: 'OPEN',
    transactions: [], payments: [],
  },
];

export async function seedFolios(propertyId: string, guestIds: Record<string, string>): Promise<void> {
  const prisma = getPrismaClient();
  console.log('Seeding folios...');

  for (const def of FOLIOS) {
    const reservation = await prisma.reservation.findFirst({ where: { propertyId, confirmationNumber: def.reservationConfirmation } });
    if (!reservation) { console.warn(`  Reservation not found: ${def.reservationConfirmation}`); continue; }

    const existingFolio = await prisma.folio.findFirst({ where: { propertyId, reservationId: reservation.id } });
    if (existingFolio) { console.log(`  Folio exists: ${def.folioNumber}`); continue; }

    const guestId = guestIds[def.guestKey];
    const totalCharges = def.transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalPayments = def.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = totalCharges - totalPayments;

    const folio = await prisma.folio.create({
      data: { id: generateUuidV7(), tenantId: propertyId, propertyId, reservationId: reservation.id, guestId, folioNumber: def.folioNumber, status: def.status, currency: 'JPY', balance, idempotencyKey: `seed-folio-${def.folioNumber}-${Date.now()}`, createdBy: 'SYSTEM_SEED' },
    });
    console.log(`  Created Folio: ${def.folioNumber} [balance: ${balance}]`);

    for (const tx of def.transactions) {
      await prisma.folioTransaction.create({
        data: { id: generateUuidV7(), tenantId: propertyId, propertyId, folioId: folio.id, transactionCode: tx.transactionCode, description: tx.description, amount: tx.amount, taxAmount: 0, idempotencyKey: `seed-tx-${def.folioNumber}-${tx.transactionCode}-${tx.daysOffset}-${tx.hoursOffset}`, payloadHash: generateUuidV7(), postedAt: getTimestampOffset(tx.daysOffset, tx.hoursOffset), postedBy: 'SYSTEM_SEED' },
      });
    }
    if (def.transactions.length > 0) { console.log(`  Created ${def.transactions.length} FolioTransactions`); }

    for (const pay of def.payments) {
      await prisma.payment.create({
        data: { id: generateUuidV7(), tenantId: propertyId, propertyId, folioId: folio.id, amount: pay.amount, currency: 'JPY', paymentMethod: pay.paymentMethod, referenceNumber: pay.referenceNumber, status: 'COMPLETED', idempotencyKey: `seed-pay-${def.folioNumber}-${pay.paymentMethod}-${pay.daysOffset}-${pay.hoursOffset}`, payloadHash: generateUuidV7(), processedAt: getTimestampOffset(pay.daysOffset, pay.hoursOffset), processedBy: 'SYSTEM_SEED' },
      });
    }
    if (def.payments.length > 0) { console.log(`  Created ${def.payments.length} Payments`); }
  }
}
