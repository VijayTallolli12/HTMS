import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiSuccessResponse,
  SetupStatusDto,
  BootstrapAdminRequest,
  BootstrapAdminResponse,
  SetupOrganizationRequest,
  SetupOrganizationResponse,
  SetupPropertyRequest,
  SetupPropertyResponse,
  SetupCompleteResponse,
  SetupDemoOperationResponse,
} from '@hms/api-contracts';
import { AuthService } from './auth.service';

const WIZARD_KEY = 'hms_setup_wizard_state';

export interface SetupWizardState {
  organizationType: 'INDEPENDENT' | 'CHAIN' | null;
  organization: { code: string; name: string; description?: string; regionCode?: string; regionName?: string; countryCode: string; countryName?: string } | null;
  property: SetupPropertyRequest | null;
  admin: Omit<BootstrapAdminRequest, 'password'> & { password?: string };
}

const EMPTY_WIZARD: SetupWizardState = {
  organizationType: null,
  organization: null,
  property: null,
  admin: null as never,
};

/**
 * W2 first-run setup state + API client.
 *
 * The wizard draft is persisted to localStorage so a browser refresh resumes
 * mid-wizard; authoritative progress always comes from the server.
 */
@Injectable({ providedIn: 'root' })
export class SetupService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/setup`;

  private readonly _status = signal<SetupStatusDto | null>(null);
  private readonly _wizard = signal<SetupWizardState>(this.loadWizard());

  readonly status = computed(() => this._status());
  readonly wizard = computed(() => this._wizard());

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  refreshStatus(): Observable<SetupStatusDto | null> {
    return this.http
      .get<ApiSuccessResponse<SetupStatusDto>>(`${this.baseUrl}/status`)
      .pipe(
        tap((res) => this._status.set(res.data)),
        map((res) => res.data),
        catchError(() => {
          this._status.set(null);
          return of(null);
        }),
      );
  }

  bootstrapAdmin(dto: BootstrapAdminRequest): Observable<BootstrapAdminResponse> {
    return this.http
      .post<ApiSuccessResponse<BootstrapAdminResponse>>(`${this.baseUrl}/bootstrap-admin`, dto)
      .pipe(map((r) => r.data));
  }

  setupOrganization(dto: SetupOrganizationRequest): Observable<SetupOrganizationResponse> {
    return this.http
      .post<ApiSuccessResponse<SetupOrganizationResponse>>(`${this.baseUrl}/organization`, dto)
      .pipe(map((r) => r.data));
  }

  setupProperty(dto: SetupPropertyRequest): Observable<SetupPropertyResponse> {
    return this.http
      .post<ApiSuccessResponse<SetupPropertyResponse>>(`${this.baseUrl}/property`, dto)
      .pipe(map((r) => r.data));
  }

  completeSetup(): Observable<SetupCompleteResponse> {
    return this.http
      .post<ApiSuccessResponse<SetupCompleteResponse>>(`${this.baseUrl}/complete`, {})
      .pipe(map((r) => r.data));
  }

  demoLoad(): Observable<SetupDemoOperationResponse> {
    return this.http
      .post<ApiSuccessResponse<SetupDemoOperationResponse>>(`${this.baseUrl}/demo/load`, {})
      .pipe(map((r) => r.data));
  }

  demoReset(): Observable<SetupDemoOperationResponse> {
    return this.http
      .post<ApiSuccessResponse<SetupDemoOperationResponse>>(`${this.baseUrl}/demo/reset`, {})
      .pipe(map((r) => r.data));
  }

  demoRemove(): Observable<SetupDemoOperationResponse> {
    return this.http
      .post<ApiSuccessResponse<SetupDemoOperationResponse>>(`${this.baseUrl}/demo/remove`, {})
      .pipe(map((r) => r.data));
  }

  // ===========================================================================
  // Wizard draft persistence (localStorage)
  // ===========================================================================

  get wizardState(): SetupWizardState {
    return this._wizard();
  }

  patchWizard(patch: Partial<SetupWizardState>): void {
    const next = { ...this._wizard(), ...patch };
    this._wizard.set(next);
    try {
      localStorage.setItem(WIZARD_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: wizard still works, just no resume
    }
  }

  clearWizard(): void {
    this._wizard.set({ ...EMPTY_WIZARD });
    try {
      localStorage.removeItem(WIZARD_KEY);
    } catch {
      // ignore
    }
  }

  /** True when the wizard has enough state to resume directly at a later step. */
  readonly resumeStep = computed<number>(() => {
    const w = this._wizard();
    if (w.admin?.firstName) return 6; // First Administrator
    if (w.property) return 4; // Property Details
    if (w.organization) return 3; // Organization Details
    if (w.organizationType) return 2; // Organization Type
    return 0; // Welcome
  });

  private loadWizard(): SetupWizardState {
    try {
      const raw = localStorage.getItem(WIZARD_KEY);
      return raw ? { ...EMPTY_WIZARD, ...JSON.parse(raw) } : { ...EMPTY_WIZARD };
    } catch {
      return { ...EMPTY_WIZARD };
    }
  }

  /**
   * Signs the freshly bootstrapped administrator in so the authenticated
   * POST /setup/complete call succeeds without re-typing credentials.
   */
  autoSignIn(email: string, password: string): Observable<boolean> {
    return this.authService.login(email, password).pipe(
      map((res) => {
        const data = res.data;
        const user = {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          defaultPropertyId: data.user.defaultPropertyId || data.activeContext?.propertyId,
        };
        this.authService.setSession(data.accessToken, user);
        return true;
      }),
      catchError(() => of(false)),
    );
  }
}
