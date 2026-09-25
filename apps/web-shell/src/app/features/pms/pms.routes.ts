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
  {
    path: 'night-audit',
    loadComponent: () =>
      import('./night-audit/night-audit.component').then((m) => m.NightAuditComponent),
    title: 'Night Audit',
  },
  {
    path: 'fnb',
    loadComponent: () =>
      import('../fnb/fnb-workspace.component').then((m) => m.FnbWorkspaceComponent),
    title: 'Restaurant & F&B',
  },
  {
    path: 'spa',
    loadComponent: () =>
      import('../spa/spa-workspace.component').then((m) => m.SpaWorkspaceComponent),
    title: 'Spa & Wellness',
  },
  {
    path: 'crm',
    loadComponent: () =>
      import('./crm/crm-workspace.component').then((m) => m.CrmWorkspaceComponent),
    title: 'CRM & Loyalty',
  },
  {
    path: 'events',
    loadComponent: () =>
      import('../events/events-workspace.component').then((m) => m.EventsWorkspaceComponent),
    title: 'Events & Banquets',
  },
];
