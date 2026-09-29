import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { CredentialService } from '../../../identity/application/services/credential.service';
import { PasswordPolicyService } from '../../../identity/application/services/password-policy.service';
import { AuthThrottleService } from '../../../identity/application/services/auth-throttle.service';
import { HotelGroupService } from '../../../organization/application/services/hotel-group.service';
import { RegionService } from '../../../organization/application/services/region.service';
import { CountryService } from '../../../organization/application/services/country.service';
import { PropertyService } from '../../../organization/application/services/property.service';
import { BuildingService } from '../../../organization/application/services/building.service';
import { FloorService } from '../../../organization/application/services/floor.service';
import { generateUuidV7 } from '@hms/shared';
import {
  BootstrapAdminRequest,
  BootstrapAdminResponse,
  SetupOrganizationRequest,
  SetupOrganizationResponse,
  SetupPropertyRequest,
  SetupPropertyResponse,
  SetupCompleteResponse,
} from '@hms/api-contracts';
import { IamBaselineService } from './iam-baseline.service';
import { SetupStateService } from './setup-state.service';
import { SETUP_AUDIT_ACTIONS, SETUP_STATES, FIRST_ADMIN_ROLE } from '../../domain/setup.constants';
import { SecurityAuditSink } from '../../infrastructure/security-audit.sink';

interface SetupRequestContext {
  userId?: string;
  ip: string;
  correlationId?: string;
  userAgent?: string;
}

/**
 * W2 first-run setup orchestrator.
 *
 * Security model:
 * - Runs on a virgin database where no user exists yet, so the wizard's
 *   bootstrap/organization/property steps are @Public at the transport layer.
 * - Every write re-verifies the "virgin database" condition server-side
 *   (zero ACTIVE users with ACTIVE credentials). The window closes
 *   permanently after the first administrator exists.
 * - Once any credentialed user exists, setup mutations require an
 *   authenticated administrator (CORP_ADMIN / PROPERTY_GM).
 *
 * Reuse model:
 * - Organization and property creation delegate to the existing organization
 *   services (validation, outbox events, conflict handling).
 * - Each step is retry-safe: natural-key idempotent branches self-heal a
 *   partially completed prior attempt (e.g. group created but country missing).
 */
