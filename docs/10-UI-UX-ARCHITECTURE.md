# Frontend & UI/UX Architecture: Enterprise HMS

## 1. Architectural Philosophy: Modern Angular Domain Shell
The Enterprise HMS frontend is engineered using **Angular 18+** with **Signals**, **Standalone Components**, and **Domain-Driven Module Boundaries**. It avoids monolithic bloated bundles by leveraging lazy-loaded domain packages organized within an enterprise monorepo workspace.

```
+-------------------------------------------------------------------------------+
|                            Enterprise HMS App Shell                           |
|  +-------------------------------------------------------------------------+  |
|  | Global Header: [Brand Logo] [Property Selector] [Dept Context] [User]   |  |
|  +-------------------------------------------------------------------------+  |
|  | Sidebar Navigation (Role-Aware & Scope-Filtered)                        |  |
|  |                                                                         |  |
|  |  [Dashboard] [Reservations] [Room Board] [Housekeeping] [Folios] [Admin]|  |
|  +-------------------------------------------------------------------------+  |
|  | Dynamic Workspace / Active Domain View (Lazy-Loaded Feature Chunk)      |  |
|  |                                                                         |  |
|  |  +-------------------------------------------------------------------+  |  |
|  |  | Active Route: /properties/prop_tokyo/frontdesk/tape-chart          |  |  |
|  |  | (High-density tape chart with real-time WebSocket signals)        |  |  |
|  |  +-------------------------------------------------------------------+  |  |
|  +-------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------+
```

---

## 2. Shell Architecture & Context Switching

### 2.1 Multi-Property Context Switcher
The application shell features a persistent **Property Context Switcher** in the top navigation bar:
* Corporate users can switch between properties in the portfolio or choose "All Properties (Consolidated Overview)".
* Property-level staff have their property locked to their assigned physical hotel.
* Selecting a property immediately updates the active `CurrentPropertySignal`, which broadcasts context changes to all loaded domain stores and re-queries active views.

### 2.2 Role-Aware Navigation
Navigation items are declared with permission metadata:
```typescript
interface NavItem {
  id: string;
  label: string;
  route: string;
  icon: string;
  requiredPermission?: string;
  requiredScope?: 'GROUP' | 'REGION' | 'PROPERTY';
}
```
A reactive navigation service filters the visible menu items against the user's active permissions and current property selection.

---

## 3. High-Density Operational Dashboard & Tape Chart
Front-office and rooms management workflows require **dense, glanceable, high-throughput interfaces**:
1. **Interactive Tape Chart (Room Rack)**:
   * Displays physical rooms on the vertical axis and dates/hours on the horizontal axis.
   * Virtual scrolling renders hundreds of rooms smoothly at 60fps.
   * Supports drag-and-drop room reassignments with instant validation checks against guest preferences and room cleaning statuses.
2. **Real-Time Operational Updates**:
   * A WebSocket / Server-Sent Events (SSE) connection feeds room status changes directly into Angular Signals (`roomStatusSignal.set(...)`).
   * When Housekeeping marks Room 402 clean, the Front Desk tape chart instantly turns green without manual page refreshes.

---

## 4. State Management Strategy: Angular Signals + NgRx SignalStore
* **Local Component State**: Native Angular `signal()`, `computed()`, and `effect()`.
* **Domain Feature State**: Managed via lightweight, strongly-typed **NgRx SignalStore**:
  * `ReservationStore` (Active arrival list, filters, selected booking).
  * `RoomStatusStore` (Real-time grid matrix, dirty/inspected counters).
  * `FolioCashierStore` (Active guest bill, pending charge items).

---

---

## 5. Luxury Design System & Experience Foundation
The visual language, operational usability rules, design tokens, component specifications, and responsive strategies are centralized in:
* **[docs/17-HMS-DESIGN-SYSTEM.md](file:///f:/Folkslogic/enterprise-hms/docs/17-HMS-DESIGN-SYSTEM.md)**: Master product design specification (26 sections covering the 4-step glanceability cadence, time-to-action principle, desktop/tablet/mobile paradigms, touch rules, 13 canonical statuses, Arabic/RTL architecture, and 10 signature HMS experiences).
* **[docs/18-HMS-UX-DEVELOPER-CONTRACT.md](file:///f:/Folkslogic/enterprise-hms/docs/18-HMS-UX-DEVELOPER-CONTRACT.md)**: Binding rules, component reuse standards, and PR quality gates for all developers and AI agents.
* **`@hms/ui`**: Centralized, strongly-typed TypeScript design token package exporting `LUXURY_PALETTE`, `TYPOGRAPHY`, `SPACING`, `BREAKPOINTS`, `RADII`, `SHADOWS`, `STATUS_TOKENS`, and `Z_INDEX`.

### 5.1 Architectural Responsibility Demarcation
To preserve documentation integrity:
* **`10-UI-UX-ARCHITECTURE.md` (This Document)**: Owns frontend engineering mechanics (Angular 18 shell, Signals state, routing, interceptors, performance benchmarks).
* **`17-HMS-DESIGN-SYSTEM.md`**: Owns product experience, design tokens, visual guidelines, component specifications, UX rules, responsive/tablet/mobile, Arabic/RTL, and signature workflows.
* **`18-HMS-UX-DEVELOPER-CONTRACT.md`**: Owns developer governance, mandatory UX constraints, and PR rejection criteria.

---

## 6. HTTP Layer & Interceptors
* **`AuthContextInterceptor`**: Injects `Authorization: Bearer <JWT>`, `X-Property-ID`, `X-Tenant-ID`, and `X-Correlation-ID`.
* **`IdempotencyInterceptor`**: Automatically generates and attaches an `Idempotency-Key` UUID to mutating `POST` and `PUT` calls.
* **`GlobalErrorInterceptor`**: Captures RFC 7807 Problem Details and renders localized, user-actionable alerts.
