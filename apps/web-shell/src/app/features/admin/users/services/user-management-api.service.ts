import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ApiSuccessResponse,
  ManagedUserSummaryDto,
  ManagedUserDetailDto,
  AccessiblePropertyDto,
  CreateUserRequest,
  CreateUserResponse,
  UpdateUserRequest,
  AssignUserPropertiesRequest,
} from '@hms/api-contracts';
import { environment } from '../../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserManagementApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/admin/users`;

  listUsers(query: {
    search?: string;
    role?: string;
    propertyId?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}) {
    let params = new HttpParams();
    if (query.search) params = params.set('search', query.search);
    if (query.role) params = params.set('role', query.role);
    if (query.propertyId) params = params.set('propertyId', query.propertyId);
    if (query.status) params = params.set('status', query.status);
    if (query.page) params = params.set('page', query.page.toString());
    if (query.limit) params = params.set('limit', query.limit.toString());

    return this.http.get<ApiSuccessResponse<{
      items: ManagedUserSummaryDto[];
      total: number;
      page: number;
      limit: number;
    }>>(this.baseUrl, { params });
  }

  getAccessibleProperties() {
    return this.http.get<ApiSuccessResponse<AccessiblePropertyDto[]>>(
      `${this.baseUrl}/meta/accessible-properties`,
    );
  }

  getUserById(id: string) {
    return this.http.get<ApiSuccessResponse<ManagedUserDetailDto>>(`${this.baseUrl}/${id}`);
  }

  createUser(dto: CreateUserRequest) {
    return this.http.post<ApiSuccessResponse<CreateUserResponse>>(this.baseUrl, dto);
  }

  updateUser(id: string, dto: UpdateUserRequest) {
    return this.http.patch<ApiSuccessResponse<ManagedUserDetailDto>>(`${this.baseUrl}/${id}`, dto);
  }

  assignProperties(id: string, dto: AssignUserPropertiesRequest) {
    return this.http.post<ApiSuccessResponse<ManagedUserDetailDto>>(
      `${this.baseUrl}/${id}/properties`,
      dto,
    );
  }

  removePropertyAssignment(id: string, propertyId: string) {
    return this.http.delete<ApiSuccessResponse<ManagedUserDetailDto>>(
      `${this.baseUrl}/${id}/properties/${propertyId}`,
    );
  }

  updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    return this.http.patch<ApiSuccessResponse<ManagedUserDetailDto>>(
      `${this.baseUrl}/${id}/status`,
      { status },
    );
  }
}

