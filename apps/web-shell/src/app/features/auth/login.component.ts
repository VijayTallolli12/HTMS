import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UserProfile } from '../../core/services/auth.service';
import { OrganizationService } from '../../core/services/organization.service';
import { ApiSuccessResponse, AuthenticationResponse } from '@hms/api-contracts';
import { HmsButtonComponent, HmsAlertComponent } from '../../shared/index';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, HmsButtonComponent, HmsAlertComponent],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <div class="brand-mark">HMS</div>
          <h1>Enterprise HMS</h1>
          <p>Hospitality Operating Platform</p>
        </div>

        <form (ngSubmit)="onLogin()" class="login-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              [(ngModel)]="email"
              name="email"
              placeholder="admin@tokyograndeur.demo"
              required
              class="hms-form-control"
              [disabled]="loading()"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              [(ngModel)]="password"
              name="password"
              placeholder="Enter password"
              required
              class="hms-form-control"
              [disabled]="loading()"
            />
          </div>

          <hms-alert type="error" *ngIf="error()">{{ error() }}</hms-alert>

          <hms-button type="submit" variant="primary" [disabled]="loading()">
            {{ loading() ? 'Signing in...' : 'Sign In' }}
          </hms-button>
        </form>

        <div class="login-footer">
          <p>Demo: admin&#64;tokyograndeur.demo / Demo1234!</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: var(--navy-primary);
    }
    .login-card {
      background: var(--navy-secondary);
      border-radius: 12px;
      padding: 40px;
      width: 400px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }
    .login-header {
      text-align: center;
      margin-bottom: 32px;
    }
    .brand-mark {
      display: inline-block;
      background: var(--status-info);
      color: white;
      font-weight: 800;
      font-size: 24px;
      padding: 8px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .login-header h1 {
      color: var(--text-primary);
      font-size: 24px;
      margin: 0 0 4px 0;
    }
    .login-header p {
      color: var(--text-secondary);
      margin: 0;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      color: var(--text-muted);
      font-size: 14px;
      margin-bottom: 6px;
    }
    .form-group input {
      width: 100%;
      padding: 10px 14px;
      background: var(--navy-primary);
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 15px;
      box-sizing: border-box;
    }
    .form-group input:focus {
      outline: none;
      border-color: var(--status-info);
    }
    .form-group input:disabled {
      opacity: 0.6;
    }
    .error-message {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid var(--status-danger);
      color: var(--status-danger);
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .login-btn {
      width: 100%;
      padding: 12px;
      background: var(--status-info);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    .login-btn:hover { background: #2563eb; }
    .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .login-footer {
      text-align: center;
      margin-top: 24px;
      color: var(--text-muted);
      font-size: 13px;
    }
  `],
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly orgService = inject(OrganizationService);
  private readonly router = inject(Router);

  email = 'admin@tokyograndeur.demo';
  password = 'Demo1234!';
  loading = signal(false);
  error = signal<string | null>(null);

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
