import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { OrganizationService } from '../../../core/services/organization.service';
import { PmsApiService } from '../services/pms-api.service';
import { ChannelManagerApiService } from '../services/channel-manager-api.service';
import {
  ChannelConfigDto,
  ChannelSyncLogDto,
  CreateChannelConfigDto,
  RatePlanDto,
  RoomTypeDto,
} from '@hms/api-contracts';

@Component({
  selector: 'app-channel-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './channel-manager.component.html',
  styleUrls: ['./channel-manager.component.css'],
})
export class ChannelManagerComponent {
  private readonly auth = inject(AuthService);
  private readonly organization = inject(OrganizationService);
  private readonly pmsApi = inject(PmsApiService);
  private readonly channelApi = inject(ChannelManagerApiService);

  readonly activeProperty = this.organization.activePropertyContext;
  readonly configs = signal<ChannelConfigDto[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly roomTypes = signal<RoomTypeDto[]>([]);
  readonly ratePlans = signal<RatePlanDto[]>([]);
  readonly logs = signal<ChannelSyncLogDto[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly isSyncing = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  get canCreate(): boolean {
    return this.auth.hasPermission('channel:create');
  }
  get canManage(): boolean {
    return this.selectedId() ? this.auth.hasPermission('channel:update') : this.canCreate;
  }
  get canSync(): boolean {
    return this.auth.hasPermission('channel:sync');
  }
  get canViewChannels(): boolean {
    return this.auth.hasPermission('channel:read');
  }
  get canDelete(): boolean {
    return this.auth.hasPermission('channel:delete');
  }

  form = this.emptyForm();
  syncStartDate = new Date().toISOString().slice(0, 10);
  syncEndDate = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
  simulateTransientFailure = false;
  simulatePermanentFailure = false;
  fixtureExternalId = `DEMO-${Date.now().toString().slice(-6)}`;
  fixtureArrivalDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  fixtureDepartureDate = new Date(Date.now() + 16 * 86400000).toISOString().slice(0, 10);
  fixtureAdults = 2;
  fixtureChildren = 0;
  fixtureGuestFirstName = 'Demo';
  fixtureGuestLastName = 'Guest';

  constructor() {
    effect(() => {
      const propertyId = this.activeProperty()?.id;
      if (propertyId) this.load(propertyId);
    });
  }

  private emptyForm() {
    return {
      name: 'DEMO Channel',
      externalPropertyId: '',
      roomMappings: [] as Array<{ roomTypeId: string; externalRoomTypeCode: string }>,
      rateMappings: [] as Array<{ ratePlanId: string; externalRatePlanCode: string }>,
    };
  }

  hasPermission(permission: string): boolean {
    return this.auth.hasPermission(permission);
  }

  load(propertyId = this.activeProperty()?.id): void {
    if (!propertyId) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.pmsApi.getRoomTypes(propertyId, true).subscribe({
      next: (res) => this.roomTypes.set(res.data || []),
      error: () => this.roomTypes.set([]),
    });
    this.pmsApi.getRatePlans(propertyId, true).subscribe({
      next: (res) => this.ratePlans.set(res.data || []),
      error: () => this.ratePlans.set([]),
    });
    this.channelApi.getConfigs(propertyId).subscribe({
      next: (res) => {
        this.configs.set(res.data || []);
        const currentId = this.selectedId();
        const selected = res.data?.find((item) => item.id === currentId) || res.data?.[0];
        this.isLoading.set(false);
        if (selected) this.selectConfig(selected);
        else {
          this.selectedId.set(null);
          this.form = this.emptyForm();
          this.logs.set([]);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.message || 'Unable to load demo channel configurations');
      },
    });
  }

  selectConfig(config: ChannelConfigDto): void {
    this.selectedId.set(config.id);
    this.form = {
      name: config.name,
      externalPropertyId: config.configuration.externalPropertyId || '',
      roomMappings: config.configuration.roomMappings?.map((mapping) => ({ ...mapping })) || [],
      rateMappings: config.configuration.rateMappings?.map((mapping) => ({ ...mapping })) || [],
    };
    this.loadLogs();
  }

  startNewConfig(): void {
    this.selectedId.set(null);
    this.form = this.emptyForm();
    this.logs.set([]);
    this.errorMessage.set(null);
    this.notice.set(null);
  }

  addRoomMapping(): void {
    this.form.roomMappings = [...this.form.roomMappings, { roomTypeId: '', externalRoomTypeCode: '' }];
  }

  removeRoomMapping(index: number): void {
    this.form.roomMappings = this.form.roomMappings.filter((_, i) => i !== index);
  }

  addRateMapping(): void {
    this.form.rateMappings = [...this.form.rateMappings, { ratePlanId: '', externalRatePlanCode: '' }];
  }

  removeRateMapping(index: number): void {
    this.form.rateMappings = this.form.rateMappings.filter((_, i) => i !== index);
  }

  saveConfig(): void {
    const propertyId = this.activeProperty()?.id;
    if (!propertyId || !this.form.name.trim() || !this.form.externalPropertyId.trim()) return;
    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.notice.set(null);
    const dto = {
      name: this.form.name.trim(),
      configuration: {
        demoOnly: true as const,
        connectionState: 'DEMO_CONNECTED' as const,
        externalPropertyId: this.form.externalPropertyId.trim(),
        roomMappings: this.form.roomMappings.filter((item) => item.roomTypeId && item.externalRoomTypeCode.trim()),
        rateMappings: this.form.rateMappings.filter((item) => item.ratePlanId && item.externalRatePlanCode.trim()),
      },
    };
    const request = this.selectedId()
      ? this.channelApi.updateConfig(propertyId, this.selectedId()!, dto)
      : this.channelApi.createConfig(propertyId, { provider: 'DEMO', ...dto } as CreateChannelConfigDto);
    request.subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.notice.set('DEMO channel configuration saved. No live provider was contacted.');
        this.load(propertyId);
        if (res.data) this.selectConfig(res.data);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.message || 'Unable to save channel configuration');
      },
    });
  }

  toggleEnabled(): void {
    const propertyId = this.activeProperty()?.id;
    const config = this.selectedConfig();
    if (!propertyId || !config || !this.hasPermission('channel:update')) return;
    this.channelApi.updateConfig(propertyId, config.id, { enabled: !config.enabled }).subscribe({
      next: () => this.load(propertyId),
      error: (err) => this.errorMessage.set(err?.error?.message || 'Unable to update channel state'),
    });
  }

  deleteConfig(): void {
    const propertyId = this.activeProperty()?.id;
    const config = this.selectedConfig();
    if (!propertyId || !config || !this.hasPermission('channel:delete')) return;
    this.channelApi.deleteConfig(propertyId, config.id).subscribe({
      next: () => {
        this.selectedId.set(null);
        this.notice.set('DEMO channel configuration removed.');
        this.load(propertyId);
      },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Unable to remove channel configuration'),
    });
  }

  selectedConfig(): ChannelConfigDto | null {
    return this.configs().find((item) => item.id === this.selectedId()) || null;
  }

  sync(): void {
    const propertyId = this.activeProperty()?.id;
    const config = this.selectedConfig();
    if (!propertyId || !config || !this.canSync) return;
    this.isSyncing.set(true);
    this.errorMessage.set(null);
    this.notice.set(null);
    this.channelApi.syncAvailabilityRates(propertyId, config.id, {
      startDate: this.syncStartDate,
      endDate: this.syncEndDate,
      simulateTransientFailure: this.simulateTransientFailure,
      simulatePermanentFailure: this.simulatePermanentFailure,
    }).subscribe({
      next: (res) => {
        this.isSyncing.set(false);
        const result = res.data;
        const summary = `DEMO sync ${result?.failed ? 'finished with failures' : 'complete'}: ${result?.availabilityProcessed || 0} availability and ${result?.ratesProcessed || 0} rate records; ${result?.failed || 0} failed (${result?.attempts || 1} attempt(s)).`;
        this.notice.set(summary);
        this.simulateTransientFailure = false;
        this.simulatePermanentFailure = false;
        this.loadLogs();
        this.load();
      },
      error: (err) => {
        this.isSyncing.set(false);
        this.errorMessage.set(err?.error?.message || 'DEMO sync failed');
        this.loadLogs();
      },
    });
  }

  ingestReservation(): void {
    const propertyId = this.activeProperty()?.id;
    const config = this.selectedConfig();
    const room = this.form.roomMappings.find((item) => item.roomTypeId && item.externalRoomTypeCode);
    const rate = this.form.rateMappings.find((item) => item.ratePlanId && item.externalRatePlanCode);
    if (!propertyId || !config || !room || !rate || !this.canSync) return;
    this.errorMessage.set(null);
    this.notice.set(null);
    this.channelApi.ingestReservation(propertyId, config.id, {
      provider: 'DEMO',
      payload: {
        externalPropertyId: this.form.externalPropertyId,
        externalId: this.fixtureExternalId,
        roomTypeCode: room.externalRoomTypeCode,
        ratePlanCode: rate.externalRatePlanCode,
        arrivalDate: this.fixtureArrivalDate,
        departureDate: this.fixtureDepartureDate,
        adults: Number(this.fixtureAdults),
        children: Number(this.fixtureChildren),
        totalAmount: 0,
        currency: this.activeProperty()?.currency || 'USD',
        guest: { firstName: this.fixtureGuestFirstName, lastName: this.fixtureGuestLastName },
      },
    }).subscribe({
      next: (res) => {
        const result = res.data;
        this.notice.set(`${result?.isNew ? 'Demo reservation ingested' : 'Idempotent replay'}: ${result?.confirmationNumber} (PMS ${result?.pmsReservationId}).`);
        this.loadLogs();
        this.load(propertyId);
        this.fixtureExternalId = `DEMO-${Date.now().toString().slice(-6)}`;
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Demo reservation ingestion failed');
        this.loadLogs();
      },
    });
  }

  retry(log: ChannelSyncLogDto): void {
    const propertyId = this.activeProperty()?.id;
    const config = this.selectedConfig();
    if (!propertyId || !config) return;
    this.channelApi.retrySync(propertyId, config.id, log.id).subscribe({
      next: () => {
        this.notice.set('DEMO retry completed. Review the updated sync log for its status.');
        this.loadLogs();
      },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Unable to retry demo sync'),
    });
  }

  loadLogs(): void {
    const propertyId = this.activeProperty()?.id;
    const id = this.selectedId();
    if (!propertyId || !id) return;
    this.channelApi.getSyncLogs(propertyId, id).subscribe({
      next: (res) => this.logs.set(res.data || []),
      error: () => this.logs.set([]),
    });
  }
}
