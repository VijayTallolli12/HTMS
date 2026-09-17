# ADR-0006: AI Capabilities, Operational Boundaries & Safety Governance

## Status
Accepted

## Context
Enterprise HMS will incorporate Artificial Intelligence (AI) for guest concierge services, natural language service requests, predictive maintenance diagnostics, and dynamic revenue management suggestions.
However, in an enterprise luxury hospitality environment, AI must remain strictly outside the transactional authority of the HMS core. Unconstrained AI actions pose severe financial, legal, physical, and brand risks.

## Decision
We mandate that **AI remains strictly outside the transactional authority of the HMS core**:

### 1. Permitted AI Capabilities
AI models, agents, and copilots are permitted to:
* **Analyze**: Examine historical occupancy, guest sentiment trends, and telemetry patterns.
* **Recommend**: Suggest room assignments matching guest preferences, recommend wine pairings, or propose rate hurdles.
* **Summarize**: Generate executive briefings on daily night audit figures or synthesize guest feedback.
* **Classify**: Categorize incoming guest messages into inquiry categories (housekeeping, dining, transport).
* **Draft**: Prepare draft service request tickets or draft email responses for staff review.
* **Detect Anomalies**: Flag irregular HVAC energy spikes or unexpected occupancy drops.
* **Suggest Actions**: Propose preventive maintenance schedules or VIP amenity packages.

*Execution Constraint*: AI may execute an action **only** through an explicitly authorized tool/API and **only** where the specific action is permitted.

### 2. Strictly Prohibited AI Actions (Zero Independent Authority)
AI must **NEVER** independently:
* **Post financial transactions**: Cannot create folio line items, room charges, or POS billings.
* **Issue refunds**: Cannot process credit card refunds, voids, or payment reversals.
* **Alter rate rules**: Cannot modify rate plans, base rates, seasonal pricing, or cancellation penalties.
* **Mark rooms Clean**: Cannot update room status from `Dirty` to `Clean`.
* **Mark rooms Inspected**: Cannot certify a room as `Inspected` or VIP-ready.
* **Activate/deactivate physical access**: Cannot encode RFID keycards or issue/revoke BLE mobile digital keys.
* **Bypass authorization**: Cannot override RBAC permissions, skip tenant scoping, or perform unauthenticated API calls.
* **Access unrestricted PII**: Cannot view unmasked passport numbers, national IDs, or raw payment card tokens.

### 3. Mandatory Auditability
All AI actions, tool calls, generated recommendations, and user-facing inferences must be recorded in `audit_schema.ai_action_logs` with:
* `timestamp` (UTC)
* `agent_identifier` and `model_version`
* `prompt_hash` and sanitized parameters
* `confidence_score`
* `resulting_tool_execution`
* `human_approver_id` (where human confirmation was required)

## Consequences
### Positive:
* Eliminates operational, security, and financial risk of hallucinated or rogue AI actions.
* Guarantees compliance with GDPR, PCI-DSS, and local hotel fiscal regulations.
* Preserves high-touch luxury hospitality standards where human professionals retain ultimate authority over guest commitments.

### Negative / Tradeoffs:
* Requires explicit human-in-the-loop verification steps for critical operational transitions.
