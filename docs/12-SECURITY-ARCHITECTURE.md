# Security, Identity & Compliance Architecture: Enterprise HMS

## 1. Security Architecture Principles
Enterprise HMS is architected around a **Zero-Trust Security Model**. Every request?whether originating from an internal employee workstation, a mobile handheld, or an external cloud integration?must be authenticated, authorized, and cryptographically verified.

---

## 2. Authentication & Identity Management
* **Standard**: OpenID Connect (OIDC) & OAuth 2.0.
* **Enterprise Single Sign-On (SSO)**: SAML 2.0 / Azure AD / Okta integration for corporate and property employees.
* **Multi-Factor Authentication (MFA)**: Mandatory for all Corporate, Regional, General Manager, and Cashier accounts.
* **Token Architecture**:
  * **Access Token**: Short-lived (15 minutes), stateless JWT containing `user_id`, `tenant_id`, `assigned_properties`, and active `roles`.
  * **Refresh Token**: Long-lived (8 hours for staff, 30 days for mobile guests), stored in secure, `HttpOnly`, `SameSite=Strict` browser cookies, with automatic reuse detection and revocation.

---

## 3. Data Protection & Compliance

### 3.1 PCI-DSS Compliance Strategy (Scope Minimization)
* **SAQ A Compliance**: Enterprise HMS **never** stores, processes, or transmits raw Primary Account Numbers (PAN), CVV/CVC codes, or magnetic stripe data.
* **Tokenization**: Card entry forms use hosted iframes (Stripe Elements / Adyen Web Drop-in). HMS stores only opaque multi-use card tokens (`tok_982348a`), expiration date, and the last 4 digits for receipt display.

### 3.2 Data Sovereignty & Privacy (GDPR, CCPA, DPDP)
* **PII Governance**: Personally Identifiable Information (guest passports, contact numbers, national IDs) is encrypted at rest using AES-256 with tenant-specific keys.
* **Right to Be Forgotten**: Supports automated anonymization of guest profiles (replacing names with randomized pseudonyms) while preserving immutable financial audit ledger entries as legally required by fiscal authorities.
* **Consent Management**: Explicit guest opt-in tracking for marketing communications and profiling.

---

## 4. Comprehensive Audit Logging & Forensics
Enterprise HMS maintains an **Immutable Audit Trail** in `audit_schema.system_audit_logs`. Every state-mutating operation records:
* `timestamp` (UTC clock timestamp)
* `actor_id` (User UUID or Service Account)
* `property_id`
* `action_name` (e.g., `folio.rebate_approved`, `room.status_override`)
* `target_entity_type` and `target_entity_id`
* `ip_address` and `user_agent`
* `previous_state` and `new_state` (JSONB diff)
* `reason_code` (Mandatory for financial overrides and room status downgrades)

---

## 5. Dual-Control & High-Risk Approval Workflows
To mitigate insider threat and operational fraud:
1. **Four-Eyes Principle (Dual Signature)**:
   * Any single folio rebate or refund exceeding $500 requires approval from a second authorized supervisor before posting.
   * Modifying property tax configuration or night audit business rules requires corporate controller signoff.
2. **Rate Limit Defenses**:
   * Public booking endpoints protected by Cloudflare DDoS defense and strict Redis-backed token bucket rate limiters (Max 5 requests/second per IP).
   * Front desk search endpoints rate-limited to prevent bulk guest profile scraping.
