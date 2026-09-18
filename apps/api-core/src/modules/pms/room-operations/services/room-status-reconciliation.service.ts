import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Room, RoomMaintenanceBlock } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import {
  EffectiveRoomStateDto,
  HousekeepingStatus,
  PmsEventType,
  RoomOccupancyStatus,
  RoomServiceStatus,
  RoomStatusLogSource,
} from '@hms/api-contracts';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';

@Injectable()
export class RoomStatusReconciliationService {
  private readonly logger = new Logger(RoomStatusReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pure evaluation function: computes the authoritative effective operational readiness
   * for a target business date without side effects.
   */
  public resolveEffectiveState(
    room: Room,
    activeBlock: RoomMaintenanceBlock | null,
    targetBusinessDate: Date,
    includeOOS: boolean = false,
  ): EffectiveRoomStateDto {
    const dateStr = targetBusinessDate.toISOString().slice(0, 10);

    if (activeBlock) {
      const serviceStatus = activeBlock.type as RoomServiceStatus;
      const isSellable = activeBlock.type === 'OUT_OF_SERVICE' && !includeOOS;

      return {
        businessDate: dateStr,
        serviceStatus,
        housekeepingStatus: room.housekeepingStatus as HousekeepingStatus,
        occupancyStatus: room.occupancyStatus as RoomOccupancyStatus,
        isCheckInReady: false,
        isSellable,
        activeMaintenanceBlockId: activeBlock.id,
      };
    }

    const isCheckInReady =
      room.housekeepingStatus === HousekeepingStatus.INSPECTED &&
      room.occupancyStatus === RoomOccupancyStatus.VACANT;

    return {
      businessDate: dateStr,
      serviceStatus: RoomServiceStatus.IN_SERVICE,
      housekeepingStatus: room.housekeepingStatus as HousekeepingStatus,
      occupancyStatus: room.occupancyStatus as RoomOccupancyStatus,
      isCheckInReady,
      isSellable: true,
      activeMaintenanceBlockId: undefined,
    };
  }

  /**
   * Reconciles the materialized Room projection (both serviceStatus and housekeepingStatus)
   * with the authoritative effective maintenance state for today's business date.
   * True idempotent NO-OP if already fully synced; OCC-safe with recursive re-read if race occurs.
   */
  public async reconcileRoom(
    propertyId: string,
    currentRoom: Room,
    currentBusinessDate: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<Room> {
    const client = tx || this.prisma;

    // 1. Query active maintenance block covering today D
    const activeBlock = await client.roomMaintenanceBlock.findFirst({
      where: {
        propertyId,
        roomId: currentRoom.id,
        status: 'ACTIVE',
        deletedAt: null,
        startDate: { lte: currentBusinessDate },
        endDate: { gt: currentBusinessDate },
      },
      orderBy: { createdAt: 'desc' },
    });

    let targetServiceStatus: RoomServiceStatus;
    let requiredHousekeepingStatus: HousekeepingStatus;

    if (activeBlock) {
      targetServiceStatus = activeBlock.type as RoomServiceStatus;
      // Active maintenance preserves existing housekeeping state
      requiredHousekeepingStatus = currentRoom.housekeepingStatus as HousekeepingStatus;
    } else {
      targetServiceStatus = RoomServiceStatus.IN_SERVICE;

      // Evaluate post-maintenance hygiene invariant
      if (currentRoom.serviceStatus !== RoomServiceStatus.IN_SERVICE) {
        // Returning from OOO/OOS directly requires DIRTY
        requiredHousekeepingStatus = HousekeepingStatus.DIRTY;
      } else {
        // Room is already stored as IN_SERVICE. Check if an unmaterialized post-maintenance dirtying was omitted.
        const prevBlock = await client.roomMaintenanceBlock.findFirst({
          where: {
            propertyId,
            roomId: currentRoom.id,
            endDate: { lte: currentBusinessDate },
            deletedAt: null,
          },
          orderBy: { endDate: 'desc' },
        });

        if (prevBlock && currentRoom.housekeepingStatus !== HousekeepingStatus.DIRTY) {
          // Check if any manual housekeeping update occurred since this block ended
          const manualLog = await client.roomStatusLog.findFirst({
            where: {
              propertyId,
              roomId: currentRoom.id,
              source: RoomStatusLogSource.MANUAL,
              createdAt: { gte: prevBlock.updatedAt },
            },
          });

          if (!manualLog) {
            // No attendant cleaned it since maintenance ended -> enforce DIRTY
            requiredHousekeepingStatus = HousekeepingStatus.DIRTY;
          } else {
            requiredHousekeepingStatus = currentRoom.housekeepingStatus as HousekeepingStatus;
          }
        } else {
          requiredHousekeepingStatus = currentRoom.housekeepingStatus as HousekeepingStatus;
        }
      }
    }

    // 2. COMPLETE Materialized Projection Check (True Idempotent NO-OP)
    const isServiceSynced = currentRoom.serviceStatus === targetServiceStatus;
    const isHousekeepingSynced = currentRoom.housekeepingStatus === requiredHousekeepingStatus;

    if (isServiceSynced && isHousekeepingSynced) {
      return currentRoom;
    }

    // 3. Atomic OCC Update
    const executeUpdate = async (dbClient: Prisma.TransactionClient): Promise<Room> => {
      const updateData: Prisma.RoomUpdateInput = {
        version: { increment: 1 },
      };
      if (!isServiceSynced) updateData.serviceStatus = targetServiceStatus;
      if (!isHousekeepingSynced) updateData.housekeepingStatus = requiredHousekeepingStatus;

      const res = await dbClient.room.updateMany({
        where: {
          id: currentRoom.id,
          propertyId,
          version: currentRoom.version, // OCC lock
        },
        data: updateData,
      });

      if (res.count === 0) {
        // OCC race lost: re-read fresh committed room and re-evaluate
        this.logger.debug(
          `Reconciliation OCC race lost for room ${currentRoom.roomNumber}; re-evaluating`,
        );
        const freshRoom = await dbClient.room.findUniqueOrThrow({
          where: { id: currentRoom.id },
        });
        return this.reconcileRoom(propertyId, freshRoom, currentBusinessDate, dbClient);
      }

      const reconciledRoom = await dbClient.room.findUniqueOrThrow({
        where: { id: currentRoom.id },
      });

      // 4. Record Audit Log
      const source =
        !isServiceSynced && targetServiceStatus !== RoomServiceStatus.IN_SERVICE
          ? RoomStatusLogSource.RECONCILIATION_ACTIVATION
          : RoomStatusLogSource.RECONCILIATION_EXPIRY;

      await dbClient.roomStatusLog.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          roomId: currentRoom.id,
          previousHousekeepingStatus: currentRoom.housekeepingStatus,
          newHousekeepingStatus: reconciledRoom.housekeepingStatus,
          previousServiceStatus: currentRoom.serviceStatus,
          newServiceStatus: reconciledRoom.serviceStatus,
          reason: `Reconciled for business date ${currentBusinessDate.toISOString().slice(0, 10)}`,
          source,
          changedBy: 'SYSTEM_RECONCILIATION',
        },
      });

      // 5. Emit CloudEvent to Transactional Outbox
      const event = createCloudEvent({
        type: PmsEventType.ROOM_STATUS_CHANGED,
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/rooms/${currentRoom.id}`,
        subject: currentRoom.id,
        propertyId,
        data: {
          propertyId,
          roomId: currentRoom.id,
          roomNumber: currentRoom.roomNumber,
          previousHousekeepingStatus: currentRoom.housekeepingStatus,
          newHousekeepingStatus: reconciledRoom.housekeepingStatus,
          previousServiceStatus: currentRoom.serviceStatus,
          newServiceStatus: reconciledRoom.serviceStatus,
          reason: `Reconciled for business date ${currentBusinessDate.toISOString().slice(0, 10)}`,
          source,
          updatedBy: 'SYSTEM_RECONCILIATION',
        },
      });

      await dbClient.outboxEvent.create({
        data: {
          id: event.id,
          specversion: event.specversion,
          type: event.type,
          source: event.source,
          subject: event.subject,
          propertyId,
          datacontenttype: event.datacontenttype,
          time: new Date(event.time),
          data: event.data as any,
          correlationId: event.correlationid,
          causationId: event.causationid,
        },
      });

      this.logger.log(
        `Room ${currentRoom.roomNumber} reconciled: serviceStatus=${reconciledRoom.serviceStatus}, housekeepingStatus=${reconciledRoom.housekeepingStatus}`,
      );

      return reconciledRoom;
    };

    if (tx) {
      return executeUpdate(tx);
    }

    return this.prisma.$transaction(
      async (scopedTx) => {
        return executeUpdate(scopedTx);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );
  }
}
