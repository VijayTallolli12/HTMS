# 07 — AI Implementation Workflow & Token Optimization Protocol

Defines the standard software development lifecycle and token-saving rules for AI development agents. Existing documents under `docs/` remain the source of truth.

---

## 1. The 12-Phase AI Implementation Lifecycle

```
[Phase 1: Understand State]
           v
[Phase 2: Targeted Doc Reading]
           v
[Phase 3: Implementation Plan]
           v
[Phase 4: Independent Review]
           v
[Phase 5: Human Plan Approval]  <--- MANDATORY HUMAN GATE 1
           v
[Phase 6: Code Implementation]
           v
[Phase 7: Automated Verification] (Unit, Integration, Regression, Lint, Types, Format, Build)
           v
[Phase 8: Architecture / Security Regression Review]
           v
[Phase 9: Comprehensive Report]
           v
[Phase 10: Human Commit Approval] <--- MANDATORY HUMAN GATE 2
           v
[Phase 11: Atomic Git Commit]
           v
[Phase 12: Push (On Demand Only)]
```

### Phase Details

1. **Understand Current State**: Inspect git branch, HEAD commit, clean tree status, and active task state. Never guess commit SHAs.
2. **Targeted Reading**: Load only the minimal set of context files (see Token Protocol below).
3. **Implementation Plan**: Draft complete design covering schema, contracts, services, concurrency, error handling, and test specifications.
4. **Independent Architecture/Security Review**: Evaluate against ADRs, security boundaries, and domain boundaries.
5. **Human Approval**: Await explicit human-in-the-loop approval before creating any code or migrations.
6. **Implementation**: Implement strictly the approved scope. No early implementation of future tasks.
7. **Automated Verification**: Execute all unit tests, integration tests, regression tests, lint, typecheck, format, and build.
8. **Regression Review**: Verify zero breaking changes across previously committed tasks.
9. **Implementation Report**: Provide detailed verification metrics, test counts, and git status to the user.
10. **Human Commit Approval**: Stop and request explicit human authorization before creating git commits.
11. **Commit**: Create a single focused atomic commit following conventional commits format.
12. **Push**: Never push to remote repositories unless explicitly instructed.

---

## 2. Token Optimization Protocol: What to Read

To conserve context tokens and prevent context saturation, AI agents must follow this loading hierarchy:

### Tier 1 — General Orientation (Read Before Every Task)
Load **only** these 5 lightweight files (~5,000 tokens total):
1. `docs/ai/00_MASTER_RULES.md`
2. `docs/ai/01_CURRENT_STATE.md`
3. `docs/ai/03_DOMAIN_OWNERSHIP.md`
4. `docs/ai/09_DECISIONS.md`
5. `docs/ai/10_ACTIVE_WORK.md`

### Tier 2 — Task-Specific Context (Read Only When Relevant)
- Working on database schema or migrations? Read `docs/ai/04_DATABASE_RULES.md` + `docs/07-DATABASE-ARCHITECTURE.md`.
- Working on endpoints, security, or auth? Read `docs/ai/05_API_SECURITY_RULES.md` + `docs/04-USER-ROLES-PERMISSIONS.md`.
- Working on frontend or UI? Read `docs/ai/06_UI_UX_RULES.md` + `docs/18-HMS-UX-DEVELOPER-CONTRACT.md`.
- Preparing test suites? Read `docs/ai/08_TESTING_RULES.md` + `docs/13-TESTING-STRATEGY.md`.

**DO NOT** load the entire `docs/` folder or previous lengthy conversation transcripts into context unless explicitly requested.
