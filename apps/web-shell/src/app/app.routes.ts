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
    path: '**',
    redirectTo: 'health',
  },
];
