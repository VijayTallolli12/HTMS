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
    path: 'pms',
    loadChildren: () => import('./features/pms/pms.routes').then((m) => m.PMS_ROUTES),
    title: 'Enterprise HMS — Property Management System',
  },
  {
    path: '**',
    redirectTo: 'health',
  },
];
