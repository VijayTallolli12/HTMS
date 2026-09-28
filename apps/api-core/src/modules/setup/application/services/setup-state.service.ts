import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { SetupMilestone, SetupStateType, SetupStatusDto } from '@hms/api-contracts';
import { generateUuidV7 } from '@hms/shared';
import { SETUP_MILESTONES, SETUP_STATES } from '../../domain/setup.constants';

/**
 * Manages the single setup_states ledger row.
 *
 * Design notes:
 * - The row is created lazily on first read/write (no FK dependencies, so it
 *   works on a virgin database).
 * - Derived-on-read fallback recomputes milestones from actual data
 *   (property existence, credentialed user count) so a stale or missing
 *   ledger row self-heals instead of blocking the operator.
 */
@Injectable()
export class SetupStateService {
  private readonly logger = new Logger(SetupStateService.name);

  constructor(private readonly prisma: PrismaService) {}

  private newId(): string {
    return generateUuidV7();
  }

  async ensureSetupRow(tx?: any): Promise<any> {
    const client = tx ?? this.prisma;
    const existing = await client.setupState.findFirst({ orderBy: { createdAt: 'asc' } });
    if (existing) return existing;
    return client.setupState.create({
      data: { id: this.newId(), state: SETUP_STATES.NOT_INITIALIZED, milestones: [] },
    });
  }

  async getRow(): Promise<any> {
    return this.prisma.setupState.findFirst({ orderBy: { createdAt: 'asc' } });
  }

  async addMilestone(milestone: SetupMilestone, tx?: any): Promise<void> {
    const client = tx ?? this.prisma;
    const row = await this.ensureSetupRow(client);
    const milestones: string[] = Array.isArray(row.milestones) ? [...row.milestones] : [];
    if (!milestones.includes(milestone)) {
      milestones.push(milestone);
    }
    await client.setupState.update({
      where: { id: row.id, version: row.version },
      data: { milestones, version: { increment: 1 } },
    });
  }

  async hasMilestone(milestone: SetupMilestone): Promise<boolean> {
    const row = await this.getRow();
    if (!row) return false;
    return Array.isArray(row.milestones) && row.milestones.includes(milestone);
  }

  async setState(state: SetupStateType, lastError?: string | null): Promise<void> {
    const row = await this.ensureSetupRow();
    await this.prisma.setupState.update({
      where: { id: row.id, version: row.version },
      data: { state, lastError: lastError ?? null, version: { increment: 1 } },
    });
  }

  /**
   * Marks initialization started if not already. Returns false when another
   * process is initializing concurrently (optimistic version check + retry).
   */
  async tryBeginInitialization(): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await this.ensureSetupRow();
      if (row.state === SETUP_STATES.ACTIVE) return false;
      const milestones: string[] = Array.isArray(row.milestones) ? row.milestones : [];
      const expected = row.state === SETUP_STATES.INITIALIZING ? row.version : row.version;
      try {
        await this.prisma.setupState.update({
          where: { id: row.id, version: expected },
          data: { state: SETUP_STATES.INITIALIZING, version: { increment: 1 } },
        });
        return true;
      } catch {
        // Optimistic-concurrency loss: reload and retry.
        continue;
      }
    }
    this.logger.warn('tryBeginInitialization: concurrent initialization contention unresolved');
    return false;
  }

  /**
   * Derived-on-read status computation. Recomputes facts from the database so
   * the setup surface is truthful even if the ledger row is missing or stale.
   */
  async getStatus(): Promise<SetupStatusDto> {
    const row = await this.getRow();
    let milestones: string[] = row && Array.isArray(row.milestones) ? [...row.milestones] : [];
    let derived = false;

    const [credentialedUsers, propertyCount] = await Promise.all([
      this.countCredentialedUsers(),
      this.prisma.property.count({ where: { deletedAt: null } }),
    ]);

    // Derived facts always win over ledger state for these two milestones.
    if (credentialedUsers > 0 && !milestones.includes('ADMIN_CREATED')) {
      milestones = [...milestones, 'ADMIN_CREATED'];
      derived = true;
    }
    if (propertyCount > 0 && !milestones.includes('PROPERTY_CREATED')) {
      milestones = [...milestones, 'PROPERTY_CREATED'];
      derived = true;
    }
    if (credentialedUsers === 0 && milestones.includes('ADMIN_CREATED')) {
      milestones = milestones.filter((m) => m !== 'ADMIN_CREATED');
      derived = true;
    }

    let state: SetupStateType =
      row?.state === SETUP_STATES.ACTIVE
        ? SETUP_STATES.ACTIVE
        : row?.state === SETUP_STATES.INITIALIZING
          ? SETUP_STATES.INITIALIZING
          : SETUP_STATES.NOT_INITIALIZED;

    // A completed milestone list implies ACTIVE regardless of ledger staleness.
    if (milestones.includes('COMPLETED') && state !== SETUP_STATES.ACTIVE) {
      state = SETUP_STATES.ACTIVE;
      derived = true;
    }

    const hotelGroupId = (await this.prisma.hotelGroup.findFirst({ select: { id: true }, where: { deletedAt: null } }))?.id ?? null;
    const propertyId = propertyCount > 0
      ? (await this.prisma.property.findFirst({ select: { id: true }, where: { deletedAt: null } }))?.id ?? null
      : null;

    const propertyScope = propertyId ? { propertyId } : { propertyId: '00000000-0000-0000-0000-000000000000' };
    const [roomTypes, rooms, ratePlans, users] = await Promise.all([
      this.prisma.roomType.count({ where: { ...propertyScope, deletedAt: null } }),
      this.prisma.room.count({ where: { ...propertyScope, deletedAt: null } }),
      this.prisma.ratePlan.count({ where: { ...propertyScope, deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);

    // Legacy/seeded databases (e.g. the W1 demo deployment) never ran the W2
    // wizard but are fully operational. Derived-on-read: rooms + rates + users
    // present => treat as ACTIVE so the dashboard never shows setup mode for
    // a property that is actually operating.
    if (state !== SETUP_STATES.ACTIVE && propertyCount > 0 && rooms > 0 && ratePlans > 0 && credentialedUsers > 0) {
      state = SETUP_STATES.ACTIVE;
      derived = true;
    }

    const progress = Math.round((milestones.length / SETUP_MILESTONES.length) * 100);

    return {
      state,
      milestones,
      progress,
      bootstrapEligible: credentialedUsers === 0,
      hotelGroupId,
      propertyId,
      derived,
      counts: {
        properties: propertyCount,
        roomTypes,
        rooms,
        ratePlans,
        users,
      },
    };
  }

  /** Count of ACTIVE users that possess an ACTIVE credential (can actually log in). */
  async countCredentialedUsers(): Promise<number> {
    return this.prisma.userCredential.count({
      where: { status: 'ACTIVE', user: { status: 'ACTIVE', deletedAt: null } },
    });
  }
}
