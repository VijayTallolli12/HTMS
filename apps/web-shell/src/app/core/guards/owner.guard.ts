import { Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

/**
 * Owner-only access guard for owner tools (system reset, onboarding preview).
 *
 * Uses the existing authorization architecture: the session's granted roles
 * (AuthService.roles()). No new permissions are introduced and RBAC is not
 * weakened — the route simply requires the PLATFORM_OWNER role in addition to
 * being authenticated.
 */
@Injectable({ providedIn: 'root' })
export class OwnerGuard {
  static canActivate: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/login']);
      return false;
    }
    if (authService.hasRole('PLATFORM_OWNER')) {
      return true;
    }
    router.navigate(['/dashboard']);
    return false;
  };
}

export const ownerGuard: CanActivateFn = OwnerGuard.canActivate;
