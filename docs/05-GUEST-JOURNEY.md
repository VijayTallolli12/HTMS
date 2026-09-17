# End-to-End Guest Lifecycle: Luxury Hospitality Experience

## 1. The 14-Stage Guest Journey Overview
In luxury hospitality, guest service must be proactive, seamless, and deeply personalized. Enterprise HMS coordinates physical departments behind the scenes to deliver an effortless guest experience.

```
Stage 01: Discovery & Booking ---------> Stage 02: Confirmation & Profile Curation
Stage 03: Pre-Arrival Engagement ------> Stage 04: Room Preparation & VIP Staging
Stage 05: Arrival & Curbside Welcome --> Stage 06: Seamless Check-In & Key Delivery
Stage 07: Settling In & Room Intro ----> Stage 08: In-Stay Service & Concierge
Stage 09: Dining, Spa & Activities ----> Stage 10: Proactive Issue Recovery
Stage 11: Express Pre-Checkout Review -> Stage 12: Departure & Luggage Assist
Stage 13: Post-Departure Folio Delivery -> Stage 14: Loyalty Curation & Re-engagement
```

---

## 2. Detailed Lifecycle Stages & Departmental Matrix

### Stage 1: Discovery & Booking
* **Guest Touchpoint**: Web Portal, Brand Mobile App, Luxury Travel Advisor (Virtuoso/Amex FHR), Corporate Booking Tool.
* **Departments**: Revenue Management (Rate yields), Central Reservations (Voice).
* **System Action**: Rates and room availability verified via PMS; dynamic rate restrictions applied.

### Stage 2: Confirmation & Profile Curation
* **Guest Touchpoint**: Instant omnichannel confirmation (Email, WhatsApp, SMS).
* **Departments**: CRM & Central Reservations.
* **System Action**: `ReservationCreated` event emitted. CRM deduplicates guest profile, links past stay history, and flags VIP tier.

### Stage 3: Pre-Arrival Engagement (T-72h to T-24h)
* **Guest Touchpoint**: Interactive digital concierge questionnaire (Pillow preferences, dietary requirements, arrival flight details).
* **Departments**: Guest Relations, Concierge.
* **System Action**: Pre-arrival preferences parsed and injected into `GuestPreference` store. Transport team alerts logged for flight arrivals.

### Stage 4: Room Preparation & VIP Staging (T-12h to T-2h)
* **Guest Touchpoint**: None (Internal operational magic).
* **Departments**: Front Office, Housekeeping, Engineering, Food & Beverage.
* **System Action**: 
  1. Room Assignment Algorithm matches guest preferences (e.g., high floor, quiet corner).
  2. Housekeeping executes Deep Clean or VIP Turnaround.
  3. Engineering verifies climate control and lighting presets.
  4. F&B delivers welcome amenity (Champagne/Fruit platter).
  5. Housekeeping Supervisor certifies room status as `Inspected`.

### Stage 5: Arrival & Curbside Welcome
* **Guest Touchpoint**: Bell desk, Valet team, Doorman.
* **Departments**: Concierge & Transport, Front Office.
* **System Action**: Chauffeur or valet alerts the Front Desk via Staff Mobile App: "VIP Guest Mr. Sinclair has arrived curbside."

### Stage 6: Seamless Check-In & Key Delivery
* **Guest Touchpoint**: In-lounge tablet check-in or instant Mobile Key on Guest App.
* **Departments**: Front Office.
* **System Action**: Identity verified, payment card pre-authorized, digital registration card signed. Room status transitions to `Occupied`. Keycard or BLE Mobile Key provisioned.

### Stage 7: Settling In & In-Room Ambiance
* **Guest Touchpoint**: In-room TV greeting, ambient climate control adjustment.
* **Departments**: Guest Services, Butler Service.
* **System Action**: IoT Gateway triggers "Welcome Scene" (Curtains open, welcome ambient music plays, lighting set to relaxing mood).

### Stage 8: In-Stay Service & Concierge
* **Guest Touchpoint**: Guest App service chat, voice PBX, in-room tablet.
* **Departments**: Housekeeping, Concierge, Room Service.
* **System Action**: Service requests (e.g., extra pillows, ice, laundry pickup) dispatched instantly to the closest available staff member with automated SLA timers.

### Stage 9: Dining, Spa & Activities
* **Guest Touchpoint**: Fine dining restaurant, pool bar, wellness spa.
* **Departments**: Food & Beverage, Spa & Wellness, Finance.
* **System Action**: Guest room number verified at POS; charges verified against open folio credit limits and posted in real-time to the room folio.

### Stage 10: Proactive Issue Recovery
* **Guest Touchpoint**: Manager visit or proactive service recovery gift.
* **Departments**: Duty Manager, Engineering, Guest Relations.
* **System Action**: If an engineering work order or guest complaint is logged, an automated notification alerts the Duty Manager. A recovery credit or amenity is issued, linked directly to the guest profile.

### Stage 11: Express Pre-Checkout Review (T-12h before departure)
* **Guest Touchpoint**: Mobile App interactive folio review.
* **Departments**: Finance, Front Desk.
* **System Action**: Draft folio generated; guest reviews charges, selects payment card, and requests invoice delivery email.

### Stage 12: Departure & Luggage Assistance
* **Guest Touchpoint**: Express checkout click, valet car retrieval, luggage assistance.
* **Departments**: Front Office, Concierge, Valet.
* **System Action**: Final payment settled against pre-authorization. Room status immediately transitions to `Vacant Dirty`. Valet car brought to front drive.

### Stage 13: Post-Departure Folio Delivery
* **Guest Touchpoint**: Itemized tax invoice delivered via PDF email.
* **Departments**: Finance, Night Audit.
* **System Action**: Official fiscal invoice generated with unique sequence number; folio closed.

### Stage 14: Loyalty Curation & Re-engagement
* **Guest Touchpoint**: Post-stay survey (NPS), loyalty points credit notice.
* **Departments**: CRM, Marketing, Loyalty.
* **System Action**: Stay spend credited to loyalty ledger; tier level evaluated; personalized promotional invitation scheduled based on guest preferences.
