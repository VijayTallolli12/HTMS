import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse, AuthenticationResponse, MeResponse } from '@hms/api-contracts';

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
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/auth`;

  private readonly tokenKey = 'hms_access_token';
  private readonly userKey = 'hms_user_profile';

  private readonly _token = signal<string | null>(localStorage.getItem(this.tokenKey));

  readonly currentUser = signal<UserProfile | null>(this.getStoredUser());
  readonly isAuthenticated = computed(() => !!this._token());

  getAccessToken(): string | null {
    return this._token();
  }

  private getStoredUser(): UserProfile | null {
    try {
      const stored = localStorage.getItem(this.userKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
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
        const user: UserProfile = {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          defaultPropertyId: data.activeContext?.propertyId,
        };
        this.currentUser.set(user);
        localStorage.setItem(this.userKey, JSON.stringify(user));
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
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this._token.set(null);
    this.currentUser.set(null);
  }
}
