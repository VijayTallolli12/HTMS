# Multi-Property Organization Model: Enterprise HMS

## 1. Enterprise Organizational Hierarchy
Enterprise HMS is engineered from the ground up to support massive multi-unit luxury hospitality groups operating across diverse continents, tax jurisdictions, and operational brands.

`
                    +-----------------------------+
                    |      Hotel Group HQ         |
                    |  (Global Brands, Policies)  |
                    +-----------------------------+
                                   |
                +------------------+------------------+
                |                                     |
        +-------v-------+                     +-------v-------+
        |  Region: APAC |                     | Region: EMEA  |
        +---------------+                     +---------------+
                |                                     |
        +-------v-------+                     +-------v-------+
        | Country: Japan|                     | Country: UAE  |
        +---------------+                     +---------------+
                |                                     |
      +---------v---------+                 +---------v---------+
      | Property: Tokyo   |                 | Property: Dubai   |
      | Grandeur Palace   |                 | Desert Resort     |
      +-------------------+                 +-------------------+
                |                                     |
        +-------v-------+                     +-------v-------+
        | Building: East|                     | Building: Main|
        +---------------+                     +---------------+
                |                                     |
        +-------v-------+                     +-------v-------+
        | Floor: 04     |                     | Floor: 01     |
        +---------------+                     +---------------+
                |                                     |
     +----------+----------+               +----------+----------+
     |                     |               |                     |
+----v----+           +----v----+     +----v----+           +----v----+
|Room 401 |           |Pool Bar |     |Room 102 |           |Spa Deck |
+---------+           +---------+     +---------+           +---------+
`

### Hierarchy Breakdown & Scoping Rules

1. **Hotel Group (Corporate Global Tier)**:
   * Defines brand standards, central rate templates, global loyalty structures, and consolidated corporate reporting.
   * Can inspect and report across all regions, properties, and corporate legal entities.

2. **Region (Geographical / Operational Cluster)**:
   * Manages regional compliance, localized rate strategies, cluster human resources, and regional marketing initiatives.
   * Scoped to properties within designated continental or economic borders.

3. **Country (Jurisdictional Tier)**:
   * Governs fiscal requirements (VAT/GST rules, localized tax withholding), data sovereignty policies (e.g., GDPR in EU, DPDP in India), and currency definitions.

4. **Property (Operational Unit Tier)**:
   * The fundamental autonomous unit of hotel operation. Contains its own physical inventory, staff roster, daily cashier banks, and local guest folios.
   * Holds the primary isolation key (property_id) throughout the platform.

5. **Building (Physical Wing / Tower)**:
   * Groups rooms and facilities by physical infrastructure. Crucial for housekeeping sections, maintenance isolation, and elevator bank routing.

6. **Floor (Level Tier)**:
   * Physical floor within a building. Used for room attendant daily assignments, luggage delivery routing, and fire safety evacuation zones.

7. **Room / Outlet / Facility (Terminal Asset Tier)**:
   * **Room**: Physical guest accommodation unit.
   * **Outlet**: Point of sale venue (Restaurant, Lounge, Pool Bar, Gift Shop).
   * **Facility**: Guest amenity space (Executive Club, Spa Treatment Room, Tennis Court, Banquet Hall).

---

## 2. User Persona Taxonomy & Scoped Access

Users within Enterprise HMS belong to distinct operational tiers with strictly bounded access:

### 1. Corporate Users (Group Executive Level)
* **Personas**: Group CEO, Chief Commercial Officer, Corporate Director of Revenue, Head of Internal Audit.
* **Scope**: Portfolio-wide read access; selective global write access (e.g., approving global rate policies, brand configurations).
* **Context**: Defaults to Corporate Multi-Property View with the ability to switch into any property in read-only audit mode.

### 2. Regional Users (Cluster Level)
* **Personas**: Regional Vice President, Area Financial Controller, Cluster Revenue Manager, Regional HR Director.
* **Scope**: Scoped to their assigned region (e.g., 
egion_id = 'apac'). Cannot see EMEA or Americas data unless explicitly granted cross-regional delegation.

### 3. Property Management Users (Executive Property Level)
* **Personas**: General Manager (GM), Director of Operations, Financial Controller, Director of Rooms.
* **Scope**: Full operational and financial visibility within their designated property (property_id). Cannot access other sister properties without switching context.

### 4. Departmental Heads (Mid-Management Level)
* **Personas**: Front Office Manager, Executive Housekeeper, Chief Engineer, Food & Beverage Director.
* **Scope**: Full read/write within their department at their specific property. Cross-departmental operational visibility (e.g., Housekeeper seeing Front Desk arrivals) is granted for coordination.

### 5. Operational Users (Line Staff Level)
* **Personas**: Front Desk Receptionist, Night Auditor, Housekeeping Attendant, Maintenance Technician, Spa Therapist, F&B Server.
* **Scope**: Strictly task-focused and property-bounded. Housekeeping attendants see only their assigned room task list for their active shift; Maintenance technicians see only assigned work orders.

### 6. Guest Users (Customer Level)
* **Personas**: Reserved Guest, In-House VIP, Loyalty Member.
* **Scope**: Strictly restricted to their own GuestProfile, their active and past Reservations, current Folio balance, and direct ServiceRequests. Absolutely zero visibility into internal hotel operational data or other guests.

---

## 3. Data Scoping & Context Switching Architecture

### Context Header Specification
Every API request issued by an administrative, operational, or mobile client must transmit context headers:
`http
Authorization: Bearer <jwt-token>
X-Tenant-ID: <tenant-uuid>
X-Property-ID: <property-uuid>
X-Department-ID: <department-uuid> (optional, for operational workers)
`

### Context Resolution Flow
1. **Token Validation**: The API Gateway verifies the JWT cryptographic signature and extracts user identity and assigned scope grants.
2. **Scope Verification**: The Authorization Engine checks if the user has permission for the requested X-Property-ID:
   * Corporate users: Authorized for all properties in the tenant.
   * Regional users: Authorized for properties matching their 
egion_id.
   * Property staff: Authorized ONLY if user is assigned to that specific property_id.
3. **Database Query Scoping**: Every database query automatically binds property_id in SQL statements, preventing accidental multi-property data leaks.
