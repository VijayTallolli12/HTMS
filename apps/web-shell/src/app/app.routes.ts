import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
    title: 'Sign In',
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Dashboard',
    canActivate: [authGuard],
  },
  {
    path: 'pms',
    loadChildren: () => import('./features/pms/pms.routes').then((m) => m.PMS_ROUTES),
    title: 'Property Management',
    canActivate: [authGuard],
  },
  {
    path: 'organization',
    loadComponent: () =>
      import('./features/organization/organization-management.component').then(
        (m) => m.OrganizationManagementComponent,
      ),
    title: 'Organization',
    canActivate: [authGuard],
  },
  {
    path: 'health',
    loadComponent: () =>
      import('./features/health/health-dashboard.component').then((m) => m.HealthDashboardComponent),
    title: 'System Health',
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadChildren: () =>
      import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
    title: 'Settings',
    canActivate: [authGuard],
  },
  {
    path: 'settings/appearance',
    redirectTo: 'settings',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
