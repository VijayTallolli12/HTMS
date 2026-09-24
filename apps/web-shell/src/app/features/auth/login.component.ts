import { Component, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UserProfile } from '../../core/services/auth.service';
import { OrganizationService } from '../../core/services/organization.service';
import { ApplicationBrandingService } from '../../core/services/application-branding.service';
import { ApiSuccessResponse, AuthenticationResponse } from '@hms/api-contracts';
import { HmsButtonComponent, HmsAlertComponent } from '../../shared/index';

interface DemoPersona {
  roleCode: string;
  roleTitle: string;
  userName: string;
  email: string;
  scopeBadge: string;
  icon: string;
}

interface SlideItem {
  headline: string;
  subtext: string;
  tag: string;
  accent: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, HmsButtonComponent, HmsAlertComponent],
  template: `
    <div class="hms-auth-viewport">
      <!-- ========================================================= -->
      <!-- LEFT VISUAL EXPERIENCE (approx 60vw on desktop)           -->
      <!-- ========================================================= -->
      <section
        class="hms-visual-panel"
        aria-label="Hospitality brand showcase"
        (mouseenter)="pauseAutoRotate()"
        (mouseleave)="resumeAutoRotate()"
        (focusin)="pauseAutoRotate()"
        (focusout)="resumeAutoRotate()"
      >
        <!-- Background Layered SVG Waves & Atmospheric Gradients -->
        <div class="visual-backdrop" aria-hidden="true">
          <svg class="backdrop-waves" viewBox="0 0 1440 900" fill="none" preserveAspectRatio="none">
            <defs>
              <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#1e293b" stop-opacity="0.9" />
                <stop offset="50%" stop-color="#0f172a" stop-opacity="0.95" />
                <stop offset="100%" stop-color="#090d16" stop-opacity="1" />
              </linearGradient>
              <linearGradient id="bronzeFlow" x1="0%" y1="0%" x2="100%" y2="50%">
                <stop offset="0%" stop-color="#9a7b38" stop-opacity="0.25" />
                <stop offset="50%" stop-color="#c5a880" stop-opacity="0.12" />
                <stop offset="100%" stop-color="#9a7b38" stop-opacity="0.03" />
              </linearGradient>
              <radialGradient id="sunGlow" cx="70%" cy="30%" r="60%">
                <stop offset="0%" stop-color="#9a7b38" stop-opacity="0.2" />
                <stop offset="60%" stop-color="#9a7b38" stop-opacity="0.04" />
                <stop offset="100%" stop-color="#0f172a" stop-opacity="0" />
              </radialGradient>
            </defs>

            <!-- Base Fill -->
            <rect width="1440" height="900" fill="url(#waveGrad1)" />

            <!-- Soft Radial Ambient Glow -->
            <rect width="1440" height="900" fill="url(#sunGlow)" />

            <!-- Organic Flow Waves -->
            <path
              d="M0 320C240 280 480 380 720 340C960 300 1200 180 1440 220V900H0V320Z"
              fill="url(#bronzeFlow)"
            />
            <path
              d="M0 480C320 420 560 520 840 470C1120 420 1280 320 1440 340V900H0V480Z"
              fill="#0b1120"
              fill-opacity="0.65"
            />
            <path
              d="M0 640C280 610 600 680 900 630C1200 580 1340 520 1440 530V900H0V640Z"
              fill="#060911"
              fill-opacity="0.8"
            />
          </svg>

          <!-- Architectural Line Geometry (Hotel Facade & Portico Motif) -->
          <div class="architectural-motif">
            <svg viewBox="0 0 600 400" fill="none" class="hotel-vector" preserveAspectRatio="xMidYMid meet">
              <!-- Terrace Balconies & Vertical Columns -->
              <g stroke="#9a7b38" stroke-opacity="0.2" stroke-width="1">
                <line x1="100" y1="120" x2="500" y2="120" />
                <line x1="120" y1="160" x2="480" y2="160" />
                <line x1="100" y1="200" x2="500" y2="200" />
                <line x1="80" y1="240" x2="520" y2="240" />
                <line x1="60" y1="280" x2="540" y2="280" />

                <!-- Colonnade Pillars -->
                <line x1="140" y1="120" x2="140" y2="280" />
                <line x1="180" y1="120" x2="180" y2="280" />
                <line x1="220" y1="120" x2="220" y2="280" />
                <line x1="260" y1="120" x2="260" y2="280" />
                <line x1="300" y1="120" x2="300" y2="280" />
                <line x1="340" y1="120" x2="340" y2="280" />
                <line x1="380" y1="120" x2="380" y2="280" />
                <line x1="420" y1="120" x2="420" y2="280" />
                <line x1="460" y1="120" x2="460" y2="280" />

                <!-- Grand Portico Arch -->
                <path d="M260 280 V 220 Q 300 190 340 220 V 280" stroke-width="1.5" stroke="#c5a880" stroke-opacity="0.45" />

                <!-- Pool Reflection Line -->
                <line x1="40" y1="320" x2="560" y2="320" stroke="#38bdf8" stroke-opacity="0.25" stroke-dasharray="8 6" />
                <line x1="80" y1="330" x2="520" y2="330" stroke="#38bdf8" stroke-opacity="0.15" stroke-dasharray="12 8" />
              </g>

              <!-- Warm Illuminated Suite Windows -->
              <g fill="#fde68a" fill-opacity="0.35">
                <rect x="148" y="130" width="24" height="18" rx="2" />
                <rect x="228" y="130" width="24" height="18" rx="2" />
                <rect x="348" y="130" width="24" height="18" rx="2" fill-opacity="0.55" />
                <rect x="428" y="130" width="24" height="18" rx="2" />

                <rect x="188" y="170" width="24" height="18" rx="2" fill-opacity="0.6" />
                <rect x="268" y="170" width="24" height="18" rx="2" />
                <rect x="388" y="170" width="24" height="18" rx="2" fill-opacity="0.4" />

                <rect x="148" y="210" width="24" height="18" rx="2" />
                <rect x="308" y="210" width="24" height="18" rx="2" fill-opacity="0.65" />
                <rect x="428" y="210" width="24" height="18" rx="2" />
              </g>
            </svg>
          </div>
        </div>

        <!-- Visual Content Top: Luxury Brand Header -->
        <div class="visual-header">
          <div class="visual-brand-pill">
            <span class="pill-dot"></span>
            <span>ENTERPRISE HOSPITALITY ARCHITECTURE</span>
          </div>
          <div class="property-tag">Tokyo Grandeur Palace · Flagship Property</div>
        </div>

        <!-- Visual Content Center: Rotating Storytelling Slides (No Arrows) -->
        <div class="visual-slider-container">
          <div class="slide-deck">
            <div
              *ngFor="let slide of slides; let i = index"
              class="slide-item"
              [class.slide-active]="activeSlide() === i"
              [attr.aria-hidden]="activeSlide() !== i"
            >
              <div class="slide-tag">{{ slide.tag }}</div>
              <h2 class="slide-headline">{{ slide.headline }}</h2>
              <p class="slide-subtext">{{ slide.subtext }}</p>
            </div>
          </div>

          <!-- Live Operational Card Overlay -->
          <div class="operational-live-badge">
            <div class="live-indicator">
              <span class="pulse-ring"></span>
              <span class="pulse-dot"></span>
              <span class="live-label">LIVE SYSTEM TELEMETRY</span>
            </div>
            <div class="live-metrics">
              <div class="live-metric">
                <span class="metric-label">Occupancy</span>
                <span class="metric-val">96.4%</span>
              </div>
              <div class="metric-divider"></div>
              <div class="live-metric">
                <span class="metric-label">In-House</span>
                <span class="metric-val">142 Rooms</span>
              </div>
              <div class="metric-divider"></div>
              <div class="live-metric">
                <span class="metric-label">HK Readiness</span>
                <span class="metric-val">99.1%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Visual Content Bottom: Pagination Dots with subtle progress -->
        <div class="visual-footer">
          <div class="slider-dots" role="tablist" aria-label="Story slides">
            <button
              *ngFor="let s of slides; let i = index"
              type="button"
              class="slider-dot-btn"
              [class.is-active]="activeSlide() === i"
              (click)="goToSlide(i)"
              [attr.aria-label]="'Slide ' + (i + 1) + ': ' + s.headline"
              [attr.aria-selected]="activeSlide() === i"
              role="tab"
            >
              <span class="dot-progress" [style.animation-play-state]="isPaused() ? 'paused' : 'running'"></span>
            </button>
          </div>
          <span class="carousel-caption">Four Seasons · Aman · Peninsula Standards</span>
        </div>
      </section>

      <!-- ========================================================= -->
      <!-- RIGHT LOGIN PANEL (approx 40vw on desktop)                -->
      <!-- ========================================================= -->
      <main class="hms-auth-panel" aria-labelledby="loginHeading">
        <div class="auth-panel-scroll">
          <div class="auth-panel-content">
            <!-- Brand Mark Header -->
            <header class="auth-brand-header">
              <div class="enterprise-brand-lockup">
                <div class="hms-crest-mark" aria-hidden="true">
                  <svg viewBox="0 0 40 40" fill="none" class="crest-svg">
                    <rect x="2" y="2" width="36" height="36" rx="8" stroke="#9a7b38" stroke-width="1.5" fill="#fdf8ee" />
                    <!-- Interlocking architectural geometry -->
                    <path d="M12 11V29M12 20H18M18 11V29" stroke="#9a7b38" stroke-width="2" stroke-linecap="round" />
                    <path d="M22 29V11L26 21L30 11V29" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <span class="crest-monogram">{{ branding.logoMark() }}</span>
                </div>
                <div class="brand-titles">
                  <h1 id="loginHeading" class="platform-title">{{ branding.applicationName() }}</h1>
                  <p class="platform-subtitle">{{ branding.applicationSubtitle() }}</p>
                </div>
              </div>
            </header>

            <!-- Welcome Intro -->
            <div class="welcome-section">
              <h2 class="welcome-heading">Welcome back</h2>
              <p class="welcome-subtext">Sign in to continue to your property workspace.</p>
            </div>

            <!-- Authentication Form -->
            <form (ngSubmit)="onLogin()" class="auth-form" novalidate>
              <!-- Email Input -->
              <div class="form-group">
                <label for="email" class="form-label">
                  <span>Email Address</span>
                </label>
                <div class="input-affix-wrapper" [class.is-focused]="focusedField === 'email'">
                  <input
                    id="email"
                    type="email"
                    [(ngModel)]="email"
                    name="email"
                    placeholder="name@tokyograndeur.demo"
                    required
                    autocomplete="username"
                    class="hms-form-input"
                    [disabled]="loading()"
                    (focus)="focusedField = 'email'"
                    (blur)="focusedField = null"
                  />
                </div>
              </div>

              <!-- Password Input -->
              <div class="form-group">
                <div class="label-row">
                  <label for="password" class="form-label">Password</label>
                  <button
                    type="button"
                    class="forgot-pwd-link"
                    (click)="showForgotNotice = true"
                  >
                    Forgot password?
                  </button>
                </div>
                <div class="input-affix-wrapper" [class.is-focused]="focusedField === 'password'">
                  <input
                    id="password"
                    [type]="showPassword() ? 'text' : 'password'"
                    [(ngModel)]="password"
                    name="password"
                    placeholder="Enter password"
                    required
                    autocomplete="current-password"
                    class="hms-form-input"
                    [disabled]="loading()"
                    (focus)="focusedField = 'password'"
                    (blur)="focusedField = null"
                  />
                  <button
                    type="button"
                    class="pwd-toggle-btn"
                    (click)="togglePasswordVisibility()"
                    [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                    [attr.aria-pressed]="showPassword()"
                    tabindex="0"
                  >
                    <svg *ngIf="!showPassword()" viewBox="0 0 20 20" fill="currentColor" class="toggle-svg" aria-hidden="true">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                    </svg>
                    <svg *ngIf="showPassword()" viewBox="0 0 20 20" fill="currentColor" class="toggle-svg" aria-hidden="true">
                      <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Remember Me & Forgot Notice -->
              <div class="form-aux-row">
                <label class="remember-label">
                  <input
                    type="checkbox"
                    [(ngModel)]="rememberMe"
                    name="rememberMe"
                    class="hms-checkbox"
                  />
                  <span>Remember workspace session</span>
                </label>
              </div>

              <!-- Forgot Notice Dialog -->
              <div *ngIf="showForgotNotice" class="forgot-notice-box" role="status">
                <div class="notice-header">
                  <span class="notice-title">Enterprise Password Recovery</span>
                  <button type="button" class="notice-close" (click)="showForgotNotice = false">×</button>
                </div>
                <p class="notice-text">
                  Self-service recovery is managed by Grandeur Hospitality IT Administration.
                  For verification access, select a seeded role from the verified demo directory below.
                </p>
              </div>

              <!-- Error Alert -->
              <div *ngIf="error()" class="auth-error-alert" role="alert">
                <hms-alert type="error" (closed)="error.set(null)">{{ error() }}</hms-alert>
              </div>

              <!-- Primary Submit Action Button -->
              <div class="submit-action-wrapper">
                <hms-button
                  type="submit"
                  variant="primary"
                  size="lg"
                  [block]="true"
                  [disabled]="loading() || !email || !password"
                >
                  <span *ngIf="loading()" class="btn-spinner" aria-hidden="true"></span>
                  <span>{{ loading() ? 'Authenticating Workspace...' : 'Sign In to Workspace' }}</span>
                  <span *ngIf="!loading()" class="btn-arrow" aria-hidden="true">→</span>
                </hms-button>
              </div>
            </form>

            <!-- Quick Access Demo Personas -->
            <section class="quick-access-section" aria-label="Quick Access Demo Personas">
              <div class="quick-access-header">
                <div class="quick-access-title-wrap">
                  <span class="quick-access-badge">QUICK ACCESS</span>
                  <span class="quick-access-hint">Select a persona</span>
                </div>
                <div class="demo-pwd-badge" title="Default deterministic seed password">
                  <span class="demo-pwd-label">Password:</span>
                  <code class="demo-pwd-code">Demo1234!</code>
                </div>
              </div>

              <!-- Persona Pills Grid (2x2) -->
              <div class="quick-access-grid">
                <button
                  *ngFor="let persona of demoPersonas"
                  type="button"
                  class="persona-chip"
                  [class.is-selected]="selectedPersona()?.email === persona.email"
                  (click)="selectDemoPersona(persona)"
                  [attr.aria-pressed]="selectedPersona()?.email === persona.email"
                >
                  <span class="chip-role">{{ persona.roleTitle }}</span>
                  <span class="chip-name">{{ persona.userName }}</span>
                </button>
              </div>
            </section>

            <!-- Enterprise Footer -->
            <footer class="auth-panel-footer">
              <div class="compliance-badges">
                <span>{{ branding.applicationName() }} v1.0</span>
                <span class="sep">·</span>
                <span>Multi-Tenant Sovereignty</span>
                <span class="sep">·</span>
                <span>Audit Trail Active</span>
              </div>
            </footer>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [],
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly orgService = inject(OrganizationService);
  readonly branding = inject(ApplicationBrandingService);
  private readonly router = inject(Router);

  email = 'admin@tokyograndeur.demo';
  password = 'Demo1234!';
  rememberMe = true;
  loading = signal(false);
  error = signal<string | null>(null);
  showPassword = signal(false);
  focusedField: 'email' | 'password' | null = null;
  showForgotNotice = false;

  // Storytelling slides
  slides: SlideItem[] = [
    {
      tag: 'Unified Property Operations',
      headline: 'Every stay, connected.',
      subtext: 'One operational platform for modern hospitality — real-time room status, reservations, and guest folios.',
      accent: '#c5a880',
    },
    {
      tag: 'Continuous Guest Lifecycle',
      headline: 'From reservation to checkout.',
      subtext: 'Keep every guest journey visible with unified ledger accounting, room allocation, and digital key cards.',
      accent: '#9a7b38',
    },
    {
      tag: 'Real-Time Inter-Department Sync',
      headline: 'Operations without friction.',
      subtext: 'Front Office, Housekeeping, and Engineering working together seamlessly on a unified transactional core.',
      accent: '#c5a880',
    },
    {
      tag: 'Multi-Property Governance',
      headline: 'Built for hotel groups.',
      subtext: 'Property-aware operations with enterprise sovereignty, strict tenant isolation, and centralized reporting.',
      accent: '#9a7b38',
    },
  ];

  activeSlide = signal(0);
  isPaused = signal(false);
  private autoRotateTimer: ReturnType<typeof setInterval> | null = null;

  // Verified deterministic seed demo accounts
  demoPersonas: DemoPersona[] = [
    {
      roleCode: 'CORP_ADMIN',
      roleTitle: 'Corporate Admin',
      userName: 'Platform Admin',
      email: 'admin@tokyograndeur.demo',
      scopeBadge: 'Group Scope',
      icon: '🛡️',
    },
    {
      roleCode: 'FDA',
      roleTitle: 'Front Desk Agent',
      userName: 'Yuki Tanaka',
      email: 'fdesk@tokyograndeur.demo',
      scopeBadge: 'Front Office',
      icon: '🛎️',
    },
    {
      roleCode: 'HK_SUPERVISOR',
      roleTitle: 'Housekeeping Supervisor',
      userName: 'Chen Wei',
      email: 'hk@tokyograndeur.demo',
      scopeBadge: 'Housekeeping',
      icon: '🧹',
    },
    {
      roleCode: 'MAINT_TECH',
      roleTitle: 'Maintenance Technician',
      userName: 'Raj Patel',
      email: 'maint@tokyograndeur.demo',
      scopeBadge: 'Engineering',
      icon: '🔧',
    },
  ];

  selectedPersona = signal<DemoPersona | null>(this.demoPersonas[0]);

  ngOnInit(): void {
    this.startAutoRotate();
  }

  ngOnDestroy(): void {
    this.stopAutoRotate();
  }

  startAutoRotate(): void {
    this.stopAutoRotate();
    this.autoRotateTimer = setInterval(() => {
      if (!this.isPaused()) {
        this.activeSlide.update((curr) => (curr + 1) % this.slides.length);
      }
    }, 5500);
  }

  stopAutoRotate(): void {
    if (this.autoRotateTimer) {
      clearInterval(this.autoRotateTimer);
      this.autoRotateTimer = null;
    }
  }

  pauseAutoRotate(): void {
    this.isPaused.set(true);
  }

  resumeAutoRotate(): void {
    this.isPaused.set(false);
  }

  goToSlide(index: number): void {
    this.activeSlide.set(index);
    this.startAutoRotate(); // reset timer
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  selectDemoPersona(persona: DemoPersona): void {
    this.email = persona.email;
    this.password = 'Demo1234!';
    this.selectedPersona.set(persona);
    this.error.set(null);
  }

  clearSelectedPersona(): void {
    this.selectedPersona.set(null);
    this.email = '';
    this.password = '';
  }

  onLogin(): void {
    if (!this.email || !this.password) return;

    this.loading.set(true);
    this.error.set(null);

    this.authService.login(this.email, this.password).subscribe({
      next: (res: ApiSuccessResponse<AuthenticationResponse>) => {
        const data = res.data;
        const user: UserProfile = {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          defaultPropertyId: data.user.defaultPropertyId || data.activeContext?.propertyId,
        };

        this.authService.setSession(data.accessToken, user);

        const propertyId = data.activeContext?.propertyId;
        if (propertyId) {
          this.orgService.getProperties().subscribe({
            next: (propRes) => {
              const property = (propRes.data || []).find((p) => p.id === propertyId);
              if (property) {
                this.orgService.setActiveProperty(property);
              }
              this.router.navigate(['/dashboard']);
            },
            error: () => {
              this.router.navigate(['/dashboard']);
            },
          });
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Login failed. Check credentials.');
      },
    });
  }
}
