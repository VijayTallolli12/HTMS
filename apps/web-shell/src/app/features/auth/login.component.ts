import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UserProfile } from '../../core/services/auth.service';
import { OrganizationService } from '../../core/services/organization.service';
import { ApiSuccessResponse, AuthenticationResponse } from '@hms/api-contracts';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
              [disabled]="loading()"
            />
          </div>

          <div class="error-message" *ngIf="error()">
            {{ error() }}
          </div>

          <button type="submit" class="login-btn" [disabled]="loading()">
            {{ loading() ? 'Signing in...' : 'Sign In' }}
          </button>
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
      background: #0f172a;
    }
    .login-card {
      background: #1e293b;
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
      background: #3b82f6;
      color: white;
      font-weight: 800;
      font-size: 24px;
      padding: 8px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .login-header h1 {
      color: #f1f5f9;
      font-size: 24px;
      margin: 0 0 4px 0;
    }
    .login-header p {
      color: #94a3b8;
      margin: 0;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      color: #cbd5e1;
      font-size: 14px;
      margin-bottom: 6px;
    }
    .form-group input {
      width: 100%;
      padding: 10px 14px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #f1f5f9;
      font-size: 15px;
      box-sizing: border-box;
    }
    .form-group input:focus {
      outline: none;
      border-color: #3b82f6;
    }
    .form-group input:disabled {
      opacity: 0.6;
    }
    .error-message {
      background: #451a1a;
      border: 1px solid #ef4444;
      color: #fca5a5;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .login-btn {
      width: 100%;
      padding: 12px;
      background: #3b82f6;
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
      color: #64748b;
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
        this.orgService.setActiveProperty(null);

        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Login failed. Check credentials.');
      },
    });
  }
}
