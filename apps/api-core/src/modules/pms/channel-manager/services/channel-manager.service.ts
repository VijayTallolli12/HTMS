import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../../../common/database/prisma.service';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';
import {
  ChannelAdapter,
  ChannelAvailabilityDto,
  ChannelAvailabilityRateSyncResult,
  ChannelConfigDto,
  ChannelRateDto,
  ChannelSyncLogDto,
  ChannelSyncLogQueryDto as ContractChannelSyncLogQueryDto,
  ChannelSyncType,
  DemoChannelConfiguration,
  InboundChannelReservationResult,
  ReconciliationReportDto,
} from '@hms/api-contracts';
import { ReservationService } from '../../reservations/services/reservation.service';
import { AtsCalculatorService } from '../../inventory/services/ats-calculator.service';
import { DemoChannelAdapter } from './demo-channel.adapter';
import {
  CreateChannelConfigDto,
  GenerateReconciliationDto,
  SimulateInboundReservationDto,
  UpdateChannelConfigDto,
} from '../dto/channel-manager.dto';

const MAX_SYNC_DAYS = 90;
const DEMO_RETRY_LIMIT = 2;

@Injectable()
export class ChannelManagerService implements OnModuleInit {
  private readonly logger = new Logger(ChannelManagerService.name);
  private readonly adapters = new Map<string, ChannelAdapter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationService: ReservationService,
    private readonly atsCalculator: AtsCalculatorService,
    private readonly demoAdapter: DemoChannelAdapter,
  ) {}

  onModuleInit(): void {
    this.registerAdapter(this.demoAdapter);
  }

  registerAdapter(adapter: ChannelAdapter): void {
    if (adapter.provider !== 'DEMO' || adapter.demoOnly !== true) {
      throw new BadRequestException('This demo build only registers explicitly labelled DEMO adapters');
    }
    this.adapters.set(adapter.provider, adapter);
  }

  private getAdapter(): ChannelAdapter {
    const adapter = this.adapters.get('DEMO');
    if (!adapter) throw new BadRequestException('DEMO adapter is not available');
    return adapter;
  }

  async findChannelConfigs(propertyId: string, enabledOnly?: boolean): Promise<ChannelConfigDto[]> {
    const configs = await this.prisma.channelConfig.findMany({
      where: { propertyId, provider: 'DEMO', deletedAt: null, ...(enabledOnly !== undefined ? { enabled: enabledOnly } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return configs.map((config) => this.mapChannelConfig(config));
  }

  async findChannelConfigById(propertyId: string, id: string): Promise<ChannelConfigDto> {
    const config = await this.findRawConfig(propertyId, id);
    if (config.provider !== 'DEMO') throw new NotFoundException('Only explicitly labelled DEMO channel configurations are available');
    return this.mapChannelConfig(config);
  }

  async createChannelConfig(propertyId: string, dto: CreateChannelConfigDto, actorId?: string): Promise<ChannelConfigDto> {
    if (dto.provider !== 'DEMO') throw new BadRequestException('Only DEMO channels are available; live OTA providers are not connected');
    const configuration = this.normalizeDemoConfiguration(dto.configuration);
    await this.validateMappings(propertyId, configuration);
    const existing = await this.prisma.channelConfig.findFirst({ where: { propertyId, provider: 'DEMO' } });
    if (existing && !existing.deletedAt) throw new ConflictException('A DEMO channel is already configured for this property');
    const created = existing
      ? await this.prisma.channelConfig.update({ where: { id: existing.id }, data: { name: dto.name, enabled: true, configuration: configuration as any, fieldMapping: dto.fieldMapping || {}, deletedAt: null, lastSyncAt: null, lastError: null, version: { increment: 1 } } })
      : await this.prisma.channelConfig.create({
          data: { id: generateUuidV7(), propertyId, provider: 'DEMO', name: dto.name, enabled: true, configuration: configuration as any, fieldMapping: dto.fieldMapping || {}, version: 0 },
        });
    const event = createCloudEvent({
      type: 'channel.config.created',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/channels/${created.id}`,
      subject: created.id,
      propertyId,
      data: { propertyId, channelConfigId: created.id, provider: 'DEMO', demoOnly: true, name: dto.name, actorId },
    });
    await this.prisma.outboxEvent.create({
      data: { id: event.id, specversion: event.specversion, type: event.type, source: event.source, subject: event.subject, propertyId, datacontenttype: event.datacontenttype, time: new Date(event.time), data: event.data as any, correlationId: `channel_config_created_${created.id}` },
    });
    return this.mapChannelConfig(created);
  }

  async updateChannelConfig(propertyId: string, id: string, dto: UpdateChannelConfigDto): Promise<ChannelConfigDto> {
    const existing = await this.findRawConfig(propertyId, id);
    if (existing.provider !== 'DEMO') throw new BadRequestException('Only DEMO channel configurations can be changed in this build');
    const configuration = this.normalizeDemoConfiguration(dto.configuration !== undefined ? dto.configuration : existing.configuration);
    await this.validateMappings(propertyId, configuration);
    const updated = await this.prisma.channelConfig.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name } : {}), configuration: configuration as any, ...(dto.fieldMapping !== undefined ? { fieldMapping: dto.fieldMapping } : {}), ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}), version: { increment: 1 } },
    });
    return this.mapChannelConfig(updated);
  }

  async deleteChannelConfig(propertyId: string, id: string): Promise<void> {
    const channel = await this.findRawConfig(propertyId, id);
    if (channel.provider !== 'DEMO') throw new BadRequestException('Only DEMO channel configurations can be removed in this build');
    await this.prisma.channelConfig.update({ where: { id }, data: { deletedAt: new Date(), enabled: false } });
  }

  async processInboundReservation(propertyId: string, channelConfigId: string, dto: SimulateInboundReservationDto): Promise<InboundChannelReservationResult> {
    const channel = await this.requireEnabledDemoChannel(propertyId, channelConfigId);
    if (dto.provider !== 'DEMO') throw new BadRequestException('Only DEMO reservation fixtures are accepted; real webhooks are unavailable');
    const normalized = { ...this.demoAdapter.normalizeInbound(dto.payload), propertyId };
    const configuration = this.getDemoConfiguration(channel.configuration);
    if (String(dto.payload.externalPropertyId || '').trim() !== configuration.externalPropertyId) throw new BadRequestException('Reservation external property ID must match the configured DEMO property mapping');
    const room = configuration.roomMappings.find((item) => item.externalRoomTypeCode === normalized.roomTypeCode);
    const rate = configuration.rateMappings.find((item) => item.externalRatePlanCode === normalized.ratePlanCode);
    if (!room || !rate) throw new BadRequestException('Reservation must use mapped DEMO room and rate codes');
    if (normalized.status !== 'CONFIRMED') throw new BadRequestException('Only confirmed DEMO reservations can be ingested');
    const applicableRate = await this.prisma.ratePlanRoomType.findFirst({ where: { propertyId, roomTypeId: room.roomTypeId, ratePlanId: rate.ratePlanId, isActive: true, deletedAt: null }, select: { id: true, ratePlan: { select: { currency: true } } } });
    if (applicableRate && normalized.currency !== applicableRate.ratePlan.currency) throw new BadRequestException('Reservation currency must match the mapped PMS rate plan currency');
    if (!applicableRate) throw new BadRequestException('Mapped DEMO rate plan is not applicable to the selected room type');

    const idempotencyKey = `ota_${createHash('sha256').update(`${channel.id}:${normalized.externalId}`).digest('hex').slice(0, 60)}`;
    const correlationId = `ota_${channel.id}_${createHash('sha256').update(normalized.externalId).digest('hex').slice(0, 32)}`;
    const priorLog = await this.prisma.channelSyncLog.findFirst({ where: { propertyId, channelConfigId, syncType: 'RESERVATION_INBOUND', correlationId: { startsWith: correlationId } }, orderBy: { startedAt: 'desc' } });
    const linkedReservationId = priorLog?.status === 'SUCCESS' ? String(priorLog.correlationId || '').split('|reservation:')[1] : undefined;
    if (linkedReservationId) {
      const reservation = await this.reservationService.findById(propertyId, linkedReservationId);
      return { demoOnly: true, reservationId: normalized.externalId, confirmationNumber: reservation.confirmationNumber, isNew: false, pmsReservationId: reservation.id };
    }
    const existingReservation = await this.prisma.reservation.findUnique({ where: { uq_reservations_property_idempotency_key: { propertyId, idempotencyKey } }, select: { id: true } });
    if (existingReservation) {
      const reservation = await this.reservationService.findById(propertyId, existingReservation.id);
      if (priorLog) await this.prisma.channelSyncLog.update({ where: { id: priorLog.id }, data: { status: 'SUCCESS', recordsProcessed: 1, recordsFailed: 0, attemptCount: Math.max(1, priorLog.attemptCount || 0), errorMessage: null, correlationId: `${correlationId}|reservation:${reservation.id}`, requestPayload: { demoOnly: true, externalId: normalized.externalId, pmsReservationId: reservation.id } as any, completedAt: new Date() } });
      return { demoOnly: true, reservationId: normalized.externalId, confirmationNumber: reservation.confirmationNumber, isNew: false, pmsReservationId: reservation.id };
    }
    if (priorLog?.status === 'SUCCESS') {
      throw new ConflictException('Previous DEMO ingestion log is inconsistent with PMS idempotency state');
    }

    const syncLogId = priorLog?.id || generateUuidV7();
    const pendingLog = { status: 'PENDING' as const, recordsProcessed: 0, recordsFailed: 0, attemptCount: 0, errorMessage: null, correlationId, requestPayload: { demoOnly: true, externalId: normalized.externalId } as any, startedAt: new Date(), completedAt: null };
    if (priorLog) {
      await this.prisma.channelSyncLog.update({ where: { id: syncLogId }, data: pendingLog });
    } else {
      await this.prisma.channelSyncLog.create({ data: { id: syncLogId, channelConfigId, propertyId, syncType: 'RESERVATION_INBOUND', ...pendingLog } });
    }
    try {
      const reservationAtDispatch = await this.prisma.reservation.findUnique({ where: { uq_reservations_property_idempotency_key: { propertyId, idempotencyKey } }, select: { id: true } });
      if (reservationAtDispatch) {
        const resolved = await this.reservationService.findById(propertyId, reservationAtDispatch.id);
        await this.prisma.channelSyncLog.update({ where: { id: syncLogId }, data: { status: 'SUCCESS', recordsProcessed: 1, recordsFailed: 0, attemptCount: 1, correlationId: `${correlationId}|reservation:${resolved.id}`, requestPayload: { demoOnly: true, externalId: normalized.externalId, pmsReservationId: resolved.id } as any, completedAt: new Date() } });
        const completedAt = new Date();
        await this.prisma.channelConfig.update({ where: { id: channel.id }, data: { lastSyncAt: completedAt, lastError: null } });
        return { demoOnly: true, reservationId: normalized.externalId, confirmationNumber: resolved.confirmationNumber, isNew: false, pmsReservationId: resolved.id };
      }
      const reservation = await this.reservationService.create(propertyId, {
        roomTypeId: room.roomTypeId,
        ratePlanId: rate.ratePlanId,
        arrivalDate: normalized.arrivalDate,
        departureDate: normalized.departureDate,
        adultsCount: normalized.adults,
        childrenCount: normalized.children || 0,
        guest: { firstName: normalized.guest.firstName, lastName: normalized.guest.lastName, email: normalized.guest.email, phone: normalized.guest.phone },
        specialRequests: normalized.specialRequests,
      }, idempotencyKey);
      await this.prisma.channelSyncLog.update({ where: { id: syncLogId }, data: { status: 'SUCCESS', recordsProcessed: 1, recordsFailed: 0, attemptCount: 1, correlationId: `${correlationId}|reservation:${reservation.id}`, requestPayload: { demoOnly: true, externalId: normalized.externalId, pmsReservationId: reservation.id } as any, completedAt: new Date() } });
      const completedAt = new Date();
      await this.prisma.channelConfig.update({ where: { id: channel.id }, data: { lastSyncAt: completedAt, lastError: null } });
      return { demoOnly: true, reservationId: normalized.externalId, confirmationNumber: reservation.confirmationNumber, isNew: true, pmsReservationId: reservation.id };
    } catch (error: any) {
      await this.prisma.channelSyncLog.update({ where: { id: syncLogId }, data: { status: 'FAILED', recordsFailed: 1, attemptCount: 1, correlationId: `${correlationId}|external:${normalized.externalId}`, errorMessage: this.errorMessage(error), completedAt: new Date() } });
      await this.prisma.channelConfig.update({ where: { id: channel.id }, data: { lastSyncAt: new Date(), lastError: this.errorMessage(error) } });
      throw error;
    }
  }

  async syncAvailabilityRates(propertyId: string, channelConfigId: string, dto: { startDate: string; endDate: string; simulateTransientFailure?: boolean; simulatePermanentFailure?: boolean }): Promise<ChannelAvailabilityRateSyncResult> {
    const channel = await this.requireEnabledDemoChannel(propertyId, channelConfigId);
    const { start, end } = this.validateDateRange(dto.startDate, dto.endDate);
    const configuration = this.getDemoConfiguration(channel.configuration);
    if (!configuration.roomMappings.length || !configuration.rateMappings.length) throw new BadRequestException('Configure room and rate mappings before synchronization');
    await this.validateMappings(propertyId, configuration);
    const payloads = await this.buildPmsPayloads(propertyId, configuration, start, end);
    const request = { startDate: dto.startDate, endDate: dto.endDate, simulateTransientFailure: dto.simulateTransientFailure, simulatePermanentFailure: dto.simulatePermanentFailure };
    const availability = await this.runSyncWithRetry(channel, 'AVAILABILITY', payloads.availability, [], request);
    const rates = await this.runSyncWithRetry(channel, 'RATE', [], payloads.rates, request);
    const failures = availability.failed + rates.failed;
    const completedAt = new Date();
    await this.prisma.channelConfig.update({ where: { id: channel.id }, data: { lastSyncAt: completedAt, lastError: failures ? `${failures} DEMO availability/rate record(s) failed` : null } });
    return { demoOnly: true, processed: availability.processed + rates.processed, failed: failures, attempts: Math.max(availability.attempts, rates.attempts), availabilityProcessed: availability.processed, ratesProcessed: rates.processed };
  }

  async retrySync(propertyId: string, channelConfigId: string, syncLogId: string): Promise<ChannelSyncLogDto> {
    const channel = await this.requireEnabledDemoChannel(propertyId, channelConfigId);
    const previous = await this.prisma.channelSyncLog.findFirst({ where: { id: syncLogId, propertyId, channelConfigId } });
    if (!previous) throw new NotFoundException('Sync log not found for this channel');
    if (previous.status !== 'FAILED' || !['AVAILABILITY', 'RATE'].includes(previous.syncType)) throw new ConflictException('Only failed DEMO availability or rate syncs can be retried');
    const request = previous.requestPayload as any;
    if (!request?.startDate || !request?.endDate) throw new BadRequestException('Retry request data is missing');
    const { start, end } = this.validateDateRange(request.startDate, request.endDate);
    const configuration = this.getDemoConfiguration(channel.configuration);
    await this.validateMappings(propertyId, configuration);
    const payloads = await this.buildPmsPayloads(propertyId, configuration, start, end);
    await this.runSyncWithRetry(channel, previous.syncType as 'AVAILABILITY' | 'RATE', previous.syncType === 'AVAILABILITY' ? payloads.availability : [], previous.syncType === 'RATE' ? payloads.rates : [], { startDate: request.startDate, endDate: request.endDate }, previous.id);
    const log = await this.prisma.channelSyncLog.findFirst({ where: { propertyId, channelConfigId, retryOfId: previous.id, correlationId: { startsWith: `demo_retry_${previous.id}_` } }, orderBy: { startedAt: 'desc' } });
    if (!log) throw new ConflictException('Retry log could not be retrieved');
    return this.mapSyncLog(log);
  }

  async findSyncLogs(propertyId: string, query: ContractChannelSyncLogQueryDto): Promise<ChannelSyncLogDto[]> {
    const limit = Math.min(query.limit || 20, 100);
    const logs = await this.prisma.channelSyncLog.findMany({
      where: { propertyId, channelConfig: { provider: 'DEMO', deletedAt: null }, ...(query.channelConfigId ? { channelConfigId: query.channelConfigId } : {}), ...(query.syncType ? { syncType: query.syncType as any } : {}), ...(query.status ? { status: query.status as any } : {}), ...(query.startDate || query.endDate ? { startedAt: { ...(query.startDate ? { gte: new Date(query.startDate) } : {}), ...(query.endDate ? { lte: new Date(query.endDate) } : {}) } } : {}) },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: ((query.page || 1) - 1) * limit,
    });
    return logs.map((log) => this.mapSyncLog(log));
  }

  async generateReconciliation(propertyId: string, channelConfigId: string, dto: GenerateReconciliationDto): Promise<ReconciliationReportDto> {
    await this.requireEnabledDemoChannel(propertyId, channelConfigId);
    const { start, end } = this.validateDateRange(dto.periodStart, dto.periodEnd);
    const periodEndExclusive = new Date(end.getTime() + 86400000);
    const pmsReservations = await this.prisma.reservation.findMany({ where: { propertyId, arrivalDate: { lt: periodEndExclusive }, departureDate: { gt: start }, deletedAt: null }, select: { id: true } });
    const logs = await this.prisma.channelSyncLog.findMany({ where: { propertyId, channelConfigId, syncType: 'RESERVATION_INBOUND', status: 'SUCCESS', completedAt: { gte: start, lt: periodEndExclusive } } });
    const failedLogs = await this.prisma.channelSyncLog.findMany({ where: { propertyId, channelConfigId, syncType: 'RESERVATION_INBOUND', status: 'FAILED', completedAt: { gte: start, lt: periodEndExclusive } } });
    const successfulByExternalId = new Map<string, string | undefined>();
    for (const log of logs) {
      const [externalKey, reservationId] = String(log.correlationId || '').split('|reservation:');
      if (externalKey) successfulByExternalId.set(externalKey, reservationId || undefined);
    }
    const pmsIds = new Set(pmsReservations.map((reservation) => reservation.id));
    const linkedIds = new Set([...successfulByExternalId.values()].filter((id): id is string => !!id && pmsIds.has(id)));
    const failedByExternalId = new Map<string, any>();
    for (const log of failedLogs) {
      const correlationId = String(log.correlationId || '');
      const [externalKey, externalId] = correlationId.split('|external:');
      if (externalKey && !successfulByExternalId.has(externalKey)) failedByExternalId.set(externalKey, { log, externalId });
    }
    const pmsOnly = pmsReservations.filter((reservation) => !linkedIds.has(reservation.id)).length;
    const totalOtaReservations = successfulByExternalId.size + failedByExternalId.size;
    const otaOnly = Math.max(0, totalOtaReservations - linkedIds.size);
    const discrepancies: ReconciliationReportDto['discrepancies'] = [
      ...[...failedByExternalId.values()].map(({ log, externalId }) => ({ type: 'MISSING_IN_PMS' as const, otaReservationId: externalId, details: log.errorMessage || 'DEMO reservation ingestion failed' })),
      ...(pmsOnly ? [{ type: 'MISSING_IN_OTA' as const, details: `${pmsOnly} PMS reservation(s) have no matching successful DEMO ingestion log` }] : []),
    ];
    const report: ReconciliationReportDto = { propertyId, provider: 'DEMO', periodStart: dto.periodStart, periodEnd: dto.periodEnd, totalPmsReservations: pmsReservations.length, totalOtaReservations, matched: linkedIds.size, pmsOnly, otaOnly, discrepancies, generatedAt: new Date().toISOString() };
    await this.prisma.channelSyncLog.create({ data: { id: generateUuidV7(), channelConfigId, propertyId, syncType: 'RECONCILIATION', status: 'SUCCESS', recordsProcessed: report.totalPmsReservations + report.totalOtaReservations, recordsFailed: 0, startedAt: new Date(), completedAt: new Date() } });
    return report;
  }

  private async runSyncWithRetry(
    channel: any,
    syncType: 'AVAILABILITY' | 'RATE',
    availability: ChannelAvailabilityDto[],
    rates: ChannelRateDto[],
    request: { startDate?: string; endDate?: string; simulateTransientFailure?: boolean; simulatePermanentFailure?: boolean },
    retryOfId?: string,
  ): Promise<{ processed: number; failed: number; attempts: number }> {
    const id = generateUuidV7();
    const correlationId = retryOfId ? `demo_retry_${retryOfId}_${id}` : `demo_sync_${channel.id}_${id}`;
    const requestPayload = { demoOnly: true, startDate: request.startDate, endDate: request.endDate };
    const adapter = this.getAdapter();
    const availabilityPayload = adapter.buildAvailabilityPayload(availability);
    const ratePayload = adapter.buildRatePayload(rates);
    await this.prisma.channelSyncLog.create({ data: { id, channelConfigId: channel.id, propertyId: channel.propertyId, syncType, status: 'PENDING', recordsProcessed: 0, recordsFailed: 0, attemptCount: 0, correlationId, retryOfId: retryOfId || null, requestPayload: requestPayload as any, startedAt: new Date() } });
    let attempts = 0;
    try {
      for (let attempt = 1; attempt <= DEMO_RETRY_LIMIT; attempt++) {
        attempts += 1;
        await this.prisma.channelSyncLog.update({ where: { id }, data: { attemptCount: attempts } });
        try {
          const result = await adapter.simulateAvailabilityRateDelivery(availabilityPayload, ratePayload, attempt, request.simulateTransientFailure, request.simulatePermanentFailure);
          const completedAt = new Date();
          await this.prisma.channelSyncLog.update({ where: { id }, data: { status: result.failed > 0 ? 'PARTIAL' : 'SUCCESS', recordsProcessed: result.processed, recordsFailed: result.failed, attemptCount: attempts, errorMessage: result.failed ? `${result.failed} demo records failed` : null, correlationId: `${correlationId}|attempts:${attempts}`, completedAt } });
          await this.prisma.channelConfig.update({ where: { id: channel.id }, data: { lastSyncAt: completedAt, lastError: result.failed ? `${result.failed} demo records failed` : null } });
          return { processed: result.processed, failed: result.failed, attempts };
        } catch (error: any) {
          if (attempt === DEMO_RETRY_LIMIT) throw error;
          this.logger.warn(`DEMO ${syncType} attempt ${attempt} failed; retrying: ${this.errorMessage(error)}`);
        }
      }
      throw new Error('DEMO retry limit reached');
    } catch (error: any) {
      const completedAt = new Date();
      const message = this.errorMessage(error);
      await this.prisma.channelSyncLog.update({ where: { id }, data: { status: 'FAILED', recordsFailed: availability.length + rates.length || 1, errorMessage: message, attemptCount: attempts, correlationId: `${correlationId}|attempts:${attempts}`, completedAt } });
      await this.prisma.channelConfig.update({ where: { id: channel.id }, data: { lastSyncAt: completedAt, lastError: message } });
      return { processed: 0, failed: availability.length + rates.length || 1, attempts };
    }
  }

  private async buildPmsPayloads(propertyId: string, configuration: DemoChannelConfiguration, start: Date, end: Date): Promise<{ availability: ChannelAvailabilityDto[]; rates: ChannelRateDto[] }> {
    const roomIds = configuration.roomMappings.map((mapping) => mapping.roomTypeId);
    const rateIds = configuration.rateMappings.map((mapping) => mapping.ratePlanId);
    const [inventory, dailyRates, baseRates, roomTypes, ratePlans] = await Promise.all([
      this.prisma.dailyInventory.findMany({ where: { propertyId, roomTypeId: { in: roomIds }, businessDate: { gte: start, lte: end } }, orderBy: [{ businessDate: 'asc' }, { roomTypeId: 'asc' }] }),
      this.prisma.dailyRate.findMany({ where: { propertyId, roomTypeId: { in: roomIds }, ratePlanId: { in: rateIds }, businessDate: { gte: start, lte: end } } }),
      this.prisma.ratePlanRoomType.findMany({ where: { propertyId, roomTypeId: { in: roomIds }, ratePlanId: { in: rateIds }, isActive: true, deletedAt: null } }),
      this.prisma.roomType.findMany({ where: { propertyId, id: { in: roomIds }, isActive: true, deletedAt: null } }),
      this.prisma.ratePlan.findMany({ where: { propertyId, id: { in: rateIds }, isActive: true, deletedAt: null } }),
    ]);
    const rooms = new Set(roomTypes.map((room: any) => room.id));
    const plans = new Map(ratePlans.map((plan: any) => [plan.id, plan]));
    const invMap = new Map(inventory.map((row: any) => [`${row.roomTypeId}|${this.formatDate(row.businessDate)}`, row]));
    const dailyMap = new Map(dailyRates.map((row: any) => [`${row.ratePlanId}|${row.roomTypeId}|${this.formatDate(row.businessDate)}`, row]));
    const baseMap = new Map(baseRates.map((row: any) => [`${row.ratePlanId}|${row.roomTypeId}`, row]));
    const availability: ChannelAvailabilityDto[] = [];
    const rates: ChannelRateDto[] = [];
    for (let date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
      const day = this.formatDate(date);
      for (const room of configuration.roomMappings) {
        if (!rooms.has(room.roomTypeId)) continue;
        const inventoryRow = invMap.get(`${room.roomTypeId}|${day}`) as any;
        const ats = inventoryRow ? this.atsCalculator.calculateDailyAts(inventoryRow, false).ats : 0;
        const pairs = configuration.rateMappings.map((mapping) => ({ mapping, plan: plans.get(mapping.ratePlanId) as any, base: baseMap.get(`${mapping.ratePlanId}|${room.roomTypeId}`) as any })).filter((pair) => pair.plan && pair.base);
        const restrictions = pairs.map((pair) => dailyMap.get(`${pair.mapping.ratePlanId}|${room.roomTypeId}|${day}`) as any).filter(Boolean);
        const minimumStays = restrictions.map((row) => row.minStayDays).filter((value): value is number => Number.isInteger(value));
        const maximumStays = restrictions.map((row) => row.maxStayDays).filter((value): value is number => Number.isInteger(value));
        availability.push({ date: day, roomTypeCode: room.externalRoomTypeCode, available: ats, stopSell: ats === 0 || restrictions.some((row) => row.isClosed), minStay: minimumStays.length ? Math.max(...minimumStays) : undefined, maxStay: maximumStays.length ? Math.min(...maximumStays) : undefined, closedToArrival: restrictions.some((row) => row.isClosedToArrival), closedToDeparture: restrictions.some((row) => row.isClosedToDeparture) });
        for (const pair of pairs) {
          const daily = dailyMap.get(`${pair.mapping.ratePlanId}|${room.roomTypeId}|${day}`) as any;
          rates.push({ date: day, roomTypeCode: room.externalRoomTypeCode, ratePlanCode: pair.mapping.externalRatePlanCode, baseRate: Number(daily?.baseRateAmount ?? pair.base.baseRateAmount), currency: pair.plan.currency, overrides: daily ? { extraAdultRate: Number(daily.extraAdultRate ?? pair.base.extraAdultRate), extraChildRate: Number(daily.extraChildRate ?? pair.base.extraChildRate) } : undefined });
        }
      }
    }
    return { availability, rates };
  }

  private async validateMappings(propertyId: string, configuration: DemoChannelConfiguration): Promise<void> {
    if (!configuration.externalPropertyId || configuration.externalPropertyId.length > 100) throw new BadRequestException('A demo property mapping up to 100 characters is required');
    const roomIds = configuration.roomMappings.map((mapping) => mapping.roomTypeId);
    const rateIds = configuration.rateMappings.map((mapping) => mapping.ratePlanId);
    if (new Set(roomIds).size !== roomIds.length || new Set(rateIds).size !== rateIds.length) throw new BadRequestException('Duplicate room or rate mappings are not allowed');
    const [rooms, plans] = await Promise.all([
      roomIds.length ? this.prisma.roomType.findMany({ where: { propertyId, id: { in: roomIds }, isActive: true, deletedAt: null }, select: { id: true } }) : [],
      rateIds.length ? this.prisma.ratePlan.findMany({ where: { propertyId, id: { in: rateIds }, isActive: true, deletedAt: null }, select: { id: true } }) : [],
    ]);
    if (rooms.length !== roomIds.length || plans.length !== rateIds.length) throw new BadRequestException('Mappings must reference active PMS room types and rate plans on this property');
    if (configuration.roomMappings.some((mapping) => !mapping.externalRoomTypeCode || mapping.externalRoomTypeCode.length > 60) || configuration.rateMappings.some((mapping) => !mapping.externalRatePlanCode || mapping.externalRatePlanCode.length > 60)) throw new BadRequestException('External room/rate codes are required and limited to 60 characters');
    if (configuration.roomMappings.some((mapping) => mapping.roomTypeId.length > 100 || mapping.externalRoomTypeCode.trim() !== mapping.externalRoomTypeCode) || configuration.rateMappings.some((mapping) => mapping.ratePlanId.length > 100 || mapping.externalRatePlanCode.trim() !== mapping.externalRatePlanCode)) throw new BadRequestException('Room and rate mapping IDs must be valid and external codes cannot have surrounding whitespace');
    if (new Set(configuration.roomMappings.map((mapping) => mapping.externalRoomTypeCode)).size !== configuration.roomMappings.length || new Set(configuration.rateMappings.map((mapping) => mapping.externalRatePlanCode)).size !== configuration.rateMappings.length) throw new BadRequestException('Duplicate external room or rate mapping codes are not allowed');
    if (roomIds.length && rateIds.length) {
      const applicable = await this.prisma.ratePlanRoomType.findMany({ where: { propertyId, roomTypeId: { in: roomIds }, ratePlanId: { in: rateIds }, isActive: true, deletedAt: null }, select: { roomTypeId: true, ratePlanId: true } });
      const pairKeys = new Set(applicable.map((pair: any) => `${pair.roomTypeId}|${pair.ratePlanId}`));
      const roomWithoutRate = configuration.roomMappings.some((room) => !configuration.rateMappings.some((rate) => pairKeys.has(`${room.roomTypeId}|${rate.ratePlanId}`)));
      const rateWithoutRoom = configuration.rateMappings.some((rate) => !configuration.roomMappings.some((room) => pairKeys.has(`${room.roomTypeId}|${rate.ratePlanId}`)));
      if (roomWithoutRate || rateWithoutRoom) throw new BadRequestException('Every mapped DEMO room and rate must participate in at least one active PMS room/rate combination');
    }
  }

  private normalizeDemoConfiguration(input: any): DemoChannelConfiguration {
    if (input?.demoOnly === false || (input?.provider && input.provider !== 'DEMO')) throw new BadRequestException('Live provider settings are not accepted for the DEMO adapter');
    if (input?.roomMappings !== undefined && !Array.isArray(input.roomMappings)) throw new BadRequestException('DEMO roomMappings must be an array');
    if (input?.rateMappings !== undefined && !Array.isArray(input.rateMappings)) throw new BadRequestException('DEMO rateMappings must be an array');
    if ((input?.roomMappings?.length || 0) > 100 || (input?.rateMappings?.length || 0) > 100) throw new BadRequestException('A DEMO channel supports at most 100 room and 100 rate mappings');
    return { demoOnly: true, connectionState: 'DEMO_CONNECTED', externalPropertyId: String(input?.externalPropertyId || '').trim(), roomMappings: Array.isArray(input?.roomMappings) ? input.roomMappings.map((item: any) => ({ roomTypeId: String(item?.roomTypeId || ''), externalRoomTypeCode: String(item?.externalRoomTypeCode || '').trim() })) : [], rateMappings: Array.isArray(input?.rateMappings) ? input.rateMappings.map((item: any) => ({ ratePlanId: String(item?.ratePlanId || ''), externalRatePlanCode: String(item?.externalRatePlanCode || '').trim() })) : [] };
  }

  private getDemoConfiguration(input: any): DemoChannelConfiguration {
    const config = this.normalizeDemoConfiguration(input);
    if (!config.externalPropertyId) throw new BadRequestException('DEMO property mapping has not been configured');
    return config;
  }

  private async requireEnabledDemoChannel(propertyId: string, id: string): Promise<any> {
    const channel = await this.findRawConfig(propertyId, id);
    if (channel.provider !== 'DEMO') throw new BadRequestException('Live OTA providers are unavailable in this demo build');
    if (!channel.enabled) throw new BadRequestException('Channel is disabled');
    this.getDemoConfiguration(channel.configuration);
    return channel;
  }

  private async findRawConfig(propertyId: string, id: string): Promise<any> {
    const config = await this.prisma.channelConfig.findFirst({ where: { id, propertyId, deletedAt: null } });
    if (!config) throw new NotFoundException(`Channel configuration '${id}' not found for property`);
    return config;
  }

  private mapChannelConfig(config: any): ChannelConfigDto {
    const normalized = config.provider === 'DEMO' ? this.normalizeDemoConfiguration(config.configuration) : null;
    const connectionState = !config.enabled || config.provider !== 'DEMO'
      ? 'DISABLED'
      : normalized?.externalPropertyId
        ? 'DEMO_CONNECTED'
        : 'NOT_CONFIGURED';
    const value: DemoChannelConfiguration = normalized
      ? { ...normalized, connectionState }
      : { demoOnly: true, connectionState: 'DISABLED', externalPropertyId: '', roomMappings: [], rateMappings: [] };
    return { id: config.id, propertyId: config.propertyId, provider: config.provider, name: config.name, enabled: config.enabled, demoOnly: true, connectionState, configuration: value, fieldMapping: (config.fieldMapping || {}) as Record<string, string>, lastSyncAt: config.lastSyncAt?.toISOString() || null, lastError: config.lastError, createdAt: config.createdAt.toISOString(), updatedAt: config.updatedAt.toISOString() };
  }

  private mapSyncLog(log: any): ChannelSyncLogDto {
    return { id: log.id, channelConfigId: log.channelConfigId, propertyId: log.propertyId, syncType: log.syncType as ChannelSyncType, status: log.status, recordsProcessed: log.recordsProcessed, recordsFailed: log.recordsFailed, attemptCount: Number.isInteger(log.attemptCount) ? log.attemptCount : 1, retryOfId: log.retryOfId || null, errorMessage: log.errorMessage, correlationId: log.correlationId, startedAt: log.startedAt.toISOString(), completedAt: log.completedAt?.toISOString() || null };
  }

  private validateDateRange(startDate: string, endDate: string): { start: Date; end: Date } {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw new BadRequestException('Sync dates must use YYYY-MM-DD');
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start.toISOString().slice(0, 10) !== startDate || end.toISOString().slice(0, 10) !== endDate) throw new BadRequestException('Sync dates must be valid calendar dates');
    const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    if (!Number.isFinite(days) || days < 1 || days > MAX_SYNC_DAYS) throw new BadRequestException(`Sync range must be between 1 and ${MAX_SYNC_DAYS} days`);
    return { start, end };
  }

  private formatDate(value: Date | string): string {
    return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  }

  private errorMessage(error: any): string {
    return String(error?.message || 'Unknown demo sync error').slice(0, 1000);
  }
}
