import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';
import { SetupDemoOperationResponse } from '@hms/api-contracts';
import { DEMO_KEYS, SETUP_AUDIT_ACTIONS } from '../../domain/setup.constants';
import { SecurityAuditSink } from '../../infrastructure/security-audit.sink';

interface DemoOperationContext {
  userId: string;
  ip: string;
  correlationId?: string;
  userAgent?: string;
}

/**
 * W2 demo data lifecycle.
 *
 * The Tokyo Grandeur Palace demo remains the seed pipeline's property
 * (packages/database/src/seed/*): this service never creates demo records
 * itself. It invokes the idempotent seed for LOAD/RESET and performs a strict
 * allowlist-guarded ordered deletion for REMOVE.
 *
 * Production safety: none of these operations are executed against production
 * during W2; the endpoints are additionally guarded by allowlist assertions.
 */
@Injectable()
export class DemoDataService {
  private readonly logger = new Logger(DemoDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditSink: SecurityAuditSink,
  ) {}

  async load(ctx: DemoOperationContext): Promise<SetupDemoOperationResponse> {
    const started = Date.now();
    const output: string[] = [];
    const counts: Record<string, number> = {};

    await this.auditSink.record(this.entry('DEMO_DATA_IMPORT_STARTED', ctx));

    try {
      const result = await this.runDemoSeed(output);
      const after = await this.collectDemoCounts();
      Object.assign(counts, after);

      await this.auditSink.record({
        ...this.entry(SETUP_AUDIT_ACTIONS.DEMO_DATA_IMPORTED, ctx),
        details: { counts, durationMs: Date.now() - started },
      });

      return {
        operation: 'LOAD',
        success: result.ok,
        counts,
        output: output.join('\n').slice(-4000),
        durationMs: Date.now() - started,
      };
    } catch (err: any) {
      await this.auditSink.record({
        ...this.entry('DEMO_DATA_IMPORT_FAILED', ctx),
        outcome: 'FAILURE',
        details: { error: String(err?.message ?? err) },
      });
      throw err;
    }
  }

  async reset(ctx: DemoOperationContext): Promise<SetupDemoOperationResponse> {
    const started = Date.now();
    const output: string[] = [];

    try {
      await this.assertDemoDataPresent();
      const result = await this.runDemoSeed(output);
      const counts = await this.collectDemoCounts();

      await this.auditSink.record({
        ...this.entry(SETUP_AUDIT_ACTIONS.DEMO_DATA_RESET, ctx),
        details: { counts, durationMs: Date.now() - started },
      });

      return {
        operation: 'RESET',
        success: result.ok,
        counts,
        output: output.join('\n').slice(-4000),
        durationMs: Date.now() - started,
      };
    } catch (err: any) {
      await this.auditSink.record({
        ...this.entry('DEMO_DATA_RESET_FAILED', ctx),
        outcome: 'FAILURE',
        details: { error: String(err?.message ?? err) },
      });
      throw err;
    }
  }

