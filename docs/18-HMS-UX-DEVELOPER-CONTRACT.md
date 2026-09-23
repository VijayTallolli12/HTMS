# 18 — Enterprise HMS AI Developer UX Contract

## 1. Authority & Scope
This contract is **binding on all human developers and autonomous AI agents** implementing or modifying user interfaces for the Enterprise Hotel Management System (HMS).

* **Source of Truth**: [docs/17-HMS-DESIGN-SYSTEM.md](file:///f:/Folkslogic/enterprise-hms/docs/17-HMS-DESIGN-SYSTEM.md)
* **Canonical Visual Direction**: **Light Premium Hospitality** (crisp light/neutral surfaces, deep slate typography, restrained warm camel/bronze accent, subtle borders, soft natural elevation).
* **Strict Objective**: Ensure every screen delivers an exceptional, calm, fast, and operationally intuitive experience for hotel staff under real-world shift conditions.

---

## 2. Core Operational Commandments

### Rule 1: "The complexity belongs in the system, not in the user's head"
Never expose internal architecture, database relations, CloudEvents, foreign keys, or technical jargon in the user interface. Staff check in guests; they do not orchestrate aggregates.

### Rule 2: "The HMS should feel calm, clear and operational — not flashy"
Hotel workspaces must project quiet competence and composure. Banish decorative gradients, neon glow effects, heavy glassmorphism, floating ornamental illustrations, and animated clutter.

### Rule 3: Light-First Visual System
All new views and components must adhere to the **Light Premium Hospitality** visual system:
* Light neutral background canvas (`#F8FAFC`) with crisp white card containers (`#FFFFFF`).
* Charcoal/slate typography (`#0F172A` / `#334155`) ensuring WCAG AA contrast ($> 4.5:1$).
* Restrained warm bronze/camel accent (`#9A7B38`) reserved for primary action buttons, active indicator lines, and focus outlines.
* Semantic status colors calibrated for light backgrounds (green, blue, amber, red, purple, slate).
* Fine 1px architectural borders (`#E2E8F0`) and soft natural elevation shadows (`0 1px 2px rgba(0,0,0,0.05)`).
* Moderate border radii (6px to 10px).

### Rule 4: Contextual Operations (SELECT → INSPECT → ACT)
Prefer inline drawers, contextual command panels, and side sheets over jarring full-page roundtrips:
* **Select**: User selects a room, booking, or folio in the active grid.
* **Inspect**: Details open in a slide-over drawer while preserving grid scroll state.
* **Act**: Operational tasks (`[ Check In ]`, `[ Mark Clean ]`, `[ Post Charge ]`) execute within the contextual panel with instant reactive update to the grid.

### Rule 5: Operational Dashboard Purpose
> *"The dashboard is an operational workspace, not a module directory."*  
The dashboard answers: **"What does this user need to know or act on right now?"**
* Avoid vanity metric cards, sprawling decorative graphs, and non-actionable data dumps.
* Focus on live shift bottlenecks: impending arrivals without assigned rooms, departures awaiting billing settlement, priority dirty rooms blocking check-in, and maintenance blocks (OOO/OOS).

### Rule 6: Workflow-Centric Hotel Navigation
Organize navigation around actual hotel workflows rather than raw database entities:
* **TODAY**: Operations Briefing, Exceptions & Blocks.
* **FRONT OFFICE**: Arrivals, Departures, Reservations, Guests, Folio / Cashiering.
* **ROOM OPERATIONS**: Tape Chart, Room Status Board, Availability (ATS).
* **HOUSEKEEPING**: Cleaning Tasks, Supervisory Inspections.
* **ENGINEERING**: Maintenance Work Orders, OOO/OOS Blocks.
* **Tri-Factor Scoping**: Navigation visibility must remain strictly **role-aware**, **permission-aware** (server-authoritative from `/auth/me`), and **property-aware**.

### Rule 7: Room Status Visualization Standard
Room status visualization is a foundational visual language across the platform. Semantic states must map explicitly:
* `AVAILABLE` (Vacant Clean/Inspected), `OCCUPIED`, `DIRTY`, `CLEANING`, `CLEAN`, `INSPECTED`, `OOO` (Out of Order), `OOS` (Out of Service).
* **Zero Color-Only Meaning Rule**: Status must NEVER be communicated through color alone. Every indicator must combine **Symbol Icon + Text Label + Status Pill/Border**.

### Rule 8: The Time-to-Action Principle
> **Mandatory Rule**:  
> Common operational tasks should be optimized for minimum cognitive load and minimum unnecessary interaction, while maintaining required controls, authorization, business rules, and auditability.

Routine workflows (check-in, checkout, cleaning updates, ticket creation) must follow a fast "Happy Path" with sensible defaults.

### Rule 9: One Primary Action Per Operational View
Every operational screen must feature **ONE clear primary action button** styled with the primary accent (`btn-primary`). Secondary actions must be visually subordinate (`btn-secondary`, ghost buttons, or action menus).

### Rule 10: Mobile Operational Safety
* **Never Squeeze Desktop onto Mobile**: Mobile views must focus strictly on **My Work, Priorities, Quick Actions, and Exceptions**.
* **Gesture Safety**: Do NOT allow swipe gestures to silently mutate important hotel operational states. Swipe may reveal or expose an action, but important state changes require an intentional user action.
* **Confirmation for Consequential Operations**: Destructive or irreversible operations (cancellations, voids, out-of-order blocks) require explicit confirmation dialogs.

### Rule 11: Mandatory 4 Page States & Mutation Feedback
Every data-driven screen must explicitly define four states:
1. **Loading State**: Subtle geometric skeletons (no jumping layouts).
2. **Empty State**: Clear explanation with an action to create the first record.
3. **Error State**: Actionable error description explaining what went wrong and how to fix it, with a retry button.
4. **Loaded/Normal State**: The operational workspace.

Every user mutation must provide:
* **Success Feedback**: Non-blocking toast (4s auto-dismiss) or contextual status badge update.
* **Failure Feedback**: Actionable error banner with RFC 7807 problem details.

### Rule 12: Bidirectional Arabic / English / RTL Readiness
All new components and layouts must support RTL by default:
* Use logical CSS properties (`margin-inline-start`, `padding-inline`, `text-align: start`).
* Ensure mirrored drawers, chevrons, and breadcrumbs in Arabic mode.

### Rule 13: Reference Principle & External Inspiration Governance
External references (such as the YowStay Hotel Management Dashboard reference) serve strictly as **UX inspiration** for glanceability and operational density.
* **Strictly Prohibited**: Never copy branding, logos, exact colors, screenshots, graphic assets, proprietary layouts, or typography.
* All implementations must strictly use sovereign `@hms/ui` tokens and enterprise architectural patterns.

---

## 3. PR Rejection Criteria (Automatic Gate Failures)

A pull request or code change will be **REJECTED** if it contains any of the following:

1. [ ] Arbitrary hex colors not defined in `@hms/ui` Light Premium Hospitality tokens.
2. [ ] Technical jargon exposed to users (`entity`, `aggregate`, `transaction`, `foreign key`).
3. [ ] More than one equally prominent primary action button on an operational screen.
4. [ ] Missing loading skeleton, empty state, or error state on a data view.
5. [ ] Interactive controls with touch targets smaller than $44 \times 44\text{px}$.
6. [ ] Naked swipe gestures that silently mutate room or reservation status.
7. [ ] Hardcoded physical CSS positions (`left: 10px`, `margin-right: 16px`) that break RTL.
8. [ ] Status indicators that rely solely on color (e.g. green/red dots without labels or icons).
9. [ ] Generic admin dashboard metric cards crammed with decorative charts.
10. [ ] Forms with placeholder text acting as the only field label.
11. [ ] Heavy glassmorphism, rainbow gradients, or decorative visual noise.
12. [ ] Copied third-party assets, colors, or proprietary layouts from external references.
