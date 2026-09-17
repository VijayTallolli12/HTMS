import { Routes } from '@angular/router';
import { HealthDashboardComponent } from './features/health/health-dashboard.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'health',
    pathMatch: 'full',
  },
  {
    path: 'health',
    component: HealthDashboardComponent,
    title: 'Enterprise HMS — System Status',
  },
  {
    path: 'organization',
    loadComponent: () =>
      import('./features/organization/organization-management.component').then(
        (m) => m.OrganizationManagementComponent,
      ),
    title: 'Enterprise HMS — Organization Architecture',
  },
  {
    path: '**',
    redirectTo: 'health',
  },
];
