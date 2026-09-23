import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'hms-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <div class="hms-sidebar__section">
      <div class="hms-sidebar__section-title">Workspace</div>
      <a routerLink="/dashboard" routerLinkActive="hms-sidebar__item--active" class="hms-sidebar__item">
        <span class="hms-sidebar__item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M4 13h7V4H4v9zm0 7h7v-5H4v5zm9 0h7V11h-7v9zm0-16v5h7V4h-7z"/></svg>
        </span>
        <span>Dashboard</span>
      </a>
    </div>

    <div class="hms-sidebar__section">
      <div class="hms-sidebar__section-title">Operations</div>
      <a routerLink="/pms/front-office" routerLinkActive="hms-sidebar__item--active" class="hms-sidebar__item">
        <span class="hms-sidebar__item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9zm2.5-.5a.5.5 0 0 0-.5.5v9c0 .28.22.5.5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-13zm2 3.5h9v2h-9v-2zm0 4h6v2h-6v-2z"/></svg>
        </span>
        <span>Front Desk</span>
      </a>
      <a routerLink="/pms/housekeeping" routerLinkActive="hms-sidebar__item--active" class="hms-sidebar__item">
        <span class="hms-sidebar__item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M12 2c2.5 2.4 3.5 4.3 3.5 6.3A3.5 3.5 0 0 1 12 12a3.5 3.5 0 0 1-3.5-3.7C8.5 6.3 9.5 4.4 12 2zm7 14.5c0 3.4-3.1 5.5-7 5.5s-7-2.1-7-5.5c0-2.4 1.9-4.5 4.8-5.1l1.8 2.1c-1.1.4-1.8 1.5-1.8 2.8 0 1.8 1.5 3.3 3.3 3.3 1.8 0 3.3-1.5 3.3-3.3 0-1.3-.7-2.4-1.8-2.8l1.8-2.1c2.9.6 4.8 2.7 4.8 5.1z"/></svg>
        </span>
        <span>Housekeeping</span>
      </a>
      <a routerLink="/pms/room-operations" routerLinkActive="hms-sidebar__item--active" class="hms-sidebar__item">
        <span class="hms-sidebar__item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm1 4h10v2H7V8zm0 4h7v2H7v-2zm0 4h5v2H7v-2z"/></svg>
        </span>
        <span>Room Operations</span>
      </a>
      <a routerLink="/pms/availability" routerLinkActive="hms-sidebar__item--active" class="hms-sidebar__item">
        <span class="hms-sidebar__item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V2zm13 8H4v9h16v-9zm-9 2v2H6v-2h5zm7 0v2h-5v-2h5z"/></svg>
        </span>
        <span>Inventory ATS</span>
      </a>
      <a routerLink="/pms/reservations" routerLinkActive="hms-sidebar__item--active" class="hms-sidebar__item">
        <span class="hms-sidebar__item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V2zm13 8H4v9h16v-9zm-9 2v2H6v-2h5zm7 0v2h-5v-2h5z"/></svg>
        </span>
        <span>Reservations</span>
      </a>
    </div>

    <div class="hms-sidebar__section">
      <div class="hms-sidebar__section-title">Finance</div>
      <a routerLink="/pms/folios" routerLinkActive="hms-sidebar__item--active" class="hms-sidebar__item">
        <span class="hms-sidebar__item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M12 2a5 5 0 0 1 5 5v1h1a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3h1V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v1h6V7a3 3 0 0 0-3-3zm-5 7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1H7zm5 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg>
        </span>
        <span>Cashiering</span>
      </a>
    </div>

    <div class="hms-sidebar__section">
      <div class="hms-sidebar__section-title">System</div>
      <a routerLink="/organization" routerLinkActive="hms-sidebar__item--active" class="hms-sidebar__item">
        <span class="hms-sidebar__item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M4 19h16v2H4v-2zm2-2h2V7H6v10zm5 0h2V4h-2v13zm5 0h2V9h-2v8z"/></svg>
        </span>
        <span>Organization</span>
      </a>
      <a routerLink="/health" routerLinkActive="hms-sidebar__item--active" class="hms-sidebar__item">
        <span class="hms-sidebar__item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A4.5 4.5 0 0 1 6.5 4c1.74 0 3.41.81 4.5 2.09A6.17 6.17 0 0 1 15.5 4 4.5 4.5 0 0 1 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        </span>
        <span>System Status</span>
      </a>
    </div>
  `,
  styles: [],
})
export class HmsSidebarComponent {}
