import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { SetupService } from '../services/setup.service';
import { AuthService } from '../services/auth.service';

/**
 * Guards normal application routes: setup must be ACTIVE.
 *
 * - Unauthenticated -> /login
 * - Authenticated + NOT_INITIALIZED/INITIALIZING -> /setup (wizard resumes
 *   from server-confirmed milestones, not local guesses)
 * - Authenticated + ACTIVE -> allow
 *
 * When the status probe fails (API down), fail open to the normal app so an
 * infrastructure outage cannot lock operators out entirely.
 */
export const setupGuard: CanActivateFn = (_route, state) => {
  const setupService = inject(SetupService);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  return setupService.refreshStatus().pipe(
    map((status) => {
      if (!status) return true; // fail open on probe failure
      if (status.state === 'ACTIVE') return true;
      return router.createUrlTree(['/setup']);
    }),
    catchError(() => of(true)),
  );
};

/**
 * Guards the /setup wizard itself:
 * - Unauthenticated -> allowed ONLY while the database is virgin
 *   (bootstrap-admin happens mid-wizard); otherwise /login.
 * - Authenticated + ACTIVE -> /setup-center (setup is done).
 * - Authenticated + in-progress -> allowed (resume).
 */
export const setupWizardGuard: CanActivateFn = () => {
  const setupService = inject(SetupService);
  const authService = inject(AuthService);
  const router = inject(Router);

  return setupService.refreshStatus().pipe(
    map((status) => {
      const active = status?.state === 'ACTIVE';

      if (!authService.isAuthenticated()) {
        // Virgin database: allow the pre-auth wizard portion. Any completed
        // setup bounces to login.
        if (status && status.state === 'ACTIVE') {
          return router.createUrlTree(['/login']);
        }
        return true;
      }

      return active ? router.createUrlTree(['/setup-center']) : true;
    }),
    catchError(() => of(authService.isAuthenticated() ? true : router.createUrlTree(['/login']))),
  );
};
