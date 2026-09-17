# API Architecture & Contract Standards: Enterprise HMS

## 1. Core Principles & Technology Standards
Enterprise HMS APIs adhere to modern enterprise REST and Event conventions:
* **Protocol**: HTTPS / HTTP/2, TLS 1.3 enforced.
* **Data Format**: JSON (`Content-Type: application/json; charset=utf-8`).
* **Specification**: OpenAPI 3.1 (Swagger) contract-first definition.
* **Standard URI Prefix**: `/api/v1/{domain}/{resource}`.

---

## 2. Authentication & Scope Context Headers

Every request from web or mobile applications must transmit:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
X-Tenant-ID: 11111111-1111-7111-8111-111111111111
X-Property-ID: 22222222-2222-7222-8222-222222222222
X-Correlation-ID: corr_982347a-d09f-4312-9c12
Idempotency-Key: idemp_6782348-2342-4912-88aa (Mandatory for mutating POST/PATCH)
```

---

## 3. Standard Response Envelope

All API responses conform to a unified wrapper structure:

### 3.1 Success Response (`200 OK` / `201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "018f6c3a-921b-7a11-89dc-5491b281f9a1",
    "confirmationNumber": "RES-2026-9812",
    "status": "CONFIRMED",
    "arrivalDate": "2026-10-01",
    "departureDate": "2026-10-05",
    "roomType": "DELUXE_OCEAN_SUITE",
    "guest": {
      "firstName": "Arthur",
      "lastName": "Pendleton",
      "email": "a.pendleton@luxury.com"
    },
    "totalAmount": 3400.00,
    "currency": "EUR"
  },
  "meta": {
    "timestamp": "2026-09-16T12:00:00Z",
    "correlationId": "corr_982347a-d09f-4312-9c12"
  }
}
```

### 3.2 Paginated List Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    { "id": "018f6c3a-...", "roomNumber": "101", "status": "CLEAN" },
    { "id": "018f6c3b-...", "roomNumber": "102", "status": "DIRTY" }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 25,
      "totalRecords": 350,
      "totalPages": 14,
      "hasNext": true,
      "hasPrev": false
    },
    "timestamp": "2026-09-16T12:00:00Z",
    "correlationId": "corr_982347a-d09f-4312-9c12"
  }
}
```

---

## 4. Standard Error Handling: RFC 7807 Problem Details

All error responses return HTTP status codes in the 4xx/5xx range and serialize to the **RFC 7807** specification:

```json
{
  "type": "https://api.enterprise-hms.com/errors/room-not-ready",
  "title": "Room Not Ready For Check-in",
  "status": 409,
  "detail": "Physical room 402 is currently DIRTY and has not completed housekeeping inspection.",
  "instance": "/api/v1/frontdesk/checkin/res_8829",
  "code": "ROOM_NOT_INSPECTED",
  "invalidParams": [
    {
      "name": "roomId",
      "reason": "Target room state must be INSPECTED before assigning keys."
    }
  ],
  "timestamp": "2026-09-16T12:00:00Z",
  "correlationId": "corr_982347a-d09f-4312-9c12"
}
```

---

## 5. Query Conventions: Filtering, Sorting & Pagination

### 5.1 Filtering
Use bracketed property parameters:
* Equality: `GET /api/v1/pms/reservations?filter[status]=CONFIRMED`
* Range: `GET /api/v1/pms/reservations?filter[arrivalDate][gte]=2026-10-01&filter[arrivalDate][lte]=2026-10-07`
* Multi-value: `GET /api/v1/operations/rooms?filter[status][in]=CLEAN,INSPECTED`

### 5.2 Sorting
Comma-separated fields with `-` prefix for descending order:
* `GET /api/v1/finance/folios?sort=-createdAt,folioNumber`

---

## 6. Idempotency Specification
Mutating actions that alter financial state or room occupancy must support the `Idempotency-Key` header:
1. When receiving `Idempotency-Key`, the API checks Redis for an existing execution key (`idemp:{tenant_id}:{key}`).
2. If in-flight, returns `429 Too Many Requests` or `409 Conflict`.
3. If already completed, returns the cached previous response verbatim without re-executing business logic.
4. If fresh, executes the request within a database transaction and caches the response payload with a 24-hour TTL.

---

## 7. Rate Limiting Standards (RFC 6585 / IETF Draft)
Every API response transmits standardized rate limiting headers:
```http
RateLimit-Limit: 100
RateLimit-Remaining: 94
RateLimit-Reset: 1726488000
```
When limits are breached, the server returns `429 Too Many Requests` with:
```http
Retry-After: 30
```

---

## 8. Webhook & Integration Signature Standard
Inbound and outbound integration webhooks (OTAs, payment gateways, door locks) use HMAC-SHA256 signature verification:
```http
X-HMS-Signature: t=1726488000,v1=a5c8d234f981e7...
```
The payload signature is computed as:
`HMAC_SHA256(timestamp + "." + raw_body, secret)`

---

## 9. Batch / Bulk Mutation Conventions
High-volume operational operations (e.g., morning housekeeping task generation, bulk room status changes) use dedicated batch endpoints:
* URI: `POST /api/v1/{domain}/{resource}/batch`
* Response returns an itemized breakdown with HTTP `207 Multi-Status` or standard `200 OK` containing successful and failed records.

---

## 10. API Lifecycle & Deprecation Policy
When an API endpoint is scheduled for retirement, the server emits standard IETF deprecation headers:
```http
Deprecation: @1758000000
Sunset: Wed, 16 Sep 2027 00:00:00 GMT
Link: </api/v2/pms/reservations>; rel="successor-version"
```
