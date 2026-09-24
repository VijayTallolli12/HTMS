import { Routes } from '@angular/router';

export const PMS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'reservations',
    pathMatch: 'full',
  },
  {
    path: 'reservations',
    loadComponent: () =>
      import('./reservations/reservations-list.component').then((m) => m.ReservationsListComponent),
    title: 'Reservations',
  },
  {
    path: 'reservations/new',
    loadComponent: () =>
      import('./reservations/reservation-create.component').then(
        (m) => m.ReservationCreateComponent,
      ),
    title: 'New Booking',
  },
  {
    path: 'reservations/:id',
    loadComponent: () =>
      import('./reservations/reservation-detail.component').then(
        (m) => m.ReservationDetailComponent,
      ),
    title: 'Reservation Details',
  },
  {
    path: 'room-operations',
    loadComponent: () =>
      import('./room-operations/room-operations.component').then(
        (m) => m.RoomOperationsComponent,
      ),
    title: 'Room Operations',
  },
  {
    path: 'housekeeping',
    loadComponent: () =>
      import('./housekeeping/housekeeping.component').then((m) => m.HousekeepingComponent),
    title: 'Housekeeping',
  },
  {
    path: 'front-office',
    loadComponent: () =>
      import('./front-office/front-office.component').then((m) => m.FrontOfficeComponent),
    title: 'Front Desk',
  },
  {
    path: 'folios',
    loadComponent: () => import('./folios/folio.component').then((m) => m.FolioComponent),
    title: 'Cashiering',
  },
  {
    path: 'folios/:folioId',
    loadComponent: () => import('./folios/folio.component').then((m) => m.FolioComponent),
    title: 'Folio Details',
  },
  {
    path: 'room-types',
    loadComponent: () =>
      import('./room-types/room-types.component').then((m) => m.RoomTypesComponent),
    title: 'Room Types',
  },
  {
    path: 'availability',
    loadComponent: () =>
      import('./availability/availability-view.component').then((m) => m.AvailabilityViewComponent),
    title: 'Availability',
  },
  {
    path: 'engineering',
    loadComponent: () =>
      import('./engineering/engineering.component').then((m) => m.EngineeringComponent),
    title: 'Engineering',
  },
];
