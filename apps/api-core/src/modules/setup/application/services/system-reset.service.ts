import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../common/database/prisma.service';
import { RedisService } from '../../../../common/redis/redis.service';
import { SecurityConfig } from '@hms/config';
import { generateUuidV7 } from '@hms/shared';
import { SecurityAuditSink } from '../../infrastructure/security-audit.sink';
import { SetupStateService } from './setup-state.service';
import { SETUP_STATES, SETUP_AUDIT_ACTIONS } from '../../domain/setup.constants';

interface SystemResetContext {
  userId: string;
  ip: string;
  correlationId?: string;
  userAgent?: string;
}

interface DeletionCounts {
  [key: string]: number;
}

/**
 * W3 System Reset Service.
 *
 * Returns an ACTIVE installation to NOT_INITIALIZED by removing all
 * installation-owned data while preserving platform-level IAM baseline,
 * migration history, and system configuration.
 *
 * Deletion order follows FK dependencies (child-most first).
 * All deletions are scoped to the installation's hotel groups/properties.
 * Platform-level users with GLOBAL scope (PLATFORM_OWNER) are preserved.
 */
@Injectable()
export class SystemResetService {
  private readonly logger = new Logger(SystemResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly setupStateService: SetupStateService,
    private readonly auditSink: SecurityAuditSink,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Execute the full system reset.
   * Returns deletion counts by domain for audit purposes.
   */
  async reset(ctx: SystemResetContext, confirmationPhrase: string): Promise<DeletionCounts> {
    const expectedPhrase = 'RESET INSTALLATION';
    if (confirmationPhrase !== expectedPhrase) {
      // Deliberately does NOT echo the expected phrase and returns 400 (not 500).
      throw new BadRequestException('Invalid confirmation phrase.');
    }

    const started = Date.now();
    const counts: DeletionCounts = {};

    // Capture pre-reset state for audit
    const preResetStatus = await this.setupStateService.getStatus();
    const hotelGroupId = preResetStatus.hotelGroupId;
    const propertyId = preResetStatus.propertyId;

    await this.auditSink.record({
      action: SETUP_AUDIT_ACTIONS.SYSTEM_INSTALLATION_RESET,
      outcome: 'SUCCESS',
      actorId: ctx.userId,
      actorType: 'USER',
      resourceType: 'SYSTEM',
      resourceId: 'installation',
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
      details: {
        phase: 'STARTED',
        hotelGroupId,
        propertyId,
      },
    });

    try {
      // Phase 1: Delete all property-scoped operational data (child-most first)
      // This must be done for ALL properties in the installation
      const properties = await this.prisma.property.findMany({
        where: { deletedAt: null },
        select: { id: true, code: true, name: true, countryId: true },
      });

      // Phase 0: Unlink installation users' IAM rows BEFORE deleting properties
      // and organization nodes: user_role_scopes and organization_memberships
      // hold ON DELETE RESTRICT foreign keys against properties and hotel
      // groups. Sessions are captured here for Redis fast-revocation.
      const { sessionIds, userIds } = await this.unlinkInstallationUsers(counts);
      await this.revokeSessionsInRedis(sessionIds);

      // Phase 0b: Defense-in-depth — drop ANY organization membership that
      // still points at an installation-owned hotel group (platform-level
      // users keep their user row and GLOBAL role, but a stale membership
      // into a client org would violate FK RESTRICT when the group deletes).
      const groupIds = (
        await this.prisma.hotelGroup.findMany({ where: { deletedAt: null }, select: { id: true } })
      ).map((g: { id: string }) => g.id);
      if (groupIds.length > 0) {
        counts.organizationMembership = (counts.organizationMembership ?? 0)
          + await this.deleteManyCount(() => this.prisma.organizationMembership.deleteMany({ where: { hotelGroupId: { in: groupIds } } }));
      }

      for (const property of properties) {
        await this.deletePropertyData(property.id, counts);
      }

      // Phase 2: Delete properties themselves
      counts.property = await this.deleteManyCount(() => this.prisma.property.deleteMany({ where: { deletedAt: null } }));

      // Phase 3: Delete buildings and floors (already deleted in deletePropertyData but just in case)
      // Note: buildings and floors are deleted in deletePropertyData via cascading from property

      // Phase 4: Delete countries, regions, hotel groups that have no remaining properties
      await this.deleteEmptyOrganizationHierarchy(counts);

      // Phase 5: Delete installation user rows now that all FK restrictors are
      // gone. (IAM unlinking + session revocation happened in Phase 0.)
      await this.deleteInstallationUserRows(counts, userIds);

      // Phase 6: Reset SetupState to NOT_INITIALIZED.
      // Milestones must be cleared too: derived-on-read status treats a stale
      // COMPLETED milestone as ACTIVE, which would make the installation appear
      // active again (blocking bootstrap) even after the ledger state flips.
      const ledgerRow = await this.setupStateService.getRow();
      if (ledgerRow && Array.isArray(ledgerRow.milestones) && ledgerRow.milestones.length > 0) {
        await this.prisma.setupState.update({
          where: { id: ledgerRow.id, version: ledgerRow.version },
          data: { milestones: [], version: { increment: 1 } },
        });
      }
      await this.setupStateService.setState(SETUP_STATES.NOT_INITIALIZED, null);

      // Phase 7: Clear any cached authorization data
      // (Authorization cache invalidation happens automatically on role/user deletion)

      const durationMs = Date.now() - started;

      await this.auditSink.record({
        action: SETUP_AUDIT_ACTIONS.SYSTEM_INSTALLATION_RESET,
        outcome: 'SUCCESS',
        actorId: ctx.userId,
        actorType: 'USER',
        resourceType: 'SYSTEM',
        resourceId: 'installation',
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        correlationId: ctx.correlationId,
        details: {
          phase: 'COMPLETED',
          durationMs,
          counts,
          preReset: {
            hotelGroupId,
            propertyId,
            state: preResetStatus.state,
            milestones: preResetStatus.milestones,
          },
        },
      });

      this.logger.log(`System reset completed in ${durationMs}ms`, counts);
      return counts;
    } catch (err: any) {
      const durationMs = Date.now() - started;
      await this.auditSink.record({
        action: SETUP_AUDIT_ACTIONS.SYSTEM_INSTALLATION_RESET,
        outcome: 'FAILURE',
        actorId: ctx.userId,
        actorType: 'USER',
        resourceType: 'SYSTEM',
        resourceId: 'installation',
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        correlationId: ctx.correlationId,
        details: {
          phase: 'FAILED',
          durationMs,
          error: String(err?.message ?? err),
          partialCounts: counts,
        },
      });
      throw err;
    }
  }

  /**
   * Delete all data scoped to a specific property.
   * Order: child-most tables first (FK dependencies).
   */
  private async deletePropertyData(propertyId: string, counts: DeletionCounts): Promise<void> {
    // Finance (child-most: payments -> transactions -> folios)
    counts.payment = await this.deleteManyCount(() => this.prisma.payment.deleteMany({ where: { propertyId } }));
    counts.folioTransaction = await this.deleteManyCount(() => this.prisma.folioTransaction.deleteMany({ where: { propertyId } }));
    counts.paymentIntent = await this.deleteManyCount(() => this.prisma.paymentIntent.deleteMany({ where: { propertyId } }));
    counts.paymentGatewayTransaction = await this.deleteManyCount(() => this.prisma.paymentGatewayTransaction.deleteMany({ where: { propertyId } }));
    counts.paymentWebhook = await this.deleteManyCount(() => this.prisma.paymentWebhook.deleteMany({ where: { propertyId } }));
    counts.folio = await this.deleteManyCount(() => this.prisma.folio.deleteMany({ where: { propertyId } }));

    // Reservations
    counts.reservationRateNight = await this.deleteManyCount(() => this.prisma.reservationRateNight.deleteMany({ where: { propertyId } }));
    counts.reservation = await this.deleteManyCount(() => this.prisma.reservation.deleteMany({ where: { propertyId } }));

    // Housekeeping
    counts.housekeepingTask = await this.deleteManyCount(() => this.prisma.housekeepingTask.deleteMany({ where: { propertyId } }));

    // Room operations
    counts.roomStatusLog = await this.deleteManyCount(() => this.prisma.roomStatusLog.deleteMany({ where: { propertyId } }));
    counts.reservationAssignmentLog = await this.deleteManyCount(() => this.prisma.reservationAssignmentLog.deleteMany({ where: { propertyId } }));
    counts.roomMaintenanceBlock = await this.deleteManyCount(() => this.prisma.roomMaintenanceBlock.deleteMany({ where: { propertyId } }));

    // Engineering
    counts.workOrder = await this.deleteManyCount(() => this.prisma.workOrder.deleteMany({ where: { propertyId } }));
    counts.maintenanceSchedule = await this.deleteManyCount(() => this.prisma.maintenanceSchedule.deleteMany({ where: { propertyId } }));
    counts.asset = await this.deleteManyCount(() => this.prisma.asset.deleteMany({ where: { propertyId } }));

    // Spa
    counts.spaAppointment = await this.deleteManyCount(() => this.prisma.spaAppointment.deleteMany({ where: { propertyId } }));
    counts.spaTherapist = await this.deleteManyCount(() => this.prisma.spaTherapist.deleteMany({ where: { propertyId } }));
    counts.spaRoom = await this.deleteManyCount(() => this.prisma.spaRoom.deleteMany({ where: { propertyId } }));
    counts.spaServiceAddon = await this.deleteManyCount(() => this.prisma.spaServiceAddon.deleteMany({ where: { propertyId } }));
    counts.spaService = await this.deleteManyCount(() => this.prisma.spaService.deleteMany({ where: { propertyId } }));
    counts.spaServiceCategory = await this.deleteManyCount(() => this.prisma.spaServiceCategory.deleteMany({ where: { propertyId } }));

    // Events
    counts.eventBooking = await this.deleteManyCount(() => this.prisma.eventBooking.deleteMany({ where: { propertyId } }));
    counts.eventResource = await this.deleteManyCount(() => this.prisma.eventResource.deleteMany({ where: { propertyId } }));
    counts.eventPackage = await this.deleteManyCount(() => this.prisma.eventPackage.deleteMany({ where: { propertyId } }));
    counts.eventVenue = await this.deleteManyCount(() => this.prisma.eventVenue.deleteMany({ where: { propertyId } }));

    // CRM & Loyalty
    counts.loyaltyTransaction = await this.deleteManyCount(() => this.prisma.loyaltyTransaction.deleteMany({ where: { propertyId } }));
    counts.loyaltyMembership = await this.deleteManyCount(() => this.prisma.loyaltyMembership.deleteMany({ where: { propertyId } }));
    counts.guestPreference = await this.deleteManyCount(() => this.prisma.guestPreference.deleteMany({ where: { propertyId } }));
    counts.guestCrmProfile = await this.deleteManyCount(() => this.prisma.guestCrmProfile.deleteMany({ where: { propertyId } }));
    counts.guest = await this.deleteManyCount(() => this.prisma.guest.deleteMany({ where: { propertyId } }));

    // F&B
    counts.fnbOrderItem = await this.deleteManyCount(() => this.prisma.fnbOrderItem.deleteMany({ where: { order: { propertyId } } }));
    counts.fnbOrder = await this.deleteManyCount(() => this.prisma.fnbOrder.deleteMany({ where: { propertyId } }));
    counts.fnbMenuItemVariant = await this.deleteManyCount(() => this.prisma.fnbMenuItemVariant.deleteMany({ where: { propertyId } }));
    counts.fnbMenuItem = await this.deleteManyCount(() => this.prisma.fnbMenuItem.deleteMany({ where: { propertyId } }));
    counts.fnbMenuCategory = await this.deleteManyCount(() => this.prisma.fnbMenuCategory.deleteMany({ where: { propertyId } }));
    counts.restaurantTable = await this.deleteManyCount(() => this.prisma.restaurantTable.deleteMany({ where: { outlet: { propertyId } } }));
    counts.fnbOutlet = await this.deleteManyCount(() => this.prisma.fnbOutlet.deleteMany({ where: { propertyId } }));

    // HR & Payroll
    counts.payrollLine = await this.deleteManyCount(() => this.prisma.payrollLine.deleteMany({ where: { propertyId } }));
    counts.payrollRun = await this.deleteManyCount(() => this.prisma.payrollRun.deleteMany({ where: { propertyId } }));
    counts.payrollPeriod = await this.deleteManyCount(() => this.prisma.payrollPeriod.deleteMany({ where: { propertyId } }));
    counts.employeeCompensation = await this.deleteManyCount(() => this.prisma.employeeCompensation.deleteMany({ where: { propertyId } }));
    counts.employee = await this.deleteManyCount(() => this.prisma.employee.deleteMany({ where: { propertyId } }));

    // Procurement
    counts.stockBalance = await this.deleteManyCount(() => this.prisma.stockBalance.deleteMany({ where: { propertyId } }));
    counts.goodsReceipt = await this.deleteManyCount(() => this.prisma.goodsReceipt.deleteMany({ where: { propertyId } }));
    counts.purchaseOrderItem = await this.deleteManyCount(() => this.prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { propertyId } } }));
    counts.purchaseOrder = await this.deleteManyCount(() => this.prisma.purchaseOrder.deleteMany({ where: { propertyId } }));
    counts.inventoryItem = await this.deleteManyCount(() => this.prisma.inventoryItem.deleteMany({ where: { propertyId } }));
    counts.supplier = await this.deleteManyCount(() => this.prisma.supplier.deleteMany({ where: { propertyId } }));

    // Revenue / PMS core
    counts.dailyRate = await this.deleteManyCount(() => this.prisma.dailyRate.deleteMany({ where: { propertyId } }));
    counts.dailyInventory = await this.deleteManyCount(() => this.prisma.dailyInventory.deleteMany({ where: { propertyId } }));
    counts.ratePlanRoomType = await this.deleteManyCount(() => this.prisma.ratePlanRoomType.deleteMany({ where: { propertyId } }));
    counts.ratePlan = await this.deleteManyCount(() => this.prisma.ratePlan.deleteMany({ where: { propertyId } }));
    counts.room = await this.deleteManyCount(() => this.prisma.room.deleteMany({ where: { propertyId } }));
    counts.roomType = await this.deleteManyCount(() => this.prisma.roomType.deleteMany({ where: { propertyId } }));

    // Property business date & night audit
    counts.propertyBusinessDate = await this.deleteManyCount(() => this.prisma.propertyBusinessDate.deleteMany({ where: { propertyId } }));
    counts.nightAuditRun = await this.deleteManyCount(() => this.prisma.nightAuditRun.deleteMany({ where: { propertyId } }));

    // Floors & Buildings
    counts.floor = await this.deleteManyCount(() => this.prisma.floor.deleteMany({ where: { building: { propertyId } } }));
    counts.building = await this.deleteManyCount(() => this.prisma.building.deleteMany({ where: { propertyId } }));

    // Integrations
    counts.integration = await this.deleteManyCount(() => this.prisma.integration.deleteMany({ where: { propertyId } }));
    counts.integrationSyncLog = await this.deleteManyCount(() => this.prisma.integrationSyncLog.deleteMany({ where: { propertyId } }));
    counts.channelConfig = await this.deleteManyCount(() => this.prisma.channelConfig.deleteMany({ where: { propertyId } }));
    counts.channelSyncLog = await this.deleteManyCount(() => this.prisma.channelSyncLog.deleteMany({ where: { propertyId } }));

    // Payment providers
    counts.paymentProviderConfig = await this.deleteManyCount(() => this.prisma.paymentProviderConfig.deleteMany({ where: { propertyId } }));

    // Email
    counts.emailProviderConfig = await this.deleteManyCount(() => this.prisma.emailProviderConfig.deleteMany({ where: { propertyId } }));
    counts.emailTemplate = await this.deleteManyCount(() => this.prisma.emailTemplate.deleteMany({ where: { propertyId } }));
    counts.email = await this.deleteManyCount(() => this.prisma.email.deleteMany({ where: { propertyId } }));
    counts.emailWebhook = await this.deleteManyCount(() => this.prisma.emailWebhook.deleteMany({ where: { propertyId } }));

    // WhatsApp
    counts.whatsAppProviderConfig = await this.deleteManyCount(() => this.prisma.whatsAppProviderConfig.deleteMany({ where: { propertyId } }));
    counts.whatsAppTemplate = await this.deleteManyCount(() => this.prisma.whatsAppTemplate.deleteMany({ where: { propertyId } }));
    counts.whatsAppMessage = await this.deleteManyCount(() => this.prisma.whatsAppMessage.deleteMany({ where: { propertyId } }));
    counts.whatsAppWebhook = await this.deleteManyCount(() => this.prisma.whatsAppWebhook.deleteMany({ where: { propertyId } }));

    // Competitor sets
    counts.competitorSet = await this.deleteManyCount(() => this.prisma.competitorSet.deleteMany({ where: { propertyId } }));

    // Market rate providers
    counts.marketRateProvider = await this.deleteManyCount(() => this.prisma.marketRateProvider.deleteMany({ where: { propertyId } }));
  }

  /**
   * Delete countries, regions, hotel groups that have no remaining properties.
   * Only deletes those that are now empty (no properties referencing them).
   */
  private async deleteEmptyOrganizationHierarchy(counts: DeletionCounts): Promise<void> {
    // Find all hotel groups
    const hotelGroups = await this.prisma.hotelGroup.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true },
    });

    for (const group of hotelGroups) {
      const regions = await this.prisma.region.findMany({ where: { hotelGroupId: group.id } });
      let allEmpty = true;

      for (const region of regions) {
        const countries = await this.prisma.country.findMany({ where: { regionId: region.id }, select: { id: true } });
        const countryIds = countries.map((c) => c.id);

        // Check if any property still references these countries
        const remainingProps = await this.prisma.property.count({
          where: { countryId: { in: countryIds }, deletedAt: null },
        });

        if (remainingProps === 0) {
          counts.country = (counts.country ?? 0) + (await this.deleteManyCount(() => this.prisma.country.deleteMany({ where: { regionId: region.id } })));
        } else {
          allEmpty = false;
        }
      }

      // Check if hotel group has any remaining properties
      if (allEmpty) {
        const remainingGroupProps = await this.prisma.property.count({
          where: {
            countryId: {
              in: (
                await this.prisma.country.findMany({
                  where: { region: { hotelGroupId: group.id } },
                  select: { id: true },
                })
              ).map((c) => c.id),
            },
            deletedAt: null,
          },
        });

        if (remainingGroupProps === 0) {
          counts.region = await this.deleteManyCount(() => this.prisma.region.deleteMany({ where: { hotelGroupId: group.id } }));
          await this.prisma.hotelGroup.delete({ where: { id: group.id } });
          counts.hotelGroup = (counts.hotelGroup ?? 0) + 1;
        }
      }
    }
  }

  /**
   * Unlink installation users' IAM rows (role scopes, organization memberships,
   * credentials, password history, sessions, refresh tokens) while PRESERVING
   * users with GLOBAL scope roles (PLATFORM_OWNER, etc.), which are
   * platform-level and must survive a reset.
   *
   * This must run BEFORE property/organization deletion: user_role_scopes and
   * organization_memberships carry ON DELETE RESTRICT foreign keys against
   * properties and hotel groups.
   *
   * Returns session ids (for Redis fast-revocation) and the installation user
   * ids (their user rows are deleted last, after all restrictors are gone).
   */
  private async unlinkInstallationUsers(counts: DeletionCounts): Promise<{ sessionIds: string[]; userIds: string[] }> {
    // Find users who have GLOBAL scope roles (platform-level users to preserve)
    const globalScopeUserIds = await this.prisma.userRoleScope.findMany({
      where: { scopeType: 'GLOBAL' },
      select: { userId: true },
      distinct: ['userId'],
    });
    const globalUserIds = new Set(globalScopeUserIds.map((s) => s.userId));

    // Find all remaining users (not platform-level)
    const allUsers = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    const installationUserIds = allUsers
      .filter((u) => !globalUserIds.has(u.id))
      .map((u) => u.id);

    if (installationUserIds.length > 0) {
      const sessions = await this.prisma.authSession.findMany({
        where: { userId: { in: installationUserIds } },
        select: { id: true },
      });
      const sessionIds = sessions.map((s: { id: string }) => s.id);

      counts.userRoleScope = await this.deleteManyCount(() => this.prisma.userRoleScope.deleteMany({ where: { userId: { in: installationUserIds } } }));
      counts.organizationMembership = await this.deleteManyCount(() => this.prisma.organizationMembership.deleteMany({ where: { userId: { in: installationUserIds } } }));
      counts.userCredential = await this.deleteManyCount(() => this.prisma.userCredential.deleteMany({ where: { userId: { in: installationUserIds } } }));
      counts.passwordHistory = await this.deleteManyCount(() => this.prisma.passwordHistory.deleteMany({ where: { userId: { in: installationUserIds } } }));
      counts.refreshToken = await this.deleteManyCount(() => this.prisma.refreshToken.deleteMany({ where: { session: { userId: { in: installationUserIds } } } }));
      counts.authSession = await this.deleteManyCount(() => this.prisma.authSession.deleteMany({ where: { userId: { in: installationUserIds } } }));

      return { sessionIds, userIds: installationUserIds };
    }

    return { sessionIds: [], userIds: [] };
  }

  /**
   * Delete the installation user ROWS after every FK restrictor has been
   * removed. Cascade keeps residual child rows (e.g. audit actor references)
   * from blocking this delete.
   */
  private async deleteInstallationUserRows(counts: DeletionCounts, userIds: string[]): Promise<void> {
    if (!userIds || userIds.length === 0) return;

    counts.user = await this.deleteManyCount(() => this.prisma.user.deleteMany({ where: { id: { in: userIds } } }));
  }

  /**
   * Runs a deleteMany and returns the number of deleted rows.
   * Tolerates Prisma P2021 ("table does not exist") by recording 0: the
   * canonical schema contains models whose tables are absent on databases
   * built purely from migrations, and a reset must still complete on such
   * installations. Any other error propagates and fails the reset loudly.
   */
  private async deleteManyCount(run: () => Promise<{ count: number }>): Promise<number> {
    try {
      return (await run()).count;
    } catch (err: any) {
      if (err?.code === 'P2021') {
        return 0;
      }
      throw err;
    }
  }

  /**
   * Writes Redis fast-revocation keys for the given session ids so existing
   * bearer tokens stop working immediately after the reset. Best-effort:
   * individual key failures are logged but do not abort the reset (the
   * sessions are already deleted from the database).
   */
  private async revokeSessionsInRedis(sessionIds: string[]): Promise<void> {
    if (!sessionIds || sessionIds.length === 0) return;

    const securityConfig = this.configService.get<SecurityConfig>('security');
    const prefix = securityConfig?.redisPrefixes?.sessionRevocationPrefix ?? 'revoked:session:';
    const ttlSeconds = securityConfig?.refreshToken?.staffExpiresInSeconds ?? 28800;

    for (const sessionId of sessionIds) {
      try {
        await this.redisService.set(`${prefix}${sessionId}`, 'revoked', 'EX', ttlSeconds);
      } catch (err: any) {
        this.logger.warn(`Failed to fast-revoke session ${sessionId}: ${String(err?.message ?? err)}`);
      }
    }
    this.logger.log(`Fast-revoked ${sessionIds.length} installation session(s) in Redis`);
  }
}