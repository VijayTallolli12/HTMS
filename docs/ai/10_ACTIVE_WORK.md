# 10 — Active Development Work & Immediate Context

This is the living context file for the active development session. It must be consulted and updated whenever task status changes. Existing documents under `docs/` remain the source of truth.

---

## 1. Current Repository State

- **Active Git Branch**: `feature/pms/w1-t06-room-operations`
- **Current HEAD Commit**: `bb2a119` (`feat(pms): implement W1-T06 room operations status engine`)
- **T06 Commit Status**: **COMMITTED LOCALLY** (`bb2a119`) — Unpushed
- **Working Tree**: Clean (all changes staged and committed cleanly; documentation context layer in progress)

---

## 2. Current Task

- **Task**: **HMS AI Context & Token Optimization Layer**
- **Type**: Documentation / Context Optimization Only
- **Constraints**:
  - Zero application source code modifications.
  - Zero database schema or migration changes.
  - Zero T07 / future task implementation.
  - Zero commits or pushes without explicit human authorization.
- **Status**: **IN PROGRESS**

---

## 3. Next Planned Task

- **Task**: **W1-T07 — Room Assignment & Arrival / Check-In Processing**
- **Status**: **QUEUED — NOT YET APPROVED FOR PLANNING OR IMPLEMENTATION**
- **Boundary Rules**:
  - Do NOT implement T07 logic, schemas, endpoints, or contracts.
  - Do NOT create a branch for T07.
  - Await explicit user instruction and produce a dedicated T07 implementation plan before writing any T07 code.

---

## 4. Operating Guardrails for the Active Session

1. **Stop Condition**: Stop and report after completing the AI context layer. Do not auto-commit or auto-push.
2. **Read Minimal Context**: When starting a new task, read only `docs/ai/00_MASTER_RULES.md`, `docs/ai/01_CURRENT_STATE.md`, `docs/ai/03_DOMAIN_OWNERSHIP.md`, `docs/ai/09_DECISIONS.md`, and `docs/ai/10_ACTIVE_WORK.md`.
3. **Strict Human Gate**: Human review and approval are required at Phase 5 (Plan Approval) and Phase 10 (Commit Approval).
