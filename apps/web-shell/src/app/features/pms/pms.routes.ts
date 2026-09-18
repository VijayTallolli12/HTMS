import { Routes } from '@angular/router';

export const PMS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'room-types',
    pathMatch: 'full',
  },
  {
    path: 'room-types',
    loadComponent: () =>
      import('./room-types/room-types.component').then((m) => m.RoomTypesComponent),
    title: 'Enterprise HMS — PMS Room Types',
  },
  {
    path: 'availability',
    loadComponent: () =>
      import('./availability/availability-view.component').then((m) => m.AvailabilityViewComponent),
    title: 'Enterprise HMS — PMS Availability & Calendar',
  },
];
