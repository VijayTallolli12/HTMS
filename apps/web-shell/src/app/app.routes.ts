import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { setupGuard, setupWizardGuard } from './core/guards/setup.guard';
import { ownerGuard } from './core/guards/owner.guard';
import { permissionGuard } from './core/guards/permission.guard';

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
    path: 'admin/payment-gateways',
    canActivate: [authGuard, permissionGuard('payment_gateway:view')],
    loadComponent: () =>
      import('./features/admin/payment-gateways.component').then((m) => m.PaymentGatewaysComponent),
    title: 'Payment Gateways',
  },
  {
    path: 'admin/users',
    canActivate: [authGuard, permissionGuard('user.manage.read')],
    loadComponent: () =>
      import('./features/admin/users/user-management.component').then((m) => m.UserManagementComponent),
    title: 'User Management',
  },
  {
    path: 'owner/system-reset',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/owner/owner-system-reset.component').then((m) => m.OwnerSystemResetComponent),
    title: 'System Reset',
  },
  {
    path: 'owner/onboarding-preview',
    canActivate: [ownerGuard],
    loadComponent: () =>
      import('./features/owner/onboarding-preview.component').then((m) => m.OnboardingPreviewComponent),
    title: 'Onboarding Preview',
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
