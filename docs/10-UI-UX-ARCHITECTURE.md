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

## 5. Luxury Design System & Operational Usability
* **Visual Palette**: Elegant luxury palette featuring deep navy (`#0B132B`), slate accents (`#1C2541`), rich gold highlights (`#C5A880`), and high-contrast status colors.
* **Typography**: Clean humanist sans-serif (`Inter`) for data grids; Monospaced numbers (`JetBrains Mono`) for financial folios to guarantee tabular alignment.
* **Keyboard Shortcuts**: Power-user hotkeys for Front Desk Agents (`F2` = Search Guest, `F4` = Check-in, `F8` = Post Charge, `Esc` = Close Modal).

---

## 6. HTTP Layer & Interceptors
* **`AuthContextInterceptor`**: Injects `Authorization: Bearer <JWT>`, `X-Property-ID`, `X-Tenant-ID`, and `X-Correlation-ID`.
* **`IdempotencyInterceptor`**: Automatically generates and attaches an `Idempotency-Key` UUID to mutating `POST` and `PUT` calls.
* **`GlobalErrorInterceptor`**: Captures RFC 7807 Problem Details and renders localized, user-actionable alerts.
