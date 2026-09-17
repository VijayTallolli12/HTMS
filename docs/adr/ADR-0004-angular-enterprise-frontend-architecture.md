# ADR-0004: Modern Angular Standalone & Signals-Based Frontend Architecture

## Status
Accepted

## Context
The Enterprise HMS frontend must serve diverse personas: corporate executives reviewing consolidated portfolios, front desk agents processing fast check-ins with high-density tape charts, and housekeeping supervisors inspecting room readiness.
The frontend must be responsive, maintainable, high-performance, and strictly modularized across domains.

## Decision
We adopt **Angular 18+** utilizing:
1. **Standalone Components**: Eliminates legacy NgModules for faster compilation, tree-shaking, and clear dependency declarations.
2. **Angular Signals**: Direct reactive state primitives (`signal`, `computed`, `effect`) ensuring granular, zoneless change detection and high-frequency UI updates without full component tree re-rendering.
3. **NgRx SignalStore**: Lightweight, opinionated, strongly typed state management for domain feature stores.
4. **Virtual Scrolling**: Virtualized rendering for high-density front desk tape charts and room racks handling 1,000+ rooms effortlessly.
5. **Context Switcher Shell**: Dynamic top-level property selector that switches the operational context of the entire application.

## Consequences
### Positive:
* Exceptional runtime performance and sub-16ms frame times on complex data grids.
* Clean domain separation where feature teams/agents work in isolated UI libraries (`@hms/ui-pms`, `@hms/ui-frontdesk`).
* Predictable state management with minimal boilerplate compared to classic NgRx Redux.

### Negative / Tradeoffs:
* Requires engineering familiarity with modern Angular Signal paradigms and zoneless mental models.
