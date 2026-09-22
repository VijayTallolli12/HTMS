import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
    title: 'Enterprise HMS — Sign In',
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
    title: 'Enterprise HMS — Executive Dashboard',
    canActivate: [authGuard],
  },
  {
    path: 'pms',
    loadChildren: () => import('./features/pms/pms.routes').then((m) => m.PMS_ROUTES),
    title: 'Enterprise HMS — Property Management System',
    canActivate: [authGuard],
  },
  {
    path: 'organization',
    loadComponent: () =>
      import('./features/organization/organization-management.component').then(
        (m) => m.OrganizationManagementComponent,
      ),
    title: 'Enterprise HMS — Organization Architecture',
    canActivate: [authGuard],
  },
  {
    path: 'health',
    loadComponent: () =>
      import('./features/health/health-dashboard.component').then((m) => m.HealthDashboardComponent),
    title: 'Enterprise HMS — System Status',
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
