import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { setupGuard, setupWizardGuard } from './core/guards/setup.guard';

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
    path: 'setup',
    canActivate: [setupWizardGuard],
    loadComponent: () =>
      import('./features/setup/setup-wizard.component').then((m) => m.SetupWizardComponent),
    title: 'First-Run Setup',
  },
  {
    path: 'setup-center',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/setup/setup-center.component').then((m) => m.SetupCenterComponent),
    title: 'Setup Center',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Dashboard',
    canActivate: [authGuard, setupGuard],
  },
  {
    path: 'pms',
    loadChildren: () => import('./features/pms/pms.routes').then((m) => m.PMS_ROUTES),
    title: 'Property Management',
    canActivate: [authGuard, setupGuard],
  },
  {
    path: 'organization',
    loadComponent: () =>
      import('./features/organization/organization-management.component').then(
        (m) => m.OrganizationManagementComponent,
      ),
    title: 'Organization',
    canActivate: [authGuard, setupGuard],
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
    path: 'fnb',
    redirectTo: 'pms/fnb',
    pathMatch: 'full',
  },
  {
    path: 'spa',
    redirectTo: 'pms/spa',
    pathMatch: 'full',
  },
  {
    path: 'events',
    redirectTo: 'pms/events',
    pathMatch: 'full',
  },
  {
    path: 'procurement',
    redirectTo: 'pms/procurement',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