@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialService: CredentialService,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly authThrottleService: AuthThrottleService,
    private readonly hotelGroupService: HotelGroupService,
    private readonly regionService: RegionService,
    private readonly countryService: CountryService,
    private readonly propertyService: PropertyService,
    private readonly buildingService: BuildingService,
    private readonly floorService: FloorService,
    private readonly iamBaselineService: IamBaselineService,
    private readonly setupStateService: SetupStateService,
    private readonly auditSink: SecurityAuditSink,
  ) {}

  // ===========================================================================
  // Phase 3 — Bootstrap admin
  // ===========================================================================

  async bootstrapAdmin(
    dto: BootstrapAdminRequest,
    ctx: SetupRequestContext,
  ): Promise<BootstrapAdminResponse> {
    await this.iamBaselineService.ensureBaseline();

    const email = dto.email.trim().toLowerCase();
    await this.authThrottleService.assertNotThrottled(ctx.ip, email);

    const credentialedUsers = await this.setupStateService.countCredentialedUsers();
    if (credentialedUsers > 0) {
      // Deliberately indistinguishable from a throttled attempt to avoid
      // leaking setup state to unauthenticated callers.
      await this.authThrottleService.recordFailedAttempt(ctx.ip, email);
      throw new ForbiddenException('Setup is already completed. Sign in to continue.');
    }

    await this.passwordPolicyService.assertValidAndNotBreached(dto.password);

    // Idempotent replay check MUST precede the role lookup: a replay against a
    // database where roles were dropped must still return the existing admin
    // rather than failing on missing IAM baseline rows.
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const isValid = await this.credentialService.verifyCredential(existingUser.id, dto.password);
      if (isValid) {
        const scope = await this.prisma.userRoleScope.findFirst({
          where: { userId: existingUser.id },
          include: { role: true },
        });
        const replayType = dto.organizationType === 'CHAIN' ? 'CHAIN' : 'INDEPENDENT';
        const replayAssignment = FIRST_ADMIN_ROLE[replayType];
        return {
          userId: existingUser.id,
          email: existingUser.email,
          roleCode: scope?.role?.code ?? replayAssignment.roleCode,
          scopeType: (scope?.scopeType as 'PROPERTY' | 'GROUP') ?? replayAssignment.scopeType,
          idempotentReplay: true,
        };
      }
      await this.authThrottleService.recordFailedAttempt(ctx.ip, email);
      throw new ConflictException('An account with this email already exists.');
    }

    const organizationType = dto.organizationType === 'CHAIN' ? 'CHAIN' : 'INDEPENDENT';
    const assignment = FIRST_ADMIN_ROLE[organizationType];
    const role = await this.prisma.role.findFirst({
      where: { code: assignment.roleCode, hotelGroupId: null, isSystem: true },
    });
    if (!role) {
      throw new ConflictException(
        `Required first-admin role '${assignment.roleCode}' is not available in the IAM baseline.`,
      );
    }

    const existingGroup = await this.prisma.hotelGroup.findFirst({ where: { deletedAt: null } });
    const existingProperty = await this.prisma.property.findFirst({ where: { deletedAt: null } });

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: generateUuidV7(),
          email,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone?.trim() || null,
          status: 'ACTIVE',
        },
      });

      // Reuses CredentialService (argon2id + policy + breached check); the
      // optional tx parameter keeps user + credential atomic.
      await this.credentialService.createCredential(user.id, dto.password, tx);

      if (existingGroup) {
        await tx.organizationMembership.create({
          data: {
            id: generateUuidV7(),
            userId: user.id,
            hotelGroupId: existingGroup.id,
            isPrimary: true,
            status: 'ACTIVE',
          },
        });
      }

      const scopeData: Record<string, unknown> = {
        id: generateUuidV7(),
        userId: user.id,
        roleId: role.id,
        scopeType: assignment.scopeType,
      };
      if (existingGroup && assignment.scopeType === 'GROUP') {
        scopeData.hotelGroupId = existingGroup.id;
      }
      if (existingProperty && assignment.scopeType === 'PROPERTY') {
        scopeData.propertyId = existingProperty.id;
        await tx.user.update({
          where: { id: user.id },
          data: { defaultPropertyId: existingProperty.id },
        });
      }
      const scope = await tx.userRoleScope.create({ data: scopeData as never });

      await this.setupStateService.addMilestone('ADMIN_CREATED', tx);

      return { user, scope };
    });

    await this.auditSink.record({
      action: SETUP_AUDIT_ACTIONS.SETUP_ADMIN_CREATED,
      outcome: 'SUCCESS',
      actorId: created.user.id,
      actorType: 'USER',
      resourceType: 'USER',
      resourceId: created.user.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
      details: {
        email,
        roleCode: assignment.roleCode,
        scopeType: assignment.scopeType,
        organizationType,
      },
    });

    await this.authThrottleService.resetAccountThrottle(email);

    return {
      userId: created.user.id,
      email,
      roleCode: assignment.roleCode,
      scopeType: assignment.scopeType,
      idempotentReplay: false,
    };
  }

  // ===========================================================================
  // Phase 4 — Organization setup
  // ===========================================================================

  async setupOrganization(
    dto: SetupOrganizationRequest,
    ctx: SetupRequestContext,
  ): Promise<SetupOrganizationResponse> {
    await this.assertSetupWritesAllowed(ctx);
    await this.iamBaselineService.ensureBaseline();

    const code = dto.code.trim().toUpperCase().replace(/\s+/g, '-');
    const countryCode = dto.countryCode.trim().toUpperCase();
    const regionCode = (dto.regionCode?.trim() || 'DEFAULT').toUpperCase();
    const regionName = dto.regionName?.trim() || 'Default Region';
    const countryName = dto.countryName?.trim() || countryCode;

    // Idempotent branch: group already exists (prior attempt or pre-existing
    // org). Self-heal missing hierarchy pieces, then return the replay.
    const existingGroup = await this.prisma.hotelGroup.findUnique({ where: { code } });
    if (existingGroup) {
      const region = await this.ensureRegion(existingGroup.id, regionCode, regionName);
      const country = await this.ensureCountry(region.id, countryCode, countryName);
      await this.linkAdminToGroup(existingGroup.id);
      await this.prisma.setupState.updateMany({
        where: { state: { not: SETUP_STATES.ACTIVE } },
        data: { hotelGroupId: existingGroup.id, state: SETUP_STATES.INITIALIZING },
      });
      return {
        hotelGroupId: existingGroup.id,
        hotelGroupCode: existingGroup.code,
        regionId: region.id,
        countryId: country.id,
        countryCode: country.code,
        idempotentReplay: true,
      };
    }

    await this.setupStateService.tryBeginInitialization();

    try {
      // Reuse of existing organization services (each with its own small
      // transaction, validation, and outbox event). Retry-safety is provided
      // by the natural-key self-healing branch above.
      const group = await this.hotelGroupService.create(
        { code, name: dto.name.trim(), description: dto.description },
        { correlationId: ctx.correlationId },
      );
      const region = await this.regionService.create(
        { hotelGroupId: group.id, code: regionCode, name: regionName },
        { correlationId: ctx.correlationId },
      );
      const country = await this.countryService.create(
        { regionId: region.id, code: countryCode, name: countryName },
        { correlationId: ctx.correlationId },
      );

      const row = await this.setupStateService.ensureSetupRow();
      await this.prisma.setupState.update({
        where: { id: row.id, version: row.version },
        data: {
          hotelGroupId: group.id,
          state: row.state === SETUP_STATES.ACTIVE ? row.state : SETUP_STATES.INITIALIZING,
          version: { increment: 1 },
        },
      });

      await this.linkAdminToGroup(group.id);

      await this.auditSink.record({
        action: SETUP_AUDIT_ACTIONS.SETUP_ORGANIZATION_CREATED,
        outcome: 'SUCCESS',
        actorId: ctx.userId,
        actorType: ctx.userId ? 'USER' : 'SYSTEM',
        resourceType: 'HOTEL_GROUP',
        resourceId: group.id,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        correlationId: ctx.correlationId,
        details: { type: dto.type, code, regionCode, countryCode },
      });

      return {
        hotelGroupId: group.id,
        hotelGroupCode: group.code,
        regionId: region.id,
        countryId: country.id,
        countryCode: country.code,
        idempotentReplay: false,
      };
    } catch (err) {
      await this.setupStateService
        .setState(SETUP_STATES.NOT_INITIALIZED, String((err as Error)?.message ?? err))
        .catch(() => undefined);
      throw err;
    }
  }

  // ===========================================================================
  // Phase 5 — Property setup
  // ===========================================================================

  async setupProperty(
    dto: SetupPropertyRequest,
    ctx: SetupRequestContext,
  ): Promise<SetupPropertyResponse> {
    await this.assertSetupWritesAllowed(ctx);

    const code = dto.code.trim();

    // Idempotent branch: property exists (prior attempt). Self-heal missing
    // MAIN building / 00 floor / business date, then return the replay.
    const existing = await this.prisma.property.findUnique({ where: { code } });
    if (existing && !existing.deletedAt) {
      const building = await this.ensureMainBuilding(existing.id);
      const floor = await this.ensureGroundFloor(building.id);
      await this.ensureBusinessDate(existing.id, existing.timeZone);
      await this.linkAdminToProperty(existing.id);
      const bd = await this.prisma.propertyBusinessDate.findUnique({ where: { propertyId: existing.id } });
      return {
        propertyId: existing.id,
        buildingId: building.id,
        floorId: floor.id,
        businessDate: bd ? this.toBusinessDateString(bd.currentBusinessDate) : null,
        idempotentReplay: true,
      };
    }
    if (existing && existing.deletedAt) {
      throw new ConflictException(
        `Property code '${code}' was previously used by a deleted property.`,
      );
    }

    await this.setupStateService.tryBeginInitialization();

    try {
      // Reuse PropertyService.create: country validation, IANA timezone
      // validation, code-conflict check, outbox event, own transaction.
      const property = await this.propertyService.create(
        {
          countryId: dto.countryId,
          code,
          name: dto.name.trim(),
          legalName: dto.legalName,
          timeZone: dto.timeZone,
          currency: dto.currency,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          stateProvince: dto.stateProvince,
          postalCode: dto.postalCode,
          phone: dto.phone,
          email: dto.email,
        },
        { correlationId: ctx.correlationId },
      );

      const building = await this.ensureMainBuilding(property.id);
      const floor = await this.ensureGroundFloor(building.id);
      await this.ensureBusinessDate(property.id, property.timeZone);

      const row = await this.setupStateService.ensureSetupRow();
      const milestones: string[] = Array.isArray(row.milestones) ? [...row.milestones] : [];
      if (!milestones.includes('PROPERTY_CREATED')) milestones.push('PROPERTY_CREATED');
      await this.prisma.setupState.update({
        where: { id: row.id, version: row.version },
        data: {
          propertyId: property.id,
          milestones,
          state: row.state === SETUP_STATES.ACTIVE ? row.state : SETUP_STATES.INITIALIZING,
          version: { increment: 1 },
        },
      });

      await this.linkAdminToProperty(property.id);

      await this.auditSink.record({
        action: SETUP_AUDIT_ACTIONS.SETUP_PROPERTY_CREATED,
        outcome: 'SUCCESS',
        actorId: ctx.userId,
        actorType: ctx.userId ? 'USER' : 'SYSTEM',
        resourceType: 'PROPERTY',
        resourceId: property.id,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        correlationId: ctx.correlationId,
        details: {
          code: property.code,
          timeZone: property.timeZone,
          currency: property.currency,
        },
      });

      const bd = await this.prisma.propertyBusinessDate.findUnique({ where: { propertyId: property.id } });
      return {
        propertyId: property.id,
        buildingId: building.id,
        floorId: floor.id,
        businessDate: bd ? this.toBusinessDateString(bd.currentBusinessDate) : null,
        idempotentReplay: false,
      };
    } catch (err) {
      await this.setupStateService
        .setState(SETUP_STATES.INITIALIZING, String((err as Error)?.message ?? err))
        .catch(() => undefined);
      throw err;
    }
  }

  // ===========================================================================
  // Phase 6 — Completion
  // ===========================================================================

  async complete(ctx: SetupRequestContext): Promise<SetupCompleteResponse> {
    if (!ctx.userId) {
      throw new ForbiddenException('Authentication required to complete setup.');
    }
    await this.assertSetupWritesAllowed(ctx);

    const status = await this.setupStateService.getStatus();
    if (status.state === SETUP_STATES.ACTIVE) {
      return { state: status.state, milestones: status.milestones, progress: status.progress };
    }

    const required: string[] = ['ADMIN_CREATED', 'PROPERTY_CREATED'];
    const missing = required.filter((m) => !status.milestones.includes(m));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Setup cannot be completed yet. Missing milestones: ${missing.join(', ')}.`,
      );
    }

    const row = await this.setupStateService.ensureSetupRow();
    const milestones: string[] = Array.isArray(row.milestones) ? [...row.milestones] : [];
    for (const m of required) {
      if (!milestones.includes(m)) milestones.push(m);
    }
    if (!milestones.includes('COMPLETED')) milestones.push('COMPLETED');

    await this.prisma.setupState.update({
      where: { id: row.id, version: row.version },
      data: { state: SETUP_STATES.ACTIVE, milestones, version: { increment: 1 } },
    });

    await this.auditSink.record({
      action: SETUP_AUDIT_ACTIONS.SETUP_COMPLETED,
      outcome: 'SUCCESS',
      actorId: ctx.userId,
      actorType: 'USER',
      resourceType: 'SETUP_STATE',
      resourceId: row.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
      details: { milestones },
    });

    return { state: SETUP_STATES.ACTIVE, milestones, progress: 100 };
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  private async assertSetupWritesAllowed(ctx: SetupRequestContext): Promise<void> {
    const credentialedUsers = await this.setupStateService.countCredentialedUsers();
    if (credentialedUsers === 0) return; // virgin window open
    if (!ctx.userId) {
      throw new ForbiddenException('Setup is already completed. Sign in to continue.');
    }
    const isAdmin = await this.prisma.userRoleScope.findFirst({
      where: {
        userId: ctx.userId,
        role: { code: { in: ['CORP_ADMIN', 'PROPERTY_GM'] }, isSystem: true },
      },
    });
    if (!isAdmin) {
      throw new ForbiddenException('Administrator role required for setup operations.');
    }
  }

  private async ensureRegion(hotelGroupId: string, code: string, name: string) {
    const existing = await this.prisma.region.findFirst({ where: { hotelGroupId, code } });
    if (existing) return existing;
    return this.regionService.create({ hotelGroupId, code, name });
  }

  private async ensureCountry(regionId: string, code: string, name: string) {
    const existing = await this.prisma.country.findFirst({ where: { regionId, code } });
    if (existing) return existing;
    return this.countryService.create({ regionId, code, name });
  }

  private async ensureMainBuilding(propertyId: string) {
    const existing = await this.prisma.building.findFirst({
      where: { propertyId, code: 'MAIN', deletedAt: null },
    });
    if (existing) return existing;
    return this.buildingService.create({ propertyId, code: 'MAIN', name: 'Main Building' });
  }

  private async ensureGroundFloor(buildingId: string) {
    const existing = await this.prisma.floor.findFirst({
      where: { buildingId, code: '00', deletedAt: null },
    });
    if (existing) return existing;
    return this.floorService.create({
      buildingId,
      code: '00',
      name: 'Ground Floor',
      floorNumber: 0,
    });
  }

  /**
   * Ensures the PropertyBusinessDate row exists, computing the business date
   * with the same Intl('en-CA', timeZone) semantics as the production
   * PropertyBusinessDateService. The service itself lazily self-heals on
   * first operational use; this only pre-seeds the row.
   */
  private async ensureBusinessDate(propertyId: string, timeZone: string): Promise<void> {
    const existing = await this.prisma.propertyBusinessDate.findUnique({ where: { propertyId } });
    if (existing) return;
    const businessDate = this.resolveBusinessDate(new Date(), timeZone);
    await this.prisma.propertyBusinessDate.create({
      data: { propertyId, currentBusinessDate: businessDate },
    });
  }

  private resolveBusinessDate(instant: Date, timeZone: string): Date {
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
    return new Date(`${formatted}T00:00:00.000Z`);
  }

  private toBusinessDateString(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private async linkAdminToGroup(hotelGroupId: string): Promise<void> {
    // Platform-level users (GLOBAL scope, e.g. PLATFORM_OWNER) must never be
    // linked into a client organization: they survive installation resets and
    // would otherwise pin a deleted hotel group via FK RESTRICT.
    const bootstrapUser = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        memberships: { none: { hotelGroupId } },
        roleScopes: { none: { scopeType: 'GLOBAL' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (bootstrapUser) {
      const hasAnyMembership = await this.prisma.organizationMembership.count({
        where: { userId: bootstrapUser.id },
      });
      if (hasAnyMembership === 0) {
        await this.prisma.organizationMembership.create({
          data: {
            id: generateUuidV7(),
            userId: bootstrapUser.id,
            hotelGroupId,
            isPrimary: true,
            status: 'ACTIVE',
          },
        });
      }
      await this.prisma.userRoleScope.updateMany({
        where: { userId: bootstrapUser.id, hotelGroupId: null, scopeType: 'GROUP' },
        data: { hotelGroupId },
      });
    }
    await this.prisma.setupState.updateMany({ data: { hotelGroupId } });
  }

  private async linkAdminToProperty(propertyId: string): Promise<void> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return;

    const gmScopes = await this.prisma.userRoleScope.findMany({
      where: { role: { code: 'PROPERTY_GM' }, propertyId: null },
      select: { id: true, userId: true },
    });
    if (gmScopes.length === 0) return;

    const users = await this.prisma.user.findMany({
      where: { id: { in: gmScopes.map((s) => s.userId) }, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const target = gmScopes.find((s) => users.some((u) => u.id === s.userId));
    if (target) {
      await this.prisma.userRoleScope.update({ where: { id: target.id }, data: { propertyId } });
      await this.prisma.user.update({
        where: { id: target.userId },
        data: { defaultPropertyId: propertyId },
      });
    }
  }
}
