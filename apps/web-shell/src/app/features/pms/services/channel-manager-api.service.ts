import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ApiSuccessResponse,
  ChannelAvailabilityRateSyncDto,
  ChannelAvailabilityRateSyncResult,
  ChannelConfigDto,
  ChannelSyncLogDto,
  CreateChannelConfigDto,
  InboundChannelReservationResult,
  SimulateInboundReservationDto,
  UpdateChannelConfigDto,
} from '@hms/api-contracts';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChannelManagerApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private channelsUrl(propertyId: string): string {
    return `${this.baseUrl}/properties/${propertyId}/channels`;
  }

  getConfigs(propertyId: string) {
    return this.http.get<ApiSuccessResponse<ChannelConfigDto[]>>(this.channelsUrl(propertyId));
  }

  createConfig(propertyId: string, dto: CreateChannelConfigDto) {
    return this.http.post<ApiSuccessResponse<ChannelConfigDto>>(this.channelsUrl(propertyId), dto);
  }

  updateConfig(propertyId: string, id: string, dto: UpdateChannelConfigDto) {
    return this.http.patch<ApiSuccessResponse<ChannelConfigDto>>(`${this.channelsUrl(propertyId)}/${id}`, dto);
  }

  deleteConfig(propertyId: string, id: string) {
    return this.http.delete(`${this.channelsUrl(propertyId)}/${id}`);
  }

  syncAvailabilityRates(propertyId: string, id: string, dto: ChannelAvailabilityRateSyncDto) {
    return this.http.post<ApiSuccessResponse<ChannelAvailabilityRateSyncResult>>(
      `${this.channelsUrl(propertyId)}/${id}/sync/availability-rates`,
      dto,
    );
  }

  ingestReservation(propertyId: string, id: string, dto: SimulateInboundReservationDto) {
    return this.http.post<ApiSuccessResponse<InboundChannelReservationResult>>(
      `${this.channelsUrl(propertyId)}/${id}/reservations/inbound`,
      dto,
    );
  }

  getSyncLogs(propertyId: string, id: string) {
    return this.http.get<ApiSuccessResponse<ChannelSyncLogDto[]>>(
      `${this.channelsUrl(propertyId)}/${id}/sync-logs?limit=50`,
    );
  }

  retrySync(propertyId: string, id: string, syncLogId: string) {
    return this.http.post<ApiSuccessResponse<ChannelSyncLogDto>>(
      `${this.channelsUrl(propertyId)}/${id}/sync-logs/${syncLogId}/retry`,
      {},
    );
  }
}
