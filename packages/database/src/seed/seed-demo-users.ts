import * as argon2 from 'argon2';
import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';

export interface DemoUserIds { adminUserId: string; fdeskUserId: string; hkUserId: string; maintUserId: string; }

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
}

const DEMO_USERS = [
  { email: 'admin@tokyograndeur.demo', firstName: 'Platform', lastName: 'Admin', phone: '+81-3-5555-0100', roleCode: 'CORP_ADMIN', scopeType: 'GROUP' },
  { email: 'fdesk@tokyograndeur.demo', firstName: 'Yuki', lastName: 'Tanaka', phone: '+81-90-5555-0201', roleCode: 'FDA', scopeType: 'PROPERTY' },
  { email: 'hk@tokyograndeur.demo', firstName: 'Chen', lastName: 'Wei', phone: '+81-80-5555-0301', roleCode: 'HK_SUPERVISOR', scopeType: 'PROPERTY' },
  { email: 'maint@tokyograndeur.demo', firstName: 'Raj', lastName: 'Patel', phone: '+81-70-5555-0401', roleCode: 'MAINT_TECH', scopeType: 'PROPERTY' },
];

const DEMO_PASSWORD = 'Demo1234!';

export async function seedDemoUsers(propertyId: string, hotelGroupId: string): Promise<DemoUserIds> {
  const prisma = getPrismaClient();
  console.log('Seeding demo users...');
  const result: Record<string, string> = {};
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const emailToKey: Record<string, string> = {
    'admin@tokyograndeur.demo': 'adminUserId',
    'fdesk@tokyograndeur.demo': 'fdeskUserId',
    'hk@tokyograndeur.demo': 'hkUserId',
    'maint@tokyograndeur.demo': 'maintUserId',
  };

  for (const def of DEMO_USERS) {
    let user = await prisma.user.findUnique({ where: { email: def.email } });
    if (!user) {
      user = await prisma.user.create({ data: { id: generateUuidV7(), email: def.email, firstName: def.firstName, lastName: def.lastName, phone: def.phone, status: 'ACTIVE', defaultPropertyId: propertyId } });
      console.log(`  Created User: ${def.firstName} ${def.lastName} (${def.email})`);
    } else { console.log(`  User exists: ${def.firstName} ${def.lastName}`); }
    result[emailToKey[def.email]] = user.id;

    const existingCredential = await prisma.userCredential.findUnique({ where: { userId: user.id } });
    if (!existingCredential) {
      await prisma.userCredential.create({ data: { id: generateUuidV7(), userId: user.id, passwordHash, status: 'ACTIVE' } });
      console.log(`  Created Credential for: ${def.email}`);
    } else if (!existingCredential.passwordHash.startsWith('$argon2')) {
      await prisma.userCredential.update({ where: { userId: user.id }, data: { passwordHash } });
      console.log(`  Updated Credential to argon2id for: ${def.email}`);
    }

    const existingMembership = await prisma.organizationMembership.findFirst({ where: { userId: user.id, hotelGroupId } });
    if (!existingMembership) {
      await prisma.organizationMembership.create({ data: { id: generateUuidV7(), userId: user.id, hotelGroupId, isPrimary: true, status: 'ACTIVE' } });
      console.log(`  Created Membership for: ${def.email}`);
    }

    const role = await prisma.role.findFirst({ where: { code: def.roleCode, hotelGroupId: null, isSystem: true } });
    if (!role) { console.warn(`  Role not found: ${def.roleCode}`); continue; }

    const existingScope = await prisma.userRoleScope.findFirst({ where: { userId: user.id, roleId: role.id, scopeType: def.scopeType } });
    if (!existingScope) {
      const scopeData: Record<string, unknown> = { id: generateUuidV7(), userId: user.id, roleId: role.id, scopeType: def.scopeType };
      if (def.scopeType === 'GROUP') { scopeData.hotelGroupId = hotelGroupId; }
      else if (def.scopeType === 'PROPERTY') { scopeData.propertyId = propertyId; }
      await prisma.userRoleScope.create({ data: scopeData as never });
      console.log(`  Created UserRoleScope: ${def.email} -> ${def.roleCode} [${def.scopeType}]`);
    }
  }
  return result as DemoUserIds;
}
