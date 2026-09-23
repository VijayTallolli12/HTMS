import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiSuccessResponse,
  AuthenticationResponse,
  MeResponse,
  UserRoleSummaryDto,
  UserRoleScopeSummaryDto,
  ActiveAuthContext,
  PropertyDto,
} from '@hms/api-contracts';
import { OrganizationService } from './organization.service';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
  defaultPropertyId?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly orgService = inject(OrganizationService);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/auth`;

  private readonly tokenKey = 'hms_access_token';
  private readonly userKey = 'hms_user_profile';
  private readonly rolesKey = 'hms_user_roles';
  private readonly scopesKey = 'hms_user_scopes';
  private readonly permissionsKey = 'hms_user_permissions';
  private readonly activeContextKey = 'hms_active_auth_context';

  private readonly _token = signal<string | null>(localStorage.getItem(this.tokenKey));

  readonly currentUser = signal<UserProfile | null>(this.getStoredUser());
  readonly roles = signal<UserRoleSummaryDto[]>(this.getStoredItem<UserRoleSummaryDto[]>(this.rolesKey, []));
  readonly roleScopes = signal<UserRoleScopeSummaryDto[]>(this.getStoredItem<UserRoleScopeSummaryDto[]>(this.scopesKey, []));
  readonly permissions = signal<string[]>(this.getStoredItem<string[]>(this.permissionsKey, []));
  readonly activeContext = signal<ActiveAuthContext | null>(this.getStoredItem<ActiveAuthContext | null>(this.activeContextKey, null));

  // Expose active property context reactively from organization service
  readonly activePropertyContext = this.orgService.activePropertyContext;

  readonly isAuthenticated = computed(() => !!this._token());
  readonly primaryRole = computed(() => this.roles()[0] || null);

  getAccessToken(): string | null {
    return this._token();
  }

  private getStoredUser(): UserProfile | null {
    return this.getStoredItem<UserProfile | null>(this.userKey, null);
  }

  private getStoredItem<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  login(email: string, password: string) {
    return this.http.post<ApiSuccessResponse<AuthenticationResponse>>(`${this.baseUrl}/login`, {
      email,
      password,
      clientType: 'web',
    });
  }

  validateSession(): Observable<ApiSuccessResponse<MeResponse> | null> {
    const token = this._token();
    if (!token) {
      return of(null as ApiSuccessResponse<MeResponse> | null);
    }
    return this.http.get<ApiSuccessResponse<MeResponse>>(`${this.baseUrl}/me`).pipe(
      tap((res) => {
        const data = res.data;
        const roles = data.roles || [];
        const roleScopes = data.roleScopes || [];
        const permissions = data.permissions || [];
        const activeContext = data.activeContext || null;

        const primaryRole = roles[0];
        const user: UserProfile = {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          role: primaryRole ? (primaryRole.name || primaryRole.code) : undefined,
          defaultPropertyId: data.activeContext?.propertyId || data.user.defaultPropertyId,
        };

        this.currentUser.set(user);
        this.roles.set(roles);
        this.roleScopes.set(roleScopes);
        this.permissions.set(permissions);
        this.activeContext.set(activeContext);

        localStorage.setItem(this.userKey, JSON.stringify(user));
        localStorage.setItem(this.rolesKey, JSON.stringify(roles));
        localStorage.setItem(this.scopesKey, JSON.stringify(roleScopes));
        localStorage.setItem(this.permissionsKey, JSON.stringify(permissions));
        if (activeContext) {
          localStorage.setItem(this.activeContextKey, JSON.stringify(activeContext));
        } else {
          localStorage.removeItem(this.activeContextKey);
        }
      }),
      catchError(() => {
        this.logout();
        this.router.navigate(['/login']);
        return of(null as ApiSuccessResponse<MeResponse> | null);
      }),
    );
  }

  setSession(token: string, user: UserProfile): void {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this._token.set(token);
    this.currentUser.set(user);
    this.validateSession().subscribe();
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.rolesKey);
    localStorage.removeItem(this.scopesKey);
    localStorage.removeItem(this.permissionsKey);
    localStorage.removeItem(this.activeContextKey);
    this._token.set(null);
    this.currentUser.set(null);
    this.roles.set([]);
    this.roleScopes.set([]);
    this.permissions.set([]);
    this.activeContext.set(null);
    this.orgService.setActiveProperty(null);
  }

  hasRole(roleCode: string): boolean {
    return this.roles().some((r) => r.code === roleCode);
  }

  hasPermission(permissionCode: string): boolean {
    return this.permissions().includes(permissionCode);
  }
}
