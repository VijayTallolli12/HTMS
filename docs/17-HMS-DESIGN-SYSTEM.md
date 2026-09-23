# 17 — Enterprise HMS Design System & Experience Architecture

## 1. Architectural Vision & Design Philosophy
The Enterprise Hotel Management System (HMS) is engineered for **ultra-luxury hotels, grand resorts, and multi-property hospitality groups**, with primary operational focus on the **Middle East and global luxury markets**.

The canonical visual direction is:
$$\text{LIGHT PREMIUM HOSPITALITY}$$

The design philosophy harmonizes three demanding operational paradigms:
$$\text{LIGHT REFINED SURFACES} \quad + \quad \text{ENTERPRISE SPEED} \quad + \quad \text{CALM OPERATIONAL CLARITY}$$

```
+---------------------------------------------------------------------------------------+
|                       ENTERPRISE HMS — LIGHT PREMIUM HOSPITALITY                      |
|                                                                                       |
|   [ LIGHT-FIRST SYSTEM ]            [ HIGH INFORMATION DENSITY ] [ OPERATIONAL CALM ]  |
|   Crisp, warm neutral surfaces,     Glanceable, compact KPIs,    "The HMS should feel   |
|   charcoal typography, restrained   scannable tabular data,      calm, clear, and       |
|   camel/bronze accents.             meaningful whitespace.       operational — not flashy."
+---------------------------------------------------------------------------------------+
```

### 1.1 Core Design Principles

> **Core Principle 1: System Complexity vs. User Cognitive Load**  
> *"The complexity belongs in the system, not in the user's head."*  
> The backend orchestrates multi-tenant isolation, distributed event outboxes, ledger balancing, and concurrency locks. The UI must hide this underlying plumbing and surface only the immediate operational reality.

> **Core Principle 2: Emotional Demeanor of the Workspace**  
> *"The HMS should feel calm, clear and operational — not flashy."*  
> Hotel shifts are demanding, noisy, and fast-paced. The software workspace must be a calming, steady instrument—never a distraction with garish visual effects or decorative analytics.

### 1.2 The Definition of "Premium"
In enterprise software, **premium does NOT mean visually decorative or complicated**.
$$\text{PREMIUM} = \text{CLARITY} + \text{CONSISTENCY} + \text{REFINEMENT} + \text{SPEED} + \text{EASE OF USE}$$

* **Light/Neutral Surfaces**: Soft pearl, warm off-white, and clean white cards that feel fresh, modern, and legible under high ambient lobby and desk lighting.
* **Charcoal & Slate Typography**: High-contrast, fatigue-free reading using deep slate and charcoal instead of harsh pure black or illegible faint grays.
* **Restrained Accent Color**: Refined warm bronze/camel gold applied with extreme discipline for active states, key focus rings, and primary actions.
* **Subtle Borders & Soft Elevation**: Fine 1px architectural lines and soft, natural shadows rather than heavy outlines or thick drop shadows.
* **Moderate Radius**: Clean 6px–10px radii delivering contemporary polish without toy-like pill distortion.

### 1.3 Anti-Patterns Strictly Banned
* **Generic Admin Dashboard Aesthetic**: No generic Bootstrap-style metric cards crammed with decorative circular charts.
* **Excessive Gold ("Gold-Washing")**: Gold is a restrained accent for brand identity, active selection, and VIP distinctions. It is never used as background fills or ubiquitous borders.
* **Heavy Glassmorphism & Blurs**: No glassmorphism-heavy UI, backdrop filters, or illegible semi-transparent cards that compromise data scannability.
* **Excessive Gradients & Neons**: No rainbow gradients, neon glowing borders, or cyberpunk-inspired dashboard panels.
* **Decorative Visual Noise**: No purely ornamental icons, ambient illustrations, or decorative widgets that do not serve an immediate shift task.
* **Everything Bold**: Visual hierarchy must come from size, color contrast, and spatial placement—not from setting every heading and label to font-weight 700.
* **Card Nesting Overload**: Do not nest cards inside cards inside cards with heavy borders.
* **Desktop UI Squeezed onto Mobile**: Mobile views must be purpose-built task views, not shrunken 12-column desktop tables.
* **Decorative Animations**: Operational staff process hundreds of guests and work orders per shift; animations must never exceed 200ms and must respect `prefers-reduced-motion`.

---

## 2. Target Operational Users & Real Hotel Conditions

The platform serves 16 distinct operational and administrative roles across properties and corporate tiers:

| Role Category | Specific Personas | Primary Devices | Operational Context & Stress Factors |
| :--- | :--- | :--- | :--- |
| **Executive Leadership** | General Manager, Hotel Manager | Desktop, Tablet, Mobile | High-level exception monitoring, VIP arrivals, revenue yield, reputation oversight. |
| **Front of House** | Front Office Manager, Duty Manager, Receptionist, Concierge, Bell Captain | Desktop (counter), Tablet (curbside/lobby) | High throughput, standing, direct eye contact with guests, phone interruptions, rapid keyboard/touch input. |
| **Housekeeping** | Executive Housekeeper, Floor Supervisor, Room Attendant | Tablet (supervisors), Mobile (room attendants) | On foot, noisy service corridors, gloved or damp hands, quick room status updates, linen/minibar tracking. |
| **Engineering & Facilities**| Chief Engineer, Shift Technician, Preventive Maintenance Specialist | Mobile, Tablet | Plant rooms, guest rooms, physical work, rapid photo attachment, urgent work order dispatch. |
| **Food & Beverage / Spa** | F&B Director, Restaurant Maître d', Spa Receptionist | Tablet, Desktop | Fast guest folio charging, table/treatment room turns, allergy/preference checks. |
| **Revenue & Reservations**| Revenue Director, Reservations Agent | Desktop (multi-monitor) | Dense rate calendar analysis, channel distribution, restrictions, multi-segment bookings. |
| **Finance & Commercial** | Financial Controller, Night Auditor, Income Auditor, Cashier | Desktop | High-density tabular ledgers, batch posting, end-of-day trial balance reconciliation. |
| **People & Operations** | HR Manager, Procurement Specialist, Materials Manager | Desktop | Purchase order approvals, staff shift rosters, inventory requisitions. |
| **Corporate & Regional** | Group VP Operations, Regional Brand Director | Desktop | Consolidated portfolio metrics, cross-property comparison, organizational governance. |

