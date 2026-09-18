# 06 — UI & UX Operational Rules

Authoritative rules for frontend developers and AI agents implementing user interfaces for Enterprise HMS. Existing documents under `docs/` remain the source of truth.

---

## 1. Prime Directive

> **"The complexity belongs in the system, not in the user's head."**  
> Never expose internal architecture, database relations, CloudEvents, foreign keys, or technical jargon in the UI. Staff check in guests; they do not orchestrate aggregates. Source: `docs/18-HMS-UX-DEVELOPER-CONTRACT.md`.

---

## 2. Core Operational Commandments

- **Luxury Hospitality Aesthetic**: Calm layout, generous whitespace, high contrast, typography-driven elegance. Gold accent (`--color-gold-*`) is reserved strictly for primary interactive actions (`btn-primary`); never use gold as generic card background or borders ("no gold-washing"). Source: `docs/17-HMS-DESIGN-SYSTEM.md`.
- **Component & Token Governance**: Use `@hms/ui` design tokens exclusively. Arbitrary hex colors and inline styles are strictly forbidden. Source: `docs/18-HMS-UX-DEVELOPER-CONTRACT.md`.
- **One Primary Action**: Every operational screen features exactly **ONE** obvious primary action button (`btn-primary`). Secondary actions must be visually subordinate. Source: `docs/18-HMS-UX-DEVELOPER-CONTRACT.md`.
- **Progressive Disclosure**: Keep default screens focused on the primary shift workflow. Complex metadata and secondary actions live in slide-over contextual drawers. Source: `docs/10-UI-UX-ARCHITECTURE.md`.
- **Touch-First & Shift Conditions**: Design for busy staff standing at desks or holding tablets. Interactive targets must be $\ge 44 \times 44\text{px}$. Source: `docs/18-HMS-UX-DEVELOPER-CONTRACT.md`.
- **Gesture Safety**: Swipe gestures must NEVER silently mutate hotel operational state. Swipes may expose actions, but confirmation or intentional tap is required to commit state changes. Source: `docs/18-HMS-UX-DEVELOPER-CONTRACT.md`.
- **Confirmation for Consequential Operations**: Destructive or operational mutations (cancellations, maintenance blocks, rate overrides) require explicit confirmation dialogs. Source: `docs/18-HMS-UX-DEVELOPER-CONTRACT.md`.
- **Mandatory 4 Page States**: Every data view must explicitly define: Loading (subtle skeletons), Empty (with creation action), Error (actionable message + retry button), and Loaded. Success feedback is delivered via non-blocking toasts. Source: `docs/18-HMS-UX-DEVELOPER-CONTRACT.md`.
- **13 Canonical Status Tokens**: Map domain states to `READY`, `OCCUPIED`, `VACANT`, `DIRTY`, `CLEANING`, `INSPECTION`, `MAINTENANCE`, `OUT_OF_ORDER`, `PENDING`, `COMPLETED`, `CANCELLED`, `WARNING`, `CRITICAL`. Never communicate status with color alone (Symbol Icon + Text Label + Color mandatory). Source: `docs/17-HMS-DESIGN-SYSTEM.md`.
- **Bilingual & RTL Ready**: Arabic / English RTL support out of the box using CSS logical properties (`margin-inline-start`, `padding-inline`). Source: `docs/18-HMS-UX-DEVELOPER-CONTRACT.md`.

---

## 3. Canonical HMS Screens

1. **Operations Dashboard**: Shift overview, arrival/departure counts, occupancy, urgent exceptions.
2. **Room Operations / Tape Chart**: Date-by-room multi-property grid with sticky identity columns.
3. **Guest Command Center**: Unified guest profile, history, active reservations, preferences.
4. **Room Command Panel**: Single room deep-dive (operational status, housekeeping, maintenance history).
5. **Arrivals / Departures Workspace**: Front desk daily check-in / check-out queue with fast filtering.
6. **Housekeeping Board**: Daily attendant assignments, dirty/cleaning/inspected room boards.
7. **Maintenance Board**: Out-of-order and out-of-service work orders and scheduled blocks.
8. **Exception Center**: Overbooking risks, payment failures, VIP arrivals, maintenance blocks.
9. **AI Operational Intelligence**: Shift briefing, occupancy forecasts, automated recommendations (draft/review only). Source: `docs/10-UI-UX-ARCHITECTURE.md`.
