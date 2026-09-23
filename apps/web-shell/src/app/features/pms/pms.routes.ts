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
    title: 'Enterprise HMS — Reservations Registry',
  },
  {
    path: 'reservations/new',
    loadComponent: () =>
      import('./reservations/reservation-create.component').then(
        (m) => m.ReservationCreateComponent,
      ),
    title: 'Enterprise HMS — New Booking',
  },
  {
    path: 'reservations/:id',
    loadComponent: () =>
      import('./reservations/reservation-detail.component').then(
        (m) => m.ReservationDetailComponent,
      ),
    title: 'Enterprise HMS — Reservation Details',
  },
  {
    path: 'room-operations',
    loadComponent: () =>
      import('./room-operations/room-operations.component').then(
        (m) => m.RoomOperationsComponent,
      ),
    title: 'Enterprise HMS — Room Operations & Tape Chart',
  },
  {
    path: 'housekeeping',
    loadComponent: () =>
      import('./housekeeping/housekeeping.component').then((m) => m.HousekeepingComponent),
    title: 'Enterprise HMS — Housekeeping Operations',
  },
  {
    path: 'front-office',
    loadComponent: () =>
      import('./front-office/front-office.component').then((m) => m.FrontOfficeComponent),
    title: 'Enterprise HMS — Front Office & Arrivals',
  },
  {
    path: 'folios',
    loadComponent: () => import('./folios/folio.component').then((m) => m.FolioComponent),
    title: 'Enterprise HMS — Cashiering & Folio Settlement',
  },
  {
    path: 'folios/:folioId',
    loadComponent: () => import('./folios/folio.component').then((m) => m.FolioComponent),
    title: 'Enterprise HMS — Folio Details & Checkout',
  },
  {
    path: 'room-types',
    loadComponent: () =>
      import('./room-types/room-types.component').then((m) => m.RoomTypesComponent),
    title: 'Enterprise HMS — Room Types & Capacity',
  },
  {
    path: 'availability',
    loadComponent: () =>
      import('./availability/availability-view.component').then((m) => m.AvailabilityViewComponent),
    title: 'Enterprise HMS — PMS Availability & Calendar',
  },
  {
    path: 'engineering',
    loadComponent: () =>
      import('./engineering/engineering.component').then((m) => m.EngineeringComponent),
    title: 'Enterprise HMS — Engineering & Facilities',
  },
];