### 2.1 Designing for Real-World Operational Realities
Operational users operate under severe real-world constraints:
1. **Frequent Interruptions**: A receptionist checking in a guest will be interrupted by a telephone call or a concierge query. The UI must preserve draft state without discarding input.
2. **Standing & Moving**: Front desk agents stand; housekeepers and engineers walk. Touch targets must accommodate unsteady taps and rapid glanceability.
3. **Time-to-Action Pressure**: During morning peak checkouts (07:00–09:00) and afternoon check-ins (14:00–16:00), every extra click or 2-second screen lag creates physical lobby queues.
4. **Varied Technical Proficiency**: Shift workers speak multiple languages and have varying computer literacy. Terminology must be straightforward, workflows guided, and errors gracefully recoverable.

---

## 3. Core UX Principles

### Principle 1: The Complexity Belongs in the System, Not in the User's Head
The backend manages distributed transactions, event outboxes, multi-tenant property scoping, fiscal ledgers, and CloudEvents. The UI must strip away this technical plumbing and present only the operational reality:
$$\text{"I am checking in a guest," not "I am orchestrating 5 relational aggregates."}$$

### Principle 2: The 4-Step Glanceability Cadence
Every screen in Enterprise HMS answers four questions in sequential hierarchy:
$$\text{WHERE AM I?} \quad \longrightarrow \quad \text{WHAT NEEDS MY ATTENTION?} \quad \longrightarrow \quad \text{WHAT SHOULD I DO?} \quad \longrightarrow \quad \text{CONFIRMATION THAT IT WORKED}$$

1. **Where Am I?**: Clear property context banner, navigation breadcrumb, and unambiguous view title.
2. **What Needs My Attention?**: Visible exception metrics, overdue tasks, VIP arrival badges, blocked rooms.
3. **What Should I Do?**: One prominent primary action button supported by clear contextual choices.
4. **Confirmation That It Worked**: Instant visual feedback (toast, badge update, drawer close) validating completion.

