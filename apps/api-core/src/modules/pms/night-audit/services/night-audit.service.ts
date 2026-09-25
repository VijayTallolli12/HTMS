import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  NightAuditRecoveryRequest,
  NightAuditRunDto,
  NightAuditStatus,
  NightAuditStatusDto,
  NightAuditStepDto,
  NightAuditStepKey,
  NightAuditStepStatus,
  NightAuditValidationReportDto,
  PmsEventType,
  PropertyBusinessDateDto,
  RunNightAuditRequest,
  SecurityContext,
  ValidationIssue,
  ValidationIssueSeverity,
} from '@hms/api-contracts';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PropertyBusinessDateService } from '../../common/services/property-business-date.service';
import { computeChargePayloadHash } from '../../finance/services/folio.service';

@Injectable()
export class NightAuditService {
  private readonly logger = new Logger(NightAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly businessDateService: PropertyBusinessDateService,
  ) {}

  /**
   * Returns current hotel business date status, timezone context, and active/last audit runs.
   */
  public async getBusinessDateStatus(propertyId: string): Promise<NightAuditStatusDto> {
    const businessDateRecord = await this.businessDateService.getBusinessDateState(propertyId);
    if (!businessDateRecord) {
      throw new NotFoundException(`Property with ID '${propertyId}' not found.`);
    }

    const currentBusinessDateStr = this.businessDateService.formatDateToIsoString(
      businessDateRecord.currentBusinessDate,
    );
    const prevBusinessDateStr = businessDateRecord.previousBusinessDate
      ? this.businessDateService.formatDateToIsoString(businessDateRecord.previousBusinessDate)
      : null;

    const propertyTimeZone = businessDateRecord.property?.timeZone || 'UTC';
    const systemCalendarDate = this.businessDateService.getCurrentBusinessDate(propertyTimeZone);
    const systemCalendarDateStr = this.businessDateService.formatDateToIsoString(systemCalendarDate);

    const daysBehind = this.businessDateService.differenceInCalendarDays(
      systemCalendarDate,
      businessDateRecord.currentBusinessDate,
    );

    const businessDateDto: PropertyBusinessDateDto = {
      propertyId,
      currentBusinessDate: currentBusinessDateStr,
      previousBusinessDate: prevBusinessDateStr,
      systemCalendarDate: systemCalendarDateStr,
      propertyTimeZone,
      isAuditInProgress: businessDateRecord.isAuditInProgress,
      lastAuditRunId: businessDateRecord.lastAuditRunId,
      lastAuditedAt: businessDateRecord.lastAuditedAt?.toISOString() || null,
      daysBehindCalendar: daysBehind,
    };

    // Query active run (if in progress)
    const activeRun = await this.prisma.nightAuditRun.findFirst({
      where: {
        propertyId,
        status: NightAuditStatus.IN_PROGRESS,
      },
      include: {
        steps: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    // Query last completed run
    const lastCompletedRun = await this.prisma.nightAuditRun.findFirst({
      where: {
        propertyId,
        status: NightAuditStatus.COMPLETED,
      },
      orderBy: { completedAt: 'desc' },
      include: {
        steps: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return {
      businessDate: businessDateDto,
      isAuditInProgress: businessDateRecord.isAuditInProgress,
      activeRun: activeRun ? this.mapToRunDto(activeRun) : null,
      lastCompletedRun: lastCompletedRun ? this.mapToRunDto(lastCompletedRun) : null,
    };
  }

  /**
   * Pre-audit operational validations:
   * Inspects pending arrivals, pending departures, dirty rooms, and in-house guest folios.
   */
  public async validatePreAudit(propertyId: string): Promise<NightAuditValidationReportDto> {
    const businessDateRecord = await this.businessDateService.getBusinessDateState(propertyId);
    if (!businessDateRecord) {
      throw new NotFoundException(`Property with ID '${propertyId}' not found.`);
    }

    const businessDate = businessDateRecord.currentBusinessDate;
    const dateStr = this.businessDateService.formatDateToIsoString(businessDate);
    const issues: ValidationIssue[] = [];

    // 1. Pending arrivals: arriving on or before current business date still in CONFIRMED/GUARANTEED
    const pendingArrivals = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        arrivalDate: { lte: businessDate },
        status: { in: ['CONFIRMED', 'GUARANTEED'] },
        deletedAt: null,
      },
      select: {
        id: true,
        confirmationNumber: true,
        arrivalDate: true,
        status: true,
      },
    });

    if (pendingArrivals.length > 0) {
      issues.push({
        code: 'PENDING_ARRIVALS',
        category: 'ARRIVALS',
        severity: ValidationIssueSeverity.WARNING,
        message: `${pendingArrivals.length} reservation(s) scheduled to arrive on or before ${dateStr} have not checked in. They will be marked as NO_SHOW during rollover or require front desk action.`,
        details: {
          count: pendingArrivals.length,
          sampleReservations: pendingArrivals.slice(0, 5).map((r) => r.confirmationNumber),
        },
      });
    }

    // 2. Pending departures: due out on or before current business date still in CHECKED_IN
    const pendingDepartures = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        departureDate: { lte: businessDate },
        status: 'CHECKED_IN',
        deletedAt: null,
      },
      select: {
        id: true,
        confirmationNumber: true,
        departureDate: true,
        assignedRoomId: true,
      },
    });

    if (pendingDepartures.length > 0) {
      issues.push({
        code: 'PENDING_DEPARTURES',
        category: 'DEPARTURES',
        severity: ValidationIssueSeverity.WARNING,
        message: `${pendingDepartures.length} in-house reservation(s) scheduled for departure on or before ${dateStr} are still checked in. Extend stay or check out before advancing date.`,
        details: {
          count: pendingDepartures.length,
          sampleReservations: pendingDepartures.slice(0, 5).map((r) => r.confirmationNumber),
        },
      });
    }

    // 3. Dirty rooms remaining
    const dirtyRooms = await this.prisma.room.findMany({
      where: {
        propertyId,
        housekeepingStatus: 'DIRTY',
        deletedAt: null,
      },
      select: { id: true, roomNumber: true },
    });

    if (dirtyRooms.length > 0) {
      issues.push({
        code: 'DIRTY_ROOMS_REMAINING',
        category: 'ROOM_STATUS',
        severity: ValidationIssueSeverity.WARNING,
        message: `${dirtyRooms.length} room(s) are currently marked DIRTY in housekeeping.`,
        details: {
          count: dirtyRooms.length,
          sampleRooms: dirtyRooms.slice(0, 5).map((r) => r.roomNumber),
        },
      });
    }

    // 4. In-house reservations & expected room revenue
    const inHouseReservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: 'CHECKED_IN',
        deletedAt: null,
      },
      include: {
        rateNights: {
          where: { businessDate },
        },
      },
    });

    let expectedRevenue = 0;
    for (const res of inHouseReservations) {
      if (res.rateNights && res.rateNights.length > 0) {
        expectedRevenue += Number(res.rateNights[0].totalAmount);
      } else {
        const days = Math.max(
          1,
          this.businessDateService.differenceInCalendarDays(res.departureDate, res.arrivalDate),
        );
        expectedRevenue += Number(res.totalAmount) / days;
      }
    }

    // 5. Occupied rooms count
    const occupiedRoomsCount = await this.prisma.room.count({
      where: {
        propertyId,
        occupancyStatus: 'OCCUPIED',
        deletedAt: null,
      },
    });

    const hasBlockingIssues = issues.some((i) => i.severity === ValidationIssueSeverity.BLOCKING);
    const hasWarnings = issues.some((i) => i.severity === ValidationIssueSeverity.WARNING);

    return {
      propertyId,
      businessDate: dateStr,
      evaluatedAt: new Date().toISOString(),
      canProceed: !hasBlockingIssues,
      hasBlockingIssues,
      hasWarnings,
      issues,
      metrics: {
        pendingArrivalsCount: pendingArrivals.length,
        pendingDeparturesCount: pendingDepartures.length,
        inHouseReservationsCount: inHouseReservations.length,
        expectedRoomRevenue: Math.round(expectedRevenue * 100) / 100,
        occupiedRoomsCount,
        dirtyRoomsCount: dirtyRooms.length,
      },
    };
  }

  /**
   * Executes the Night Audit with strict concurrency locking, automated room charges,
   * no-show processing, and atomic business date advancement.
   */
  public async runNightAudit(
    propertyId: string,
    req: RunNightAuditRequest,
    actor: SecurityContext,
  ): Promise<NightAuditRunDto> {
    // 1. Ensure business date record exists
    await this.businessDateService.ensureBusinessDate(propertyId);

    // 2. Strict Concurrency Lock: Atomic acquisition on PropertyBusinessDate
    const lockResult = await this.prisma.propertyBusinessDate.updateMany({
      where: {
        propertyId,
        isAuditInProgress: false,
      },
      data: {
        isAuditInProgress: true,
        version: { increment: 1 },
      },
    });

    if (lockResult.count === 0) {
      throw new ConflictException({
        statusCode: 409,
        errorCode: 'NIGHT_AUDIT_IN_PROGRESS',
        message: 'Night audit is already in progress for this property or property business date is locked.',
      });
    }

    let auditRunId: string | null = null;

    try {
      // 3. Re-read authoritative business date under lock
      const businessDateRecord = await this.prisma.propertyBusinessDate.findUniqueOrThrow({
        where: { propertyId },
      });

      const currentBusinessDate = businessDateRecord.currentBusinessDate;
      const nextBusinessDate = this.businessDateService.addDays(currentBusinessDate, 1);
      const businessDateStr = this.businessDateService.formatDateToIsoString(currentBusinessDate);
      const nextBusinessDateStr = this.businessDateService.formatDateToIsoString(nextBusinessDate);

      // 4. Duplicate Check: Ensure no completed run exists for this business date
      const existingRun = await this.prisma.nightAuditRun.findUnique({
        where: {
          uq_night_audit_property_date: {
            propertyId,
            businessDate: currentBusinessDate,
          },
        },
      });

      if (existingRun && existingRun.status === NightAuditStatus.COMPLETED) {
        throw new ConflictException({
          statusCode: 409,
          errorCode: 'NIGHT_AUDIT_ALREADY_COMPLETED',
          message: `Night audit has already been completed for property '${propertyId}' on business date ${businessDateStr}.`,
        });
      }

      // 5. Pre-audit Validation under lock
      const validationReport = await this.validatePreAudit(propertyId);

      if (validationReport.hasBlockingIssues) {
        throw new BadRequestException({
          statusCode: 400,
          errorCode: 'PRE_AUDIT_BLOCKING_ISSUES',
          message: 'Night audit cannot proceed due to blocking operational issues.',
          issues: validationReport.issues,
        });
      }

      if (validationReport.hasWarnings && !req.overrideWarnings) {
        throw new BadRequestException({
          statusCode: 400,
          errorCode: 'PRE_AUDIT_WARNINGS_REQUIRE_OVERRIDE',
          message:
            'Night audit encountered operational warnings. Provide overrideWarnings=true with justification to proceed.',
          issues: validationReport.issues,
        });
      }

      // 6. Create or re-use NightAuditRun
      if (existingRun) {
        // Reuse failed run
        auditRunId = existingRun.id;
        await this.prisma.nightAuditStep.deleteMany({
          where: { auditRunId },
        });
        await this.prisma.nightAuditRun.update({
          where: { id: auditRunId },
          data: {
            status: NightAuditStatus.IN_PROGRESS,
            executedBy: actor.userId,
            startedAt: new Date(),
            completedAt: null,
            failureReason: null,
            metrics: Prisma.DbNull,
            version: { increment: 1 },
          },
        });
      } else {
        auditRunId = generateUuidV7();
        await this.prisma.nightAuditRun.create({
          data: {
            id: auditRunId,
            propertyId,
            businessDate: currentBusinessDate,
            nextBusinessDate,
            status: NightAuditStatus.IN_PROGRESS,
            executedBy: actor.userId,
            startedAt: new Date(),
          },
        });
      }

      // Emit NIGHT_AUDIT_STARTED outbox event
      const startedEvent = createCloudEvent({
        type: PmsEventType.NIGHT_AUDIT_STARTED,
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/night-audit/${auditRunId}`,
        subject: auditRunId,
        propertyId,
        data: {
          propertyId,
          auditRunId,
          businessDate: businessDateStr,
          executedBy: actor.userId,
        },
      });

      await this.prisma.outboxEvent.create({
        data: {
          id: startedEvent.id,
          specversion: startedEvent.specversion,
          type: startedEvent.type,
          source: startedEvent.source,
          subject: startedEvent.subject,
          datacontenttype: startedEvent.datacontenttype,
          time: new Date(startedEvent.time),
          data: startedEvent.data as any,
          propertyId,
        },
      });

      // -----------------------------------------------------------------------
      // STEP 1: VALIDATION STEP
      // -----------------------------------------------------------------------
      const step1Id = generateUuidV7();
      await this.prisma.nightAuditStep.create({
        data: {
          id: step1Id,
          auditRunId,
          stepKey: NightAuditStepKey.VALIDATION,
          name: 'Pre-Audit Operational Validation',
          orderIndex: 1,
          status: NightAuditStepStatus.COMPLETED,
          startedAt: new Date(),
          completedAt: new Date(),
          itemsProcessed: validationReport.issues.length,
          details: {
            warningsOverridden: Boolean(req.overrideWarnings),
            overrideReason: req.overrideReason || null,
            issuesCount: validationReport.issues.length,
          },
        },
      });

      // -----------------------------------------------------------------------
      // STEP 2: NO_SHOW_PROCESSING STEP
      // -----------------------------------------------------------------------
      const step2Id = generateUuidV7();
      const step2Start = new Date();
      const pendingArrivals = await this.prisma.reservation.findMany({
        where: {
          propertyId,
          arrivalDate: { lte: currentBusinessDate },
          status: { in: ['CONFIRMED', 'GUARANTEED'] },
          deletedAt: null,
        },
      });

      if (pendingArrivals.length > 0) {
        await this.prisma.reservation.updateMany({
          where: {
            id: { in: pendingArrivals.map((r) => r.id) },
          },
          data: {
            status: 'NO_SHOW',
            version: { increment: 1 },
          },
        });
      }

      await this.prisma.nightAuditStep.create({
        data: {
          id: step2Id,
          auditRunId,
          stepKey: NightAuditStepKey.NO_SHOW_PROCESSING,
          name: 'No-Show Reservation Processing',
          orderIndex: 2,
          status: NightAuditStepStatus.COMPLETED,
          startedAt: step2Start,
          completedAt: new Date(),
          itemsProcessed: pendingArrivals.length,
          details: {
            noShowsProcessed: pendingArrivals.length,
            reservationIds: pendingArrivals.map((r) => r.id),
          },
        },
      });

      // -----------------------------------------------------------------------
      // STEP 3: ROOM_CHARGES POSTING STEP
      // -----------------------------------------------------------------------
      const step3Id = generateUuidV7();
      const step3Start = new Date();
      await this.prisma.nightAuditStep.create({
        data: {
          id: step3Id,
          auditRunId,
          stepKey: NightAuditStepKey.ROOM_CHARGES,
          name: 'Automated Room & Tax Posting',
          orderIndex: 3,
          status: NightAuditStepStatus.RUNNING,
          startedAt: step3Start,
        },
      });

      const inHouseReservations = await this.prisma.reservation.findMany({
        where: {
          propertyId,
          status: 'CHECKED_IN',
          deletedAt: null,
        },
        include: {
          rateNights: {
            where: { businessDate: currentBusinessDate },
          },
          assignedRoom: true,
        },
      });

      let chargesPostedCount = 0;
      let totalRevenuePosted = new Prisma.Decimal(0);
      const tenantId = actor.activeContext?.hotelGroupId || propertyId;

      for (const res of inHouseReservations) {
        // Resolve charge rate for current business date
        let rateAmount: Prisma.Decimal;
        if (res.rateNights && res.rateNights.length > 0) {
          rateAmount = res.rateNights[0].totalAmount;
        } else {
          const days = Math.max(
            1,
            this.businessDateService.differenceInCalendarDays(res.departureDate, res.arrivalDate),
          );
          rateAmount = new Prisma.Decimal(res.totalAmount).dividedBy(days).toDecimalPlaces(4);
        }

        // Find or create primary open folio
        let folio = await this.prisma.folio.findFirst({
          where: {
            propertyId,
            reservationId: res.id,
            status: 'OPEN',
          },
          orderBy: { createdAt: 'asc' },
        });

        if (!folio) {
          const folioCount = await this.prisma.folio.count({ where: { propertyId } });
          const year = new Date().getFullYear();
          const folioNumber = `FOL-${year}-${String(folioCount + 1).padStart(6, '0')}`;
          folio = await this.prisma.folio.create({
            data: {
              id: generateUuidV7(),
              tenantId,
              propertyId,
              reservationId: res.id,
              guestId: res.guestId,
              folioNumber,
              status: 'OPEN',
              currency: res.currency,
              balance: new Prisma.Decimal(0),
              idempotencyKey: `folio-audit-${res.id}`,
              createdBy: actor.userId,
            },
          });
        }

        // Deterministic charge posting idempotency key
        const chargeIdempotencyKey = `audit-${auditRunId}-${res.id}-${businessDateStr}`;
        const description = `Room charge - Room ${res.assignedRoom?.roomNumber || 'N/A'} (${businessDateStr})`;
        const payloadHash = computeChargePayloadHash(folio.id, {
          transactionCode: 'ROOM_CHARGE',
          description,
          amount: rateAmount.toFixed(4),
          taxAmount: '0.0000',
        });

        // Check if charge was already posted under this idempotency key
        const existingTx = await this.prisma.folioTransaction.findUnique({
          where: {
            uq_folio_tx_property_idempotency: {
              propertyId,
              idempotencyKey: chargeIdempotencyKey,
            },
          },
        });

        if (!existingTx) {
          const txId = generateUuidV7();
          const now = new Date();

          await this.prisma.$transaction(async (tx) => {
            await tx.folioTransaction.create({
              data: {
                id: txId,
                tenantId: folio!.tenantId,
                propertyId,
                folioId: folio!.id,
                transactionCode: 'ROOM_CHARGE',
                description,
                amount: rateAmount,
                taxAmount: new Prisma.Decimal(0),
                idempotencyKey: chargeIdempotencyKey,
                payloadHash,
                postedAt: now,
                postedBy: actor.userId,
              },
            });

            await tx.folio.update({
              where: { id: folio!.id },
              data: {
                balance: { increment: rateAmount },
                version: { increment: 1 },
              },
            });

            const chargeEvent = createCloudEvent({
              type: PmsEventType.CHARGE_POSTED_TO_FOLIO,
              source: `https://pms.enterprise-hms.com/properties/${propertyId}/folios/${folio!.id}`,
              subject: folio!.id,
              propertyId,
              data: {
                propertyId,
                folioId: folio!.id,
                transactionId: txId,
                transactionCode: 'ROOM_CHARGE',
                amount: rateAmount.toNumber(),
                taxAmount: 0,
                postedBy: actor.userId,
              },
            });

            await tx.outboxEvent.create({
              data: {
                id: chargeEvent.id,
                specversion: chargeEvent.specversion,
                type: chargeEvent.type,
                source: chargeEvent.source,
                subject: chargeEvent.subject,
                datacontenttype: chargeEvent.datacontenttype,
                time: new Date(chargeEvent.time),
                data: chargeEvent.data as any,
                propertyId,
              },
            });
          });

          chargesPostedCount++;
          totalRevenuePosted = totalRevenuePosted.plus(rateAmount);
        } else {
          chargesPostedCount++;
          totalRevenuePosted = totalRevenuePosted.plus(existingTx.amount);
        }
      }

      await this.prisma.nightAuditStep.update({
        where: { id: step3Id },
        data: {
          status: NightAuditStepStatus.COMPLETED,
          completedAt: new Date(),
          itemsProcessed: chargesPostedCount,
          details: {
            roomChargesCount: chargesPostedCount,
            totalRevenuePosted: totalRevenuePosted.toNumber(),
          },
        },
      });

      // -----------------------------------------------------------------------
      // STEP 4: DATE_ROLLOVER STEP & COMPLETION
      // -----------------------------------------------------------------------
      const step4Id = generateUuidV7();
      const step4Start = new Date();
      await this.prisma.nightAuditStep.create({
        data: {
          id: step4Id,
          auditRunId,
          stepKey: NightAuditStepKey.DATE_ROLLOVER,
          name: 'Hotel Business Date Rollover',
          orderIndex: 4,
          status: NightAuditStepStatus.RUNNING,
          startedAt: step4Start,
        },
      });

      const metrics = {
        roomRevenuePosted: totalRevenuePosted.toNumber(),
        taxPosted: 0,
        roomNightsPosted: chargesPostedCount,
        noShowsProcessed: pendingArrivals.length,
        previousBusinessDate: businessDateStr,
        newBusinessDate: nextBusinessDateStr,
      };

      // Atomic rollover transaction: update PropertyBusinessDate + mark Run COMPLETED + emit outbox
      await this.prisma.$transaction(async (tx) => {
        await tx.propertyBusinessDate.update({
          where: { propertyId },
          data: {
            currentBusinessDate: nextBusinessDate,
            previousBusinessDate: currentBusinessDate,
            lastAuditRunId: auditRunId,
            lastAuditedAt: new Date(),
            isAuditInProgress: false,
            version: { increment: 1 },
          },
        });

        await tx.nightAuditRun.update({
          where: { id: auditRunId! },
          data: {
            status: NightAuditStatus.COMPLETED,
            completedAt: new Date(),
            metrics,
            version: { increment: 1 },
          },
        });

        await tx.nightAuditStep.update({
          where: { id: step4Id },
          data: {
            status: NightAuditStepStatus.COMPLETED,
            completedAt: new Date(),
            itemsProcessed: 1,
            details: {
              previousBusinessDate: businessDateStr,
              advancedToDate: nextBusinessDateStr,
            },
          },
        });

        // CloudEvent 1: BUSINESS_DATE_ADVANCED
        const dateAdvancedEvent = createCloudEvent({
          type: PmsEventType.BUSINESS_DATE_ADVANCED,
          source: `https://pms.enterprise-hms.com/properties/${propertyId}/business-date`,
          subject: propertyId,
          propertyId,
          data: {
            propertyId,
            previousBusinessDate: businessDateStr,
            newBusinessDate: nextBusinessDateStr,
            advancedBy: actor.userId,
            auditRunId,
          },
        });

        // CloudEvent 2: NIGHT_AUDIT_COMPLETED
        const auditCompletedEvent = createCloudEvent({
          type: PmsEventType.NIGHT_AUDIT_COMPLETED,
          source: `https://pms.enterprise-hms.com/properties/${propertyId}/night-audit/${auditRunId}`,
          subject: auditRunId!,
          propertyId,
          data: {
            propertyId,
            auditRunId,
            businessDate: businessDateStr,
            nextBusinessDate: nextBusinessDateStr,
            metrics,
            executedBy: actor.userId,
          },
        });

        await tx.outboxEvent.createMany({
          data: [
            {
              id: dateAdvancedEvent.id,
              specversion: dateAdvancedEvent.specversion,
              type: dateAdvancedEvent.type,
              source: dateAdvancedEvent.source,
              subject: dateAdvancedEvent.subject,
              datacontenttype: dateAdvancedEvent.datacontenttype,
              time: new Date(dateAdvancedEvent.time),
              data: dateAdvancedEvent.data as any,
              propertyId,
            },
            {
              id: auditCompletedEvent.id,
              specversion: auditCompletedEvent.specversion,
              type: auditCompletedEvent.type,
              source: auditCompletedEvent.source,
              subject: auditCompletedEvent.subject,
              datacontenttype: auditCompletedEvent.datacontenttype,
              time: new Date(auditCompletedEvent.time),
              data: auditCompletedEvent.data as any,
              propertyId,
            },
          ],
        });
      });

      this.logger.log(
        `Night Audit completed successfully for property ${propertyId}. Business date advanced from ${businessDateStr} to ${nextBusinessDateStr}.`,
      );

      // Return completed run with steps
      const finalRun = await this.prisma.nightAuditRun.findUniqueOrThrow({
        where: { id: auditRunId! },
        include: {
          steps: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      return this.mapToRunDto(finalRun);
    } catch (error: any) {
      this.logger.error(`Night audit failed for property ${propertyId}: ${error.message}`, error.stack);

      // Release lock on PropertyBusinessDate if still held
      try {
        await this.prisma.propertyBusinessDate.updateMany({
          where: { propertyId, isAuditInProgress: true },
          data: {
            isAuditInProgress: false,
            version: { increment: 1 },
          },
        });
      } catch (unlockErr: any) {
        this.logger.error(`Failed to release lock after night audit error: ${unlockErr.message}`);
      }

      // Mark run FAILED if it was created
      if (auditRunId) {
        try {
          await this.prisma.nightAuditRun.update({
            where: { id: auditRunId },
            data: {
              status: NightAuditStatus.FAILED,
              completedAt: new Date(),
              failureReason: error.message?.slice(0, 1000) || 'Unknown error occurred',
              version: { increment: 1 },
            },
          });

          const failedEvent = createCloudEvent({
            type: PmsEventType.NIGHT_AUDIT_FAILED,
            source: `https://pms.enterprise-hms.com/properties/${propertyId}/night-audit/${auditRunId}`,
            subject: auditRunId,
            propertyId,
            data: {
              propertyId,
              auditRunId,
              failureReason: error.message,
              executedBy: actor.userId,
            },
          });

          await this.prisma.outboxEvent.create({
            data: {
              id: failedEvent.id,
              specversion: failedEvent.specversion,
              type: failedEvent.type,
              source: failedEvent.source,
              subject: failedEvent.subject,
              datacontenttype: failedEvent.datacontenttype,
              time: new Date(failedEvent.time),
              data: failedEvent.data as any,
              propertyId,
            },
          });
        } catch (failUpdateErr: any) {
          this.logger.error(`Failed to record audit run failure: ${failUpdateErr.message}`);
        }
      }

      throw error;
    }
  }

  /**
   * Forcibly unlocks a stuck audit or resets in-progress state safely.
   */
  public async recoverStuckAudit(
    propertyId: string,
    req: NightAuditRecoveryRequest,
    actor: SecurityContext,
  ): Promise<PropertyBusinessDateDto> {
    const businessDateRecord = await this.prisma.propertyBusinessDate.findUnique({
      where: { propertyId },
    });

    if (!businessDateRecord) {
      throw new NotFoundException(`Property with ID '${propertyId}' not found.`);
    }

    // Release lock
    const updated = await this.prisma.propertyBusinessDate.update({
      where: { propertyId },
      data: {
        isAuditInProgress: false,
        version: { increment: 1 },
      },
      include: {
        property: {
          select: { timeZone: true },
        },
      },
    });

    // Mark any running audits as FAILED
    const runningAudits = await this.prisma.nightAuditRun.findMany({
      where: {
        propertyId,
        status: NightAuditStatus.IN_PROGRESS,
      },
    });

    for (const run of runningAudits) {
      await this.prisma.nightAuditRun.update({
        where: { id: run.id },
        data: {
          status: NightAuditStatus.FAILED,
          completedAt: new Date(),
          failureReason: `Forcibly recovered by user ${actor.userId}: ${req.reason}`,
          version: { increment: 1 },
        },
      });

      const failedEvent = createCloudEvent({
        type: PmsEventType.NIGHT_AUDIT_FAILED,
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/night-audit/${run.id}`,
        subject: run.id,
        propertyId,
        data: {
          propertyId,
          auditRunId: run.id,
          failureReason: `Forcibly recovered: ${req.reason}`,
          recoveredBy: actor.userId,
        },
      });

      await this.prisma.outboxEvent.create({
        data: {
          id: failedEvent.id,
          specversion: failedEvent.specversion,
          type: failedEvent.type,
          source: failedEvent.source,
          subject: failedEvent.subject,
          datacontenttype: failedEvent.datacontenttype,
          time: new Date(failedEvent.time),
          data: failedEvent.data as any,
          propertyId,
        },
      });
    }

    const currentBusinessDateStr = this.businessDateService.formatDateToIsoString(
      updated.currentBusinessDate,
    );
    const prevBusinessDateStr = updated.previousBusinessDate
      ? this.businessDateService.formatDateToIsoString(updated.previousBusinessDate)
      : null;
    const propertyTimeZone = updated.property?.timeZone || 'UTC';
    const systemCalendarDate = this.businessDateService.getCurrentBusinessDate(propertyTimeZone);
    const daysBehind = this.businessDateService.differenceInCalendarDays(
      systemCalendarDate,
      updated.currentBusinessDate,
    );

    return {
      propertyId,
      currentBusinessDate: currentBusinessDateStr,
      previousBusinessDate: prevBusinessDateStr,
      systemCalendarDate: this.businessDateService.formatDateToIsoString(systemCalendarDate),
      propertyTimeZone,
      isAuditInProgress: updated.isAuditInProgress,
      lastAuditRunId: updated.lastAuditRunId,
      lastAuditedAt: updated.lastAuditedAt?.toISOString() || null,
      daysBehindCalendar: daysBehind,
    };
  }

  /**
   * Retrieves paginated audit history for a property.
   */
  public async getAuditHistory(
    propertyId: string,
    limit = 20,
  ): Promise<NightAuditRunDto[]> {
    const runs = await this.prisma.nightAuditRun.findMany({
      where: { propertyId },
      orderBy: { startedAt: 'desc' },
      take: Math.min(50, Math.max(1, limit)),
      include: {
        steps: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return runs.map((r) => this.mapToRunDto(r));
  }

  /**
   * Retrieves specific run details by ID.
   */
  public async getAuditRunById(propertyId: string, runId: string): Promise<NightAuditRunDto> {
    const run = await this.prisma.nightAuditRun.findFirst({
      where: {
        id: runId,
        propertyId,
      },
      include: {
        steps: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Night audit run '${runId}' not found for property '${propertyId}'.`);
    }

    return this.mapToRunDto(run);
  }

  private mapToRunDto(run: any): NightAuditRunDto {
    return {
      id: run.id,
      propertyId: run.propertyId,
      businessDate: this.businessDateService.formatDateToIsoString(run.businessDate),
      nextBusinessDate: this.businessDateService.formatDateToIsoString(run.nextBusinessDate),
      status: run.status as NightAuditStatus,
      executedBy: run.executedBy,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() || null,
      failureReason: run.failureReason,
      metrics: run.metrics || null,
      version: run.version,
      createdAt: run.createdAt.toISOString(),
      steps: run.steps?.map((s: any) => this.mapToStepDto(s)) || [],
    };
  }

  private mapToStepDto(step: any): NightAuditStepDto {
    return {
      id: step.id,
      auditRunId: step.auditRunId,
      stepKey: step.stepKey as NightAuditStepKey,
      name: step.name,
      orderIndex: step.orderIndex,
      status: step.status as NightAuditStepStatus,
      startedAt: step.startedAt?.toISOString() || null,
      completedAt: step.completedAt?.toISOString() || null,
      itemsProcessed: step.itemsProcessed,
      details: step.details || null,
      errorMessage: step.errorMessage || null,
    };
  }
}
