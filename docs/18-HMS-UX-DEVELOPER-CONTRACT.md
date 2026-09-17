# 18 — Enterprise HMS AI Developer UX Contract

## 1. Authority & Scope
This contract is **binding on all human developers and autonomous AI agents** implementing or modifying user interfaces for the Enterprise Hotel Management System (HMS).

* **Source of Truth**: [docs/17-HMS-DESIGN-SYSTEM.md](file:///f:/Folkslogic/enterprise-hms/docs/17-HMS-DESIGN-SYSTEM.md)
* **Baseline Commits**: W1-T01 (`41d0d97`), W1-T02 (`5e3018b`)
* **Strict Objective**: Ensure every screen delivers an exceptional, luxury, fast, and operationally intuitive experience for hotel staff under real-world shift conditions.

---

## 2. Core Operational Commandments

### Rule 1: "The complexity belongs in the system, not in the user's head"
Never expose internal architecture, database relations, CloudEvents, foreign keys, or technical jargon in the user interface. Staff check in guests; they do not orchestrate aggregates.

### Rule 2: Component & Token Governance
> **Mandatory Rule**:  
> Reuse existing `@hms/ui` tokens and components wherever available. New reusable UI components must be added to `@hms/ui` rather than implemented as isolated module-specific components. Do not assume components exist if they have not yet been created.

Never invent ad-hoc hex colors, arbitrary inline spacing, or isolated CSS button variations. All styling must derive directly from `@hms/ui`.

### Rule 3: The Time-to-Action Principle
> **Mandatory Rule**:  
> Common operational tasks should be optimized for minimum cognitive load and minimum unnecessary interaction, while maintaining required controls, authorization, business rules, and auditability.

Routine workflows (check-in, checkout, cleaning updates, ticket creation) must follow a fast "Happy Path" with sensible defaults.

### Rule 4: One Primary Action Per Operational View
Every operational screen must feature **ONE clear primary action button** styled with the gold accent (`btn-primary`). Secondary actions must be visually subordinate (`btn-secondary`, ghost buttons, or action menus).

### Rule 5: Design for Real Hotel Conditions
Always assume operational staff are:
* Working busy shifts under time pressure.
* Frequently interrupted by guests or phone calls.
* Operating touchscreens or tablets while standing.
* Unfamiliar with technical jargon.
* Switching contexts across multiple operational duties.

Prioritize: clear next action, contextual information, sensible defaults, minimal typing, minimal navigation, fast feedback, and recoverable errors.

### Rule 6: Mobile Operational Safety
* **Never Squeeze Desktop onto Mobile**: Mobile views must focus strictly on **My Work, Priorities, Quick Actions, and Exceptions**.
* **Gesture Safety**: Do NOT allow swipe gestures to silently mutate important hotel operational states. Swipe may reveal or expose an action, but important state changes require an intentional user action.
* **Confirmation for Consequential Operations**: Destructive or irreversible operations (cancellations, voids, out-of-order blocks) require explicit confirmation dialogs.

### Rule 7: Mandatory 4 Page States & Mutation Feedback
Every data-driven screen must explicitly define four states:
1. **Loading State**: Subtle geometric skeletons (no jumping layouts).
2. **Empty State**: Clear explanation with an action to create the first record.
3. **Error State**: Actionable error description explaining what went wrong and how to fix it, with a retry button.
4. **Loaded/Normal State**: The operational workspace.

Every user mutation must provide:
* **Success Feedback**: Non-blocking toast (4s auto-dismiss) or contextual status badge update. (Success is not a mandatory persistent page state).
* **Failure Feedback**: Actionable error banner with RFC 7807 problem details.

### Rule 8: The 13 Canonical Status Tokens
Map all domain statuses strictly to the **13 canonical statuses**:
`READY`, `OCCUPIED`, `VACANT`, `DIRTY`, `CLEANING`, `INSPECTION`, `MAINTENANCE`, `OUT_OF_ORDER`, `PENDING`, `COMPLETED`, `CANCELLED`, `WARNING`, `CRITICAL`.
* **Accessibility Rule**: Status must NEVER be communicated through color alone. Always present **Symbol Icon + Text Label + Color**.

### Rule 9: Bidirectional Arabic / English / RTL Readiness
All new components and layouts must support RTL by default:
* Use logical CSS properties (`margin-inline-start`, `padding-inline`, `text-align: start`).
* Ensure mirrored drawers, chevrons, and breadcrumbs in Arabic mode.

### Rule 10: Prohibition of "Gold-Washing" & Decorative Noise
Gold is an accent, not a background. Do not apply gold borders to every card or bold weights to every string. Elegance comes from typography, spacing, contrast, and calm layout.

---

## 3. PR Rejection Criteria (Automatic Gate Failures)

A pull request or code change will be **REJECTED** if it contains any of the following:

1. [ ] Arbitrary hex colors not defined in `@hms/ui`.
2. [ ] Technical jargon exposed to users (`entity`, `aggregate`, `transaction`, `foreign key`).
3. [ ] More than one equally prominent primary action button on an operational screen.
4. [ ] Missing loading skeleton, empty state, or error state on a data view.
5. [ ] Interactive controls with touch targets smaller than $44 \times 44\text{px}$.
6. [ ] Naked swipe gestures that silently mutate room or reservation status.
7. [ ] Hardcoded physical CSS positions (`left: 10px`, `margin-right: 16px`) that break RTL.
8. [ ] Status indicators that rely solely on color (e.g. green/red dots without labels or icons).
9. [ ] Generic admin dashboard metric cards crammed with decorative charts.
10. [ ] Forms with placeholder text acting as the only field label.