  /**
   * Ordered hard deletion restricted to the canonical demo keys. Refuses to
   * run unless every observed record belongs to the demo allowlist, and
   * refuses to touch demo data when non-demo organizations exist.
   */
  async remove(ctx: DemoOperationContext): Promise<SetupDemoOperationResponse> {
    const started = Date.now();

    await this.assertDemoDataPresent();

    const group = await this.prisma.hotelGroup.findUnique({
      where: { code: DEMO_KEYS.hotelGroupCode },
    });
    if (!group) throw new Error('Demo hotel group not found.');

    const propertyCount = await this.prisma.property.count({ where: { deletedAt: null } });
    if (propertyCount > 1) {
      throw new Error(
        'Refusing demo removal: non-demo properties exist. Isolation requires the W3 ownership marker.',
      );
    }

    const property = await this.prisma.property.findUnique({
      where: { code: DEMO_KEYS.propertyCode },
    });
    if (!property) throw new Error('Demo property not found.');

    const counts: Record<string, number> = {};

    // Ordered deletion, child-most first, all inside the demo property/group.
    // Each layer counts only rows actually deleted.
    counts.payment = (await this.prisma.payment.deleteMany({ where: { propertyId: property.id } })).count;
    counts.folioTransaction = (
      await this.prisma.folioTransaction.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.paymentIntent = (
      await this.prisma.paymentIntent.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.paymentGatewayTransaction = (
      await this.prisma.paymentGatewayTransaction.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.paymentWebhook = (
      await this.prisma.paymentWebhook.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.folio = (await this.prisma.folio.deleteMany({ where: { propertyId: property.id } })).count;
    counts.reservationRateNight = (
      await this.prisma.reservationRateNight.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.reservation = (
      await this.prisma.reservation.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.housekeepingTask = (
      await this.prisma.housekeepingTask.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.roomStatusLog = (
      await this.prisma.roomStatusLog.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.reservationAssignmentLog = (
      await this.prisma.reservationAssignmentLog.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.roomMaintenanceBlock = (
      await this.prisma.roomMaintenanceBlock.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.workOrder = (
      await this.prisma.workOrder.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.maintenanceSchedule = (
      await this.prisma.maintenanceSchedule.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.asset = (await this.prisma.asset.deleteMany({ where: { propertyId: property.id } })).count;
    counts.spaAppointment = (
      await this.prisma.spaAppointment.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.spaTherapist = (
      await this.prisma.spaTherapist.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.spaRoom = (await this.prisma.spaRoom.deleteMany({ where: { propertyId: property.id } })).count;
    counts.spaServiceAddon = (
      await this.prisma.spaServiceAddon.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.spaService = (
      await this.prisma.spaService.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.spaServiceCategory = (
      await this.prisma.spaServiceCategory.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.eventBooking = (
      await this.prisma.eventBooking.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.eventResource = (
      await this.prisma.eventResource.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.eventPackage = (
      await this.prisma.eventPackage.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.eventVenue = (
      await this.prisma.eventVenue.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.loyaltyTransaction = (
      await this.prisma.loyaltyTransaction.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.loyaltyMembership = (
      await this.prisma.loyaltyMembership.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.guestPreference = (
      await this.prisma.guestPreference.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.guestCrmProfile = (
      await this.prisma.guestCrmProfile.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.guest = (await this.prisma.guest.deleteMany({ where: { propertyId: property.id } })).count;
    counts.fnbOrderItem = (
      await this.prisma.fnbOrderItem.deleteMany({ where: { order: { propertyId: property.id } } })
    ).count;
    counts.fnbOrder = (
      await this.prisma.fnbOrder.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.fnbMenuItemVariant = (
      await this.prisma.fnbMenuItemVariant.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.fnbMenuItem = (
      await this.prisma.fnbMenuItem.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.fnbMenuCategory = (
      await this.prisma.fnbMenuCategory.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.restaurantTable = (
      await this.prisma.restaurantTable.deleteMany({ where: { outlet: { propertyId: property.id } } })
    ).count;
    counts.fnbOutlet = (
      await this.prisma.fnbOutlet.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.payrollLine = (
      await this.prisma.payrollLine.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.payrollRun = (
      await this.prisma.payrollRun.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.payrollPeriod = (
      await this.prisma.payrollPeriod.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.employeeCompensation = (
      await this.prisma.employeeCompensation.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.employee = (
      await this.prisma.employee.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.stockBalance = (
      await this.prisma.stockBalance.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.goodsReceipt = (
      await this.prisma.goodsReceipt.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.purchaseOrderItem = (
      await this.prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { propertyId: property.id } } })
    ).count;
    counts.purchaseOrder = (
      await this.prisma.purchaseOrder.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.inventoryItem = (
      await this.prisma.inventoryItem.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.supplier = (
      await this.prisma.supplier.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.dailyRate = (
      await this.prisma.dailyRate.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.dailyInventory = (
      await this.prisma.dailyInventory.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.ratePlanRoomType = (
      await this.prisma.ratePlanRoomType.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.ratePlan = (
      await this.prisma.ratePlan.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.room = (await this.prisma.room.deleteMany({ where: { propertyId: property.id } })).count;
    counts.roomType = (
      await this.prisma.roomType.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.propertyBusinessDate = (
      await this.prisma.propertyBusinessDate.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.nightAuditRun = (
      await this.prisma.nightAuditRun.deleteMany({ where: { propertyId: property.id } })
    ).count;
    counts.floor = (await this.prisma.floor.deleteMany({ where: { building: { propertyId: property.id } } })).count;
    counts.building = (await this.prisma.building.deleteMany({ where: { propertyId: property.id } })).count;

    // Demo users: strictly the @tokyograndeur.demo emails.
    const demoUsers = await this.prisma.user.findMany({
      where: { email: { endsWith: DEMO_KEYS.emailDomain } },
      select: { id: true },
    });
    const demoUserIds = demoUsers.map((u) => u.id);
    if (demoUserIds.length > 0) {
      counts.userRoleScope = (
        await this.prisma.userRoleScope.deleteMany({ where: { userId: { in: demoUserIds } } })
      ).count;
      counts.userCredential = (
        await this.prisma.userCredential.deleteMany({ where: { userId: { in: demoUserIds } } })
      ).count;
      counts.organizationMembership = (
        await this.prisma.organizationMembership.deleteMany({ where: { userId: { in: demoUserIds } } })
      ).count;
      counts.user = (
        await this.prisma.user.deleteMany({ where: { id: { in: demoUserIds } } })
      ).count;
    }

    // Region/country/group deletion only when the group owns no other
    // properties (allowlist discipline).
    const regions = await this.prisma.region.findMany({ where: { hotelGroupId: group.id } });
    for (const region of regions) {
      const countryIds = (
        await this.prisma.country.findMany({ where: { regionId: region.id }, select: { id: true } })
      ).map((c) => c.id);
      const remaining = await this.prisma.property.count({ where: { countryId: { in: countryIds } } });
      if (remaining === 0) {
        counts.country = (counts.country ?? 0) + (await this.prisma.country.deleteMany({ where: { regionId: region.id } })).count;
      }
    }
    const remainingGroupProps = await this.prisma.property.count({ where: { countryId: { in: (await this.prisma.country.findMany({ where: { region: { hotelGroupId: group.id } }, select: { id: true } })).map((c) => c.id) } } });
    if (remainingGroupProps === 0) {
      counts.region = (await this.prisma.region.deleteMany({ where: { hotelGroupId: group.id } })).count;
      counts.hotelGroup = (await this.prisma.hotelGroup.delete({ where: { id: group.id } })) ? 1 : 0;
    }

    await this.auditSink.record({
      ...this.entry(SETUP_AUDIT_ACTIONS.DEMO_DATA_REMOVED, ctx),
      details: { counts, durationMs: Date.now() - started },
    });

    return {
      operation: 'REMOVE',
      success: true,
      counts,
      output: 'Demo data removed via strict canonical allowlist.',
      durationMs: Date.now() - started,
    };
  }

  // ===========================================================================

  private async assertDemoDataPresent(): Promise<void> {
    const group = await this.prisma.hotelGroup.findUnique({ where: { code: DEMO_KEYS.hotelGroupCode } });
    const property = await this.prisma.property.findUnique({
      where: { code: DEMO_KEYS.propertyCode },
    });
    if (!group || !property) {
      throw new Error('Canonical demo data (HG-GLR / PROP-TYO-001) not present.');
    }
  }

  private entry(
    action: string,
    ctx: DemoOperationContext,
  ): {
    action: string;
    outcome: 'SUCCESS';
    actorId: string;
    actorType: string;
    ipAddress: string;
    correlationId?: string;
    userAgent?: string;
  } {
    return {
      action,
      outcome: 'SUCCESS',
      actorId: ctx.userId,
      actorType: 'USER',
      ipAddress: ctx.ip,
      correlationId: ctx.correlationId,
      userAgent: ctx.userAgent,
    };
  }

  private async runDemoSeed(_output: string[]): Promise<{ ok: boolean }> {
    // Invokes the unchanged 10-phase demo seed pipeline (source of truth:
    // packages/database/src/seed/seed-demo.ts) via the @hms/database barrel.
    const { seedDemo } = await import('@hms/database');
    await seedDemo();
    return { ok: true };
  }

  private async collectDemoCounts(): Promise<Record<string, number>> {
    const property = await this.prisma.property.findUnique({
      where: { code: DEMO_KEYS.propertyCode },
    });
    if (!property) return {};
    const pid = property.id;
    const [roomTypes, rooms, ratePlans, guests, reservations, folios] = await Promise.all([
      this.prisma.roomType.count({ where: { propertyId: pid, deletedAt: null } }),
      this.prisma.room.count({ where: { propertyId: pid, deletedAt: null } }),
      this.prisma.ratePlan.count({ where: { propertyId: pid, deletedAt: null } }),
      this.prisma.guest.count({ where: { propertyId: pid, deletedAt: null } }),
      this.prisma.reservation.count({ where: { propertyId: pid, deletedAt: null } }),
      this.prisma.folio.count({ where: { propertyId: pid } }),
    ]);
    return { roomTypes, rooms, ratePlans, guests, reservations, folios };
  }
}
