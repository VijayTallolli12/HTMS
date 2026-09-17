# ADR-0005: Unified Identity, Scoped RBAC, and Context-Switching Authorization

## Status
Accepted

## Context
In an enterprise hotel chain, a single human user may have different roles across different properties (e.g., a Duty Manager at Tokyo Grandeur may also be a relief auditor at Kyoto Palace). Furthermore, corporate administrators require cross-property visibility, while front desk agents must be strictly locked to their single physical hotel.
We need a unified identity and access management strategy that is flexible, secure, and resilient against privilege escalation.

## Decision
We implement a **Scoped Role-Based Access Control (RBAC) + Attribute-Based (ABAC) Context Model**:
1. **Unified User Identity**: A user has a single global identity record across the hotel group.
2. **Contextual Scope Grants**: Roles are assigned along with a scope target (`GLOBAL`, `REGION:<id>`, `PROPERTY:<id>`, `DEPT:<id>`).
3. **Context Header Resolution**: Requests pass `X-Property-ID`. The API Gateway validates that the authenticated user possesses a valid role grant matching or superseding that property scope.
4. **Dual Control / Four-Eyes Policy**: High-risk financial operations (rebates > $500) require secondary digital supervisor authorization.

## Consequences
### Positive:
* Single Sign-On across the entire brand portfolio.
* Seamless property context-switching for corporate and regional managers.
* Zero data leakage between distinct hotel properties for operational line staff.

### Negative / Tradeoffs:
* Authorization middleware must evaluate both permission strings and hierarchical scope validity on every API invocation.
* JWT payloads must be kept compact; complex cross-property role matrices are resolved via cached Redis permissions rather than bloated token claims.
