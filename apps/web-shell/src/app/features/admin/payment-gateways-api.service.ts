import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ApiSuccessResponse,
  PaymentGatewayConfigDto,
  PaymentGatewayConnectionTestDto,
  PaymentGatewayProviderCatalogItem,
  SavePaymentGatewayConfigDto,
  UpdatePaymentGatewayConfigDto,
} from '@hms/api-contracts';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PaymentGatewaysApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;
  private endpoint(propertyId: string): string { return `${this.baseUrl}/properties/${propertyId}/payment-gateways`; }

  getCatalog(propertyId: string) {
    return this.http.get<ApiSuccessResponse<PaymentGatewayProviderCatalogItem[]>>(`${this.endpoint(propertyId)}/catalog`);
  }
  getConfigs(propertyId: string) {
    return this.http.get<ApiSuccessResponse<PaymentGatewayConfigDto[]>>(this.endpoint(propertyId));
  }
  createConfig(propertyId: string, dto: SavePaymentGatewayConfigDto) {
    return this.http.post<ApiSuccessResponse<PaymentGatewayConfigDto>>(this.endpoint(propertyId), dto);
  }
  updateConfig(propertyId: string, id: string, dto: UpdatePaymentGatewayConfigDto) {
    return this.http.patch<ApiSuccessResponse<PaymentGatewayConfigDto>>(`${this.endpoint(propertyId)}/${id}`, dto);
  }
  testConnection(propertyId: string, id: string) {
    return this.http.post<ApiSuccessResponse<PaymentGatewayConnectionTestDto>>(`${this.endpoint(propertyId)}/${id}/test-connection`, { gatewayId: id });
  }
  setEnabled(propertyId: string, id: string, enabled: boolean) {
    return this.http.post<ApiSuccessResponse<PaymentGatewayConfigDto>>(`${this.endpoint(propertyId)}/${id}/${enabled ? 'enable' : 'disable'}`, {});
  }
}
