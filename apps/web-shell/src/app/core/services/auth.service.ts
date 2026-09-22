import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse, AuthenticationResponse } from '@hms/api-contracts';

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