### Principle 3: The Time-to-Action Principle
$$\text{"Common operational tasks must be optimized for minimum cognitive load and minimum unnecessary interaction,}$$
$$\text{while maintaining required controls, authorization, business rules, and auditability."}$$
* Every routine operation (check-in, mark clean, post charge, create ticket) must have a streamlined "Happy Path".
* Sensible defaults must eliminate repetitive data entry (e.g., auto-filling current shift date, default payment method, active property context).

### Principle 4: One Primary Action Per Operational Screen
Every operational screen must feature **ONE clear primary action button** (e.g., `[ Check In ]`, `[ Start Cleaning ]`, `[ Complete Inspection ]`, `[ Resolve Issue ]`). 
Secondary actions (print reg card, add note, view folio) are visually subordinate (secondary ghost buttons or dropdown action menus).

### Principle 5: Progressive Disclosure
Show what is needed right now; disclose details on demand:
$$\text{ESSENTIAL SUMMARY} \quad \longrightarrow \quad \text{PRIMARY ACTION} \quad \longrightarrow \quad \text{CONTEXT DETAILS} \quad \longrightarrow \quad \text{AUDIT TRAIL}$$
Use slide-over drawers, expandable accordion rows, and contextual popovers rather than cluttering the initial viewport.

### Principle 6: Contextual Operations (SELECT → INSPECT → ACT)
Operational efficiency relies on staying in spatial flow without jarring navigation cycles:
$$\text{SELECT} \quad \longrightarrow \quad \text{INSPECT} \quad \longrightarrow \quad \text{ACT}$$

* **Select**: The user clicks or taps a room card, reservation row, folio entry, or maintenance ticket in the active grid.
* **Inspect**: A slide-over drawer or command panel opens on the contextual side, presenting current details, audit history, and relevant metadata without navigating away.
* **Act**: Primary operational mutations (`[ Check In ]`, `[ Mark Inspected ]`, `[ Post Charge ]`) are executed directly inside the contextual panel. Upon completion, the background grid updates reactively, maintaining the user's scroll position and mental orientation.

### Principle 7: The Operational Dashboard Purpose
> *"The dashboard is an operational workspace, not a module directory."*  
Every pixel on the dashboard must directly answer:
$$\text{"What does this user need to know or act on right now?"}$$
* Avoid vanity analytics, decorative sparklines, and sprawling graphs that do not inform immediate shift actions.
* Prioritize live bottlenecks: impending arrivals without assigned rooms, departures awaiting billing settlement, priority dirty rooms blocking check-in, and maintenance blocks (OOO/OOS).

---

## 4. Complexity Reduction & Operational Calm

To maintain operational calm during high-stress hotel shifts:
1. **Glanceable Status Cards**: Summarize shift state in at most 4 concise metrics (e.g., *Arrivals Remaining*, *Rooms Dirty*, *VIPs In-House*, *Open Exceptions*).
2. **Banish False Urgency**: Warnings and critical alerts must reflect genuine hotel emergencies (fire panel, system offline, VIP room unassigned 15 minutes before arrival). Routine notifications must never create alarm fatigue.
3. **Zero Visual Noise**: Avoid gradients, 3D shadows, ornamental icons, heavy glassmorphism, or decorative textures. Surfaces are clean matte light pearl, warm off-white, and crisp white cards with fine 1px neutral borders.
4. **Sensible Form Density**: Group related fields logically (Guest Information, Stay Details, Billing Arrangement) with clear separation, rather than endless single-column forms.

---

## 5. Responsive Strategy: Purpose-Built Device Architecture

Responsive design in Enterprise HMS is **never** a mere viewport squeeze. Each form factor fulfills a distinct operational role:

```
+---------------------------------------------------------------------------------------+
|                               RESPONSIVE WORKSPACE TIERS                              |
|                                                                                       |
|   DESKTOP (>= 1024px)               TABLET (640px - 1023px)      MOBILE (< 640px)     |
|   - Multi-column data grids         - Touch-first operational    - Single-task focus   |
|   - 60fps Room Tape Chart             front desk/inspections     - "My Work" & alerts  |
|   - Full financial folios           - Two-column split panels    - One-tap status      |
|   - Multi-tab administrative tools  - Curbside guest check-in    - Camera work orders  |
+---------------------------------------------------------------------------------------+
```

### 5.1 Breakpoints (`@hms/ui`)
* **Mobile**: `< 640px` (single column, full-width touch buttons, bottom sheets).
* **Tablet**: `640px – 1023px` (split screen, large touch targets, collapsible sidebar).
* **Desktop**: `1024px – 1439px` (standard desktop, persistent navigation, multi-column tables).
* **Wide Desktop**: `1440px – 1920px+` (maximum information density, room tape chart, side-by-side ledgers).

---

## 6. Desktop Strategy: Administration & High-Density Workflows

* **Target Audience**: Financial Controllers, Revenue Managers, General Managers, Front Desk Supervisors.
* **Layout Structure**:
  * Fixed global header (56px height) with Property Context Switcher, Search trigger, Active Language toggle, and User Profile.
  * Slim or expandable left sidebar navigation (64px collapsed, 240px expanded).
  * Main dynamic workspace with full horizontal breathing room.
* **Optimized For**:
  * Keyboard-driven rapid data entry (Tab, Enter, hotkeys).
  * High-density virtualized data tables rendering 1,000+ rooms or transactions without frame drops.
  * Sticky headers and sticky first columns for financial reconciliation.
  * Side-by-side multi-folio viewing.

---

## 7. Tablet Strategy: Front Desk & Operational Supervisors

* **Target Audience**: Lobby Ambassadors, Curbside Concierges, Housekeeping Supervisors, Restaurant Managers.
* **Layout Structure**:
  * Dual-orientation support (Landscape default 1024x768 or 1280x800; Portrait supported for room inspection rounds).
  * Collapsible touch-friendly drawer navigation.
  * Split-pane views: Left list (Arrivals / Rooms), Right detail (Guest Card / Room Inspection Checklist).
* **Touch Optimization**:
  * Large controls: Button heights minimum 44px, table rows minimum 48px height.
  * Easy digital signature capture for guest check-in registration cards.
  * Direct photo capture for engineering work orders and room maintenance logs.

---

## 8. Mobile Strategy: Field Staff Operations

* **Target Audience**: Room Attendants, Floor Housekeepers, Maintenance Technicians, Luggage Porters, On-Duty Managers.
* **Mobile Core Formula**:
$$\text{MY WORK} \quad + \quad \text{PRIORITIES} \quad + \quad \text{QUICK ACTIONS} \quad + \quad \text{EXCEPTIONS}$$
* **Rules for Mobile UX**:
  1. **Do NOT Replicate Desktop Navigation**: Never expose deep 4-level navigation trees on mobile.
  2. **Top Priorities Only**: A housekeeper opens the app to see: *Room 304 (Priority VIP Departure)*, *Room 305 (Stayover)*, *Room 308 (Stayover)*.
  3. **One-Tap Transitions**: Tapping `[ Start Cleaning ]` updates room status across the entire hotel in real-time.
  4. **No Complex Multi-Table Joins**: Single focused cards with high-contrast text and oversized buttons.
  5. **Accidental Gesture Protection**: Never bind destructive or status-changing operations to naked swipe gestures. Swiping a task item may reveal actions (`[ Inspect ]`, `[ Report Defect ]`), but executing them requires an intentional tap.

---

## 9. Touch Guidelines & Mobile Safety

To guarantee reliable operation on physical touchscreens across all hotel departments:
1. **Minimum Touch Target**: Every interactive element (button, icon, table action, checkbox) must measure at least **$44 \times 44\text{px}$** (ideally $48 \times 48\text{px}$ on mobile).
2. **Touch Spacing**: Minimum **$8\text{px}$** margin between adjacent touch targets to eliminate mis-taps during hurried shifts.
3. **No Icon-Only Critical Actions**: Critical operational actions must have explicit text labels (e.g., `[ Check In ]`, not just a cryptic door icon). Icons support visual parsing; labels guarantee correctness.
4. **Consequential Operations**: Destructive or irreversible operations (cancel booking, void payment, mark out-of-order) must prompt a confirmation dialog explicitly summarizing the operational consequence.

---

## 10. Navigation Architecture & Global Shell

The global shell organizes navigation around **real hotel workflows and shifts**, rather than generic software modules or database tables:

```
+---------------------------------------------------------------------------------------------------+
| [HMS] Tokyo Grandeur Palace [v]  | [Q Search guests, rooms, bookings... Cmd+K] | [AR] [Admin User] |
+---------------------------------------------------------------------------------------------------+
| < Breadcrumbs: Portfolio  /  Tokyo Grandeur Palace  /  Front Office                               |
|                                                                                                   |
| Front Desk & Arrivals                                                 [ + New Booking ] [Filter]  |
+---------------------------------------------------------------------------------------------------+
```

1. **Global Header (Height: 56px)**:
   * **Brand Mark**: Restrained luxury brand mark with clear visual anchor.
   * **Active Property Context Switcher**: Displays and selects active property scope (e.g. `Tokyo Grandeur Palace (TYO-01)` or `Portfolio Master`).
   * **Search / Command Bar**: Global search trigger for guest names, confirmation numbers, room numbers.
   * **Language & RTL Toggle**: Rapid switch between English (LTR) and Arabic (RTL).
   * **User Profile & Active Role**: Identifies current staff member and server-assigned role.
2. **Breadcrumb Navigation**: Persistent hierarchical trail across all multi-level resources.
3. **Workflow-First Navigation Taxonomy**:
   Navigation sections reflect the operational cadence of hotel shifts:

```
+---------------------------------------------------------------------------------------+
|                       WORKFLOW-BASED NAVIGATION ARCHITECTURE                         |
|                                                                                       |
|   TODAY                     FRONT OFFICE              ROOM OPERATIONS                 |
|   - Operations Briefing     - Arrivals                - Tape Chart                    |
|   - Exceptions & Blocks     - Departures              - Room Status Board             |
|                             - Reservations            - Availability (ATS)            |
|                             - Guests Dossier                                          |
|                             - Folio & Cashiering                                      |
|                                                                                       |
|   HOUSEKEEPING              ENGINEERING & FACILITIES  SYSTEM / PLATFORM               |
|   - Daily Cleaning Tasks    - Maintenance Tickets     - Property Architecture         |
|   - Supervisor Inspections  - Out of Order (OOO/OOS)  - Audit Logs & Security         |
+---------------------------------------------------------------------------------------+
```

> **UX Documentation Note**:  
> The navigation groupings above represent the canonical UX architecture. They are documented as workflow examples; no feature is claimed as implemented unless confirmed by existing active route definitions and API contracts.

### 10.1 Tri-Factor Navigation Governance
Navigation visibility is strictly governed by three independent contextual boundaries:
1. **Role-Aware**: Staff only see navigation sections and action triggers relevant to their operational duties.
2. **Permission-Aware**: Visibility of each route and action is controlled server-authoritatively by real IAM permission codes returned by `/auth/me` (e.g., `front_office.reservation.read`, `housekeeping.task.view`, `folio:view`).
3. **Property-Aware**: All active data, inventory quotas, and room boards are strictly partitioned by the user's active property context.

---

## 11. Role-Aware UX Architecture

The platform adapts its visible interface to the user's authenticated role, drastically reducing cognitive load:

```
+---------------------------------------------------------------------------------------+
|                                ROLE-AWARE WORKSPACES                                 |
|                                                                                       |
|   FRONT DESK AGENT (FDA):                                                             |
|   Today's Arrivals  |  Departures  |  In-House Folios  |  Tape Chart  |  Room Rack    |
|                                                                                       |
|   EXECUTIVE HOUSEKEEPER / SUPERVISOR (HK_SUPERVISOR):                                 |
|   Dirty Departures  |  In Cleaning  |  Awaiting Inspection  |  Attendant Dispatch     |
|                                                                                       |
|   MAINTENANCE TECHNICIAN (MAINT_TECH):                                                |
|   High-Severity HVAC  |  Plumbing Work Orders  |  Preventive Rounds  |  OOO Blocks    |
|                                                                                       |
|   CORPORATE / GENERAL MANAGER (CORP_ADMIN / PROPERTY_GM):                             |
|   Executive KPI Briefing  |  Portfolio Scope  |  Cashiering Audit  |  Governance      |
+---------------------------------------------------------------------------------------+
```

* Staff only see navigation nodes relevant to their department.
* Users without permissions for a specific module see clean departmental workspaces or fallback orientation rather than jarring error walls or 403 Forbidden alert banners.

---

## 12. Workflow-First Design (Operations vs. Database Tables)

Operational screens are organized strictly around **hotel business workflows**, never raw database tables:

| Antipattern (Entity-Centric UI) | Recommended (Workflow-First Luxury UI) |
| :--- | :--- |
| Clicking through 4 separate screens: `GuestsTable` $\rightarrow$ `ReservationTable` $\rightarrow$ `RoomTable` $\rightarrow$ `BillingTable` | **Unified Arrival Workspace**: Shows guest profile, stay preferences, pre-assigned room, payment pre-authorization, and digital reg card in one streamlined check-in flow. |
| Requiring 8 form fields across 3 tabs to report a broken air conditioner | **Quick Room Issue Drawer**: Select Room $\rightarrow$ Tap Issue Category (`HVAC`) $\rightarrow$ Tap Severity (`High`) $\rightarrow$ Optional Photo $\rightarrow$ Tap `[ Dispatch Technician ]`. |
| Navigating through 5 separate tables to reconcile a checkout | **Departure Cashier Workspace**: Balance summary $\rightarrow$ Folio breakdown $\rightarrow$ Settlement Method $\rightarrow$ Tap `[ Settle & Check Out ]` with auto-receipt email. |

---

## 13. Plain Hospitality Language & Terminology Standard

To ensure seamless operation by staff across all international properties, technical jargon is strictly forbidden in user interfaces:

| Prohibited Technical Jargon | Mandatory Hospitality Standard | Operational Context |
| :--- | :--- | :--- |
| `Entity / Aggregate / Record` | **Guest / Booking / Room / Order** | Physical hotel assets and people |
| `Persistence / Committed` | **Saved / Confirmed / Processed** | Form submission feedback |
| `State Transition / FSM` | **Status Update (e.g., Mark Clean)**| Changing operational states |
| `Transaction / Mutation` | **Charge / Payment / Adjustment** | Folio financial actions |
| `Foreign Key / UUID` | **Confirmation Number / Room Number**| Identifiers displayed to staff |
| `Orchestration / Saga` | **Workflow (e.g., Night Audit)** | Background processes |
| `Soft Delete / Deactivate` | **Cancel Reservation / Close Room** | Removing or archiving records |

---

## 14. Typography System

The typography system enforces clear operational hierarchy without relying on heavy weights or bold styling:

### 14.1 Font Stacks
* **Primary Latin Sans-Serif**: `'Inter', system-ui, -apple-system, sans-serif`
* **Primary Arabic Sans-Serif**: `'IBM Plex Sans Arabic', 'Noto Sans Arabic', system-ui, sans-serif`
* **Tabular Numbers & Codes**: `'JetBrains Mono', monospace` (mandated for currency amounts, folio ledgers, room numbers, and dates to ensure vertical digit alignment).
* **Luxury Brand Accent (Headings only)**: `'Playfair Display', serif` (used sparingly for luxury brand banners).

### 14.2 Scale & Hierarchy
* **Display / Hero**: `2.25rem (36px)` / Line Height: `1.2` / Weight: `600` (Hero KPIs, property portfolio summary).
* **Page Title**: `1.875rem (30px)` / Line Height: `1.2` / Weight: `600` (Main workspace view title).
* **Section Title**: `1.5rem (24px)` / Line Height: `1.3` / Weight: `500` (Card headers, drawer titles).
* **Sub-Heading**: `1.25rem (20px)` / Line Height: `1.4` / Weight: `500` (Modal headers, table group titles).
* **Body Standard**: `1rem (16px)` / Line Height: `1.5` / Weight: `400` (Primary table text, form inputs).
* **Body Compact**: `0.875rem (14px)` / Line Height: `1.5` / Weight: `400` (Secondary labels, table sub-rows).
* **Caption / Tag**: `0.75rem (12px)` / Line Height: `1.4` / Weight: `500` (Badges, metadata timestamps).

---

## 15. Light-First Color Tokens & Visual System

The canonical visual system of Enterprise HMS is **Light Premium Hospitality**. It is optimized for daytime lobby daylight, counter lighting, and long operational shifts:

```
[ Canvas #F8FAFC ]    [ Surface Card #FFFFFF ]  [ Slate Border #E2E8F0 ]  [ Restrained Accent #9A7B38 ]
Light neutral base    Crisp operational card    Fine architectural divider Warm bronze/camel accent
```

### 15.1 Palette Tokens (`packages/ui`)
* **Surfaces & Neutral Bases**:
  * `surfaceRoot`: `#F8FAFC` (Root application viewport background; light neutral canvas)
  * `surfaceCard`: `#FFFFFF` (Primary operational card background; crisp white)
  * `surfaceRaised`: `#F1F5F9` (Subtle contrast panels, table header strips, side navigation)
  * `surfaceSunken`: `#E2E8F0` (Input wells, progress tracks, active selection tracks)
  * `surfaceBorder`: `#E2E8F0` (Clean, subtle 1px border separation)
  * `surfaceBorderSubtle`: `#F1F5F9` (Fine internal table row dividers)
* **Charcoal & Slate Typography**:
  * `textPrimary`: `#0F172A` (Slate 900; crisp readability, WCAG > 14:1 contrast on white)
  * `textSecondary`: `#334155` (Slate 700; secondary labels, table headers, column descriptors)
  * `textMuted`: `#64748B` (Slate 500; helper text, timestamps, disabled indicators)
  * `textInverse`: `#FFFFFF` (White text for primary action buttons and dark badge accents)
* **Brand Accents (Restrained Luxury Warm Camel/Bronze)**:
  * `accentPrimary`: `#9A7B38` (Deep warm camel bronze for primary buttons, active indicator lines)
  * `accentHover`: `#83672E` (Hover interaction on accent elements)
  * `accentLight`: `#FDF8EE` (Light background tint for active tabs, selected rows)
  * `accentRing`: `rgba(154, 123, 56, 0.25)` (Accessible 2px focus ring with offset)
* **Semantic Status Palette (Calibrated for Light Surfaces)**:
  * **Success / Ready / Clean**: `#059669` (text/icon), `#ECFDF5` (tint background), `#A7F3D0` (border)
  * **Info / Occupied / In-House**: `#2563EB` (text/icon), `#EFF6FF` (tint background), `#BFDBFE` (border)
  * **Warning / Cleaning / Pending**: `#D97706` (text/icon), `#FFFBEB` (tint background), `#FDE68A` (border)
  * **Critical / Dirty / OOO**: `#DC2626` (text/icon), `#FEF2F2` (tint background), `#FECACA` (border)
  * **Inspection / VIP**: `#7C3AED` (text/icon), `#F5F3FF` (tint background), `#DDD6FE` (border)
  * **Muted / Vacant / Out of Service**: `#64748B` (text/icon), `#F8FAFC` (tint background), `#E2E8F0` (border)

---

## 16. Spacing, Grid, Elevation & Motion

* **8-Point Grid Scale**:
  * `space-1 (4px)`: Micro-padding inside badges, tight icon gaps.
  * `space-2 (8px)`: Standard gap between button icons and text; touch separation.
  * `space-3 (12px)`: Input field internal vertical padding.
  * `space-4 (16px)`: Standard card padding; form field vertical spacing.
  * `space-6 (24px)`: Section padding; modal dialog padding.
  * `space-8 (32px)`: Major workspace grid gaps.
* **Moderate Border Radii**:
  * `sm (4px)`: Micro-badges, status tags.
  * `md (6px)`: Buttons, text inputs, dropdown selects.
  * `lg (8px)`: Cards, data table containers, panel cards.
  * `xl (12px)`: Modal dialogs, slide-over drawers.
  * `full (9999px)`: Circular avatars, pill chips.
* **Soft Natural Elevation Shadows**:
  * `sm`: `0 1px 2px 0 rgba(0, 0, 0, 0.05)` (operational cards).
  * `md`: `0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.04)` (popovers, dropdowns).
  * `modal`: `0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)` (dialogs & drawers).
* **Restrained Motion**:
  * Durations: `150ms` (hover/focus), `200ms` (dropdowns/drawers), `250ms` (modal entrance).
  * Timing: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out deceleration).
  * Accessibility: `@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }`.

---

## 17. Component Architecture & Catalog Specifications

All future HMS modules must reuse standard components defined in the HMS Design System:

| Component | Purpose | Key Specifications |
| :--- | :--- | :--- |
| **Primary Button** | Prominent single primary action | Gold accent background (`#C5A880`), dark text, height 40px (desktop) / 48px (touch), 8px radius. |
| **Secondary Button**| Secondary contextual actions | Slate border, transparent or navy fill, text primary, hover slate background. |
| **Icon Button** | Compact toolbar actions | $44\times 44\text{px}$ touch target, clear tooltip, mandatory `aria-label`. |
| **Text Input** | Single-line data capture | Top-aligned label, dark navy surface, 1px border, 2px gold focus ring, clear error message. |
| **Select / Dropdown**| Single/multi selection | Custom luxury chevron, searchable options, clear active item badge. |
| **Date / Range Picker**| Hotel night selection | Night count calculation, calendar matrix, Arabic/Gregorian dual support. |
| **Badge / Chip** | Metadata tags | Pill radius, subtle background tint, clear border, compact 12px typography. |
| **Status Indicator**| 13 canonical operational states| Tri-part: Symbol icon + Text Label + Status Color tint. Never color alone. |
| **Data Table** | Enterprise tabular data | Sticky header, sortable columns, responsive row cards on mobile, pagination. |
| **Slide-over Drawer**| Contextual detail disclosure | Right-side entrance (left in RTL), 480px–640px width, keyboard `Esc` dismiss. |
| **Modal Dialog** | Consequential confirmations | Centered, dark backdrop blur, single primary confirmation button, cancel escape. |
| **Toast Banner** | Non-blocking mutation feedback | Top-right (top-left RTL), 4-second auto-dismiss, dismiss button. |
| **Empty State** | Zero-data representation | Clean SVG illustration, friendly explanation, one clear "Add First" CTA button. |
| **Skeleton Loader** | Loading perception | Subtle pulse animation matching layout geometry, eliminates layout shifts. |

---

## 18. Enterprise Table UX Standard

Operational data grids must strictly adhere to the following enterprise standard:
1. **Glanceable Header**: Column labels in uppercase 12px bold with sort direction indicator.
2. **Sticky Header & Fixed First Column**: The header remains visible during vertical scrolling; guest name/room number remains pinned during horizontal scrolling.
3. **Density Control**: Support two density modes:
   * *Comfortable*: 56px row height (recommended for touch/tablet).
   * *Compact*: 40px row height (recommended for desktop cashiering and audit ledgers).
4. **Row Actions Menu**: Row-level actions are consolidated into a trailing `⋮` action menu, keeping tables uncluttered.
5. **Mobile Fallback**: Tables must collapse gracefully into responsive summary cards on viewports `< 640px`.

---

## 19. Form UX Standard

1. **Labels Never Hidden**: Labels are always positioned above input fields. Placeholder text is used solely for formatting hints (e.g. `e.g. +971 4 123 4567`), never as the label itself.
2. **Actionable Error Feedback**: Form error messages must state:
$$\text{WHAT WENT WRONG} \quad + \quad \text{HOW TO FIX IT}$$
   * *Bad*: `"Invalid entry."`
   * *Good*: `"Property code PROP-TYO-001 already exists. Enter a unique 3-to-12 character code."`
3. **Field Grouping**: Complex forms must be organized into logical fieldsets with descriptive subheadings (e.g., *Property Location*, *Financial Settings*, *Contact Details*).
4. **Validation Timing**: Field validation executes on `blur` (user leaves the field) or on form `submit`. Never harass users with red validation errors while they are actively typing.

---

## 20. Room Operations & The Canonical Status Language

Room status visualization is a **core visual language of the Enterprise HMS**. Whether viewed on the high-density desktop Tape Chart, the curbside tablet check-in board, or the room attendant's mobile priority list, room state must be instantly legible across languages and lighting conditions.

### 20.1 Core Room Operational Semantic States
Every physical room in the property resolves to a combination of occupancy, housekeeping, and service status:

| Semantic Room State | Symbol / Icon | Light UI Color Treatment | Operational Meaning & Actionable Trigger |
| :--- | :--- | :--- | :--- |
| **AVAILABLE** | `✓ READY` | Emerald `#059669` text on `#ECFDF5` | Room is clean, inspected, in service, and ready for immediate guest check-in. |
| **OCCUPIED** | `● OCCUPIED` | Sapphire `#2563EB` text on `#EFF6FF` | Guest is registered and in-house. Action: Folio post, service request, departure settlement. |
| **DIRTY** | `✕ DIRTY` | Crimson `#DC2626` text on `#FEF2F2` | Room requires cleaning (departure or stayover). Action: Dispatch attendant, prioritize for arrival. |
| **CLEANING** | `⟳ CLEANING` | Amber `#D97706` text on `#FFFBEB` | Attendant is actively cleaning. Action: Live progress monitoring, timer tracking. |
| **CLEAN** | `✓ CLEAN` | Teal `#0D9488` text on `#F0FDFA` | Attendant completed cleaning; room is awaiting supervisory certification. |
| **INSPECTED** | `🔍 INSPECTED` | Purple `#7C3AED` text on `#F5F3FF` | Supervisor certified room readiness. Safe for VIP allocation and key issuance. |
| **OOO** (Out of Order) | `⛔ OOO` | Rose `#BE123C` text on `#FFF1F2` | Physical room defect removing room from sellable inventory. Affects hotel ATS. |
| **OOS** (Out of Service) | `⚙ OOS` | Slate `#475569` text on `#F8FAFC` | Minor cosmetic or maintenance issue; does not reduce inventory capacity. |

### 20.2 The 13 Canonical Operational Status Tokens

Per the ratified enterprise hotel architecture, all operational states across PMS, Housekeeping, Front Office, and Maintenance map into **exactly 13 canonical statuses**:

```
+---------------------------------------------------------------------------------------------------+
|                              13 CANONICAL STATUS TOKENS (ICON + LABEL)                            |
|                                                                                                   |
|  [✓ READY]         [● OCCUPIED]       [○ VACANT]         [✕ DIRTY]           [⟳ CLEANING]         |
|  #059669           #2563EB            #64748B            #DC2626             #D97706              |
|                                                                                                   |
|  [🔍 INSPECTION]   [⚙ MAINTENANCE]    [⛔ OUT OF ORDER]   [⏳ PENDING]        [✓ COMPLETED]        |
|  #7C3AED           #EA580C            #BE123C            #CA8A04             #059669              |
|                                                                                                   |
|  [⊘ CANCELLED]     [⚠ WARNING]        [🚨 CRITICAL]                                               |
|  #64748B           #D97706            #DC2626                                                     |
+---------------------------------------------------------------------------------------------------+
```

### 20.3 Strict Status Accessibility Mandate:
> **Zero Color-Only Meaning Rule**:  
> **Status must NEVER be communicated through color alone.**  
> Every status indicator (whether on tape chart cells, room cards, table rows, or mobile lists) must combine:
$$\text{SYMBOL ICON} \quad + \quad \text{TEXT LABEL} \quad + \quad \text{STATE PILL / BORDER}$$

---

## 21. Feedback & UI State Architecture

Every data-driven view in Enterprise HMS must explicitly handle **four essential page states**, and every mutation must provide **two feedback channels**:

```
+---------------------------------------------------------------------------------------+
|                                  MANDATORY UI STATES                                  |
|                                                                                       |
|   PAGE STATES:                                                                        |
|   1. LOADING    -> Skeletons matching geometric layout (no jarring layout shifts)    |
|   2. EMPTY      -> Meaningful explanation + clear CTA [ + Add First ... ]             |
|   3. ERROR      -> Actionable message + [ ↻ Retry Connection ] button                |
|   4. LOADED     -> Normal operational view with high glanceability                    |
|                                                                                       |
|   MUTATION FEEDBACK:                                                                  |
|   1. SUCCESS    -> Non-blocking toast (4s) or contextual status transition            |
|   2. FAILURE    -> Actionable error banner with RFC 7807 problem details              |
+---------------------------------------------------------------------------------------+
```

---

## 22. Accessibility (WCAG 2.1 AA Compliance)

Enterprise HMS guarantees full operational accessibility:
1. **High Contrast**: All body text on navy/slate backgrounds achieves at least a **$4.5:1$ contrast ratio** ($14:1$ for `#F8FAFC` on `#0B132B`).
2. **Visible Focus Rings**: All interactive controls feature a prominent $2\text{px}$ focus ring (`goldAccent` or high-contrast blue) with an offset, visible on both dark and light surfaces.
3. **Full Keyboard Operability**: Complete operational flows (search, navigate, check-in, form submit, modal dismiss) can be performed entirely via keyboard (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Esc`).
4. **Screen Reader Landmarks**: Semantic HTML (`<main>`, `<nav>`, `<header>`, `<aside>`, `<section>`, `role="dialog"`, `aria-expanded`, `aria-live="polite"`).

---

## 23. Arabic / English / RTL Architecture

Because the primary market includes the Middle East and Gulf luxury resort destinations, **RTL (Right-to-Left) is an architectural first principle**, not an afterthought:

```
+---------------------------------------------------------------------------------------+
|                             BIDIRECTIONAL RTL ARCHITECTURE                            |
|                                                                                       |
|   LTR (English):                                                                      |
|   [Brand] [Context Selector]  -------------------------------->  [Language] [User]    |
|   [Sidebar Nav]  |  [Breadcrumbs: Group > Property]  |  [Action: + Add Room]          |
|                                                                                       |
|   RTL (Arabic):                                                                       |
|   [User] [Language]  <--------------------------------  [Context Selector] [Brand]    |
|   [Action: + Add Room]  |  [Breadcrumbs: Group < Property]  |  [Sidebar Nav]          |
+---------------------------------------------------------------------------------------+
```

1. **Logical CSS Properties**: Use `margin-inline-start`, `margin-inline-end`, `padding-inline`, `text-align: start`, and `inset-inline` instead of physical `left` and `right`.
2. **Mirrored Navigation**: Sidebars dock on the right in RTL; breadcrumb chevrons invert (`‹` instead of `›`); slide-over drawers enter from the left.
3. **Arabic Typography**: Clean pairing with `IBM Plex Sans Arabic` and `Noto Sans Arabic`, ensuring balanced line heights and legibility at high data density.
4. **Numerals & Dates**: Gregorian dates formatted with localized month names; room numbers and currency values preserve tabular monospace alignment.

---

## 24. 10 Signature HMS Experiences (Architectural Concepts)

The design system establishes architectural concepts for 10 signature luxury experiences (to be implemented in subsequent modules):
1. **Room Operations Grid (Tape Chart)**: 60fps virtualized visual room rack tracking arrivals, departures, clean/dirty states, and maintenance locks across time.
2. **Guest Command Center**: Comprehensive 360-degree guest dossier presenting loyalty tier, past stay preferences, billing folios, and active requests.
3. **Guest Profile & Preference Matrix**: Detailed VIP preference tracking (pillow type, room temperature, dietary requirements, anniversary dates).
4. **Room Command Panel**: Micro-workspace displaying real-time physical room state (HVAC temperature, smart lock battery, DND/MUR status, minibar inventory).
5. **Today's Operations Overview**: Morning shift briefing screen consolidating arrivals, departures, occupancy percentage, out-of-order rooms, and VIPs.
6. **Arrivals & Departures Workspace**: Streamlined high-throughput check-in and checkout queues with one-tap actions.
7. **Housekeeping Operations Board**: Real-time room attendant allocation matrix with drag-and-drop cleaning priorities and inspection queues.
8. **Maintenance & Engineering Board**: Visual triage kanban for open facilities work orders, categorized by guest impact and urgency.
9. **Operational Exception Center**: Dedicated manager workspace highlighting anomalies requiring immediate intervention (e.g., room not ready 30m before VIP arrival).
10. **AI Operational Intelligence Panel**: Embedded assistant offering shift summaries, anomaly warnings, and predictive housekeeping staffing suggestions.

---

## 25. AI Experience Architecture & Operational Intelligence

Artificial Intelligence in Enterprise HMS acts as an **operational intelligence layer**, not an intrusive floating chatbot:
1. **Embedded Contextual Insights**: AI summaries appear embedded directly within operational screens (e.g., "Guest has requested quiet high floors on past 4 stays. Recommended room: 812").
2. **Shift Briefings**: Generates natural-language shift handovers for incoming Front Office Managers and Executive Housekeepers.
3. **Anomaly & Revenue Alerts**: Identifies unusual reservation spikes, abnormal minibar usage, or maintenance trends.
4. **Strict Safety & Human Authorization Gate**:
   * AI can suggest or draft actions, but **NEVER mutates financial folios, guest reservations, or room statuses without explicit human confirmation**.
   * AI adheres strictly to the user's role-based security boundaries.

---

## 26. Design System Governance & UX Quality Gate

### 26.1 Component Governance Rule:
$$\text{"Reuse existing @hms/ui tokens and components wherever available. New reusable UI components}$$
$$\text{must be added to @hms/ui rather than implemented as isolated module-specific components."}$$

### 26.2 The 17-Point UX Quality Gate:
Before any future HMS screen or pull request is accepted, it must pass every item in this checklist:

* [ ] 1. Can a non-technical hotel employee understand the screen within 5 seconds?
* [ ] 2. Is there exactly ONE clear primary action button?
* [ ] 3. Is unnecessary technical or database terminology completely absent?
* [ ] 4. Does the screen answer: *Where am I? What needs attention? What should I do?*
* [ ] 5. Is common task completion optimized for minimum cognitive load and typing?
* [ ] 6. Does the layout operate smoothly on Desktop ($\ge 1024\text{px}$)?
* [ ] 7. Does the layout operate smoothly on Tablet ($640\text{px} - 1023\text{px}$) with touch-first sizing?
* [ ] 8. Is the mobile view focused on *My Work + Priorities* rather than squeezed desktop tables?
* [ ] 9. Are all touch targets at least $44 \times 44\text{px}$ with at least $8\text{px}$ spacing?
* [ ] 10. Are accidental destructive gestures prevented (no naked swipe mutations)?
* [ ] 11. Is bidirectional Arabic / RTL layout architecturally supported?
* [ ] 12. Are all 4 page states implemented: Loading (skeletons), Empty (with CTA), Error (with retry), and Loaded?
* [ ] 13. Does every user mutation provide explicit success or failure feedback?
* [ ] 14. Are status badges communicating state via Icon + Label + Color (never color alone)?
* [ ] 15. Are all colors, typography, spacing, and shadows imported from `@hms/ui`?
* [ ] 16. Is WCAG 2.1 AA contrast ($\ge 4.5:1$) and visible keyboard focus ring maintained?
* [ ] 17. Does the screen avoid decorative bloat, gold-washing, and unnecessary animations?

---

## 27. Reference Principle & External Inspiration Governance

To ensure originality, legal compliance, and architectural cohesion, strict governance applies to all external design references and benchmarks:

### 27.1 UX Inspiration Only
Hospitality platforms (such as the YowStay Hotel Management Dashboard reference and leading modern PMS solutions) serve strictly as **functional and ergonomic UX inspiration**:
* Study glanceability patterns (how dense information is surfaced to the eye).
* Study operational grouping (grouping arrivals, departures, and turnaround states).
* Study spatial density (table row heights, sidebar width, card groupings).

### 27.2 Absolute Prohibitions: Zero Copying
Developers and designers are strictly forbidden from copying:
* **Branding & Identity**: No replication of logos, product names, or stylistic identity.
* **Exact Colors & Hex Values**: Never extract or reuse proprietary color palettes. All colors must derive from the sovereign `@hms/ui` Light Premium Hospitality palette.
* **Screenshots & Graphic Assets**: No bundling, embedding, or copying of third-party imagery or UI assets.
* **Proprietary Layouts & Structural Geometry**: Layouts must derive from Enterprise HMS architectural requirements, not clones of third-party templates.
* **Custom Typography**: Typography is anchored on the ratified dual Latin/Arabic stack (`Inter`, `IBM Plex Sans Arabic`, `JetBrains Mono`).

### 27.3 Architectural Coherence
Enterprise HMS is a specialized enterprise platform with strict requirements:
* Middle East luxury hospitality focus.
* Bidirectional English/Arabic RTL architectural foundation.
* Role-aware, permission-aware, and property-scoped multi-tenancy.
* High-throughput operational robustness.

External references must inspire clarity and speed, but must always yield to Enterprise HMS architectural commandments.
