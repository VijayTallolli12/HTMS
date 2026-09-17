# Integration Architecture & Gateway Contracts: Enterprise HMS

## 1. Architectural Strategy: Integration Gateway & Adapter Pattern
Enterprise HMS acts as the central brain of a luxury hotel, interfacing with specialized on-premise hardware, global reservation networks, and modern cloud services.
To protect core domains from external vendor idiosyncrasies, all external interactions flow through an **Integration Gateway** implementing the **Hexagonal Adapter Pattern**.

```
+-------------------------------------------------------------------------------+
|                          Enterprise HMS Core Domains                          |
|                       (PMS, Front Office, Finance)                            |
+-------------------------------------------------------------------------------+
                                       |
                           (Internal Domain Events)
                                       v
+-------------------------------------------------------------------------------+
|                      Integration Gateway & Adapter Layer                      |
|                                                                               |
|  +--------------------+  +--------------------+  +--------------------+       |
|  |    OTA / GDS       |  |  Payment Gateway   |  | Door Lock Adapter  |       |
|  |  SiteMinder/Amadeus|  |   Stripe / Adyen   |  | Assa Abloy / Salto |       |
|  +--------------------+  +--------------------+  +--------------------+       |
|            |                       |                       |                  |
|  +--------------------+  +--------------------+  +--------------------+       |
|  |    PBX Telecom     |  |   POS Bridge       |  |    In-Room IoT     |       |
|  | Mitel Call Logging |  | Micros / Toast POS |  | KNX / Lutron / BAC |       |
|  +--------------------+  +--------------------+  +--------------------+       |
+-------------------------------------------------------------------------------+
```

---

## 2. Primary External Integration Connectors

### 2.1 Online Travel Agencies (OTA) & Channel Managers
* **Protocols**: OTA Standard XML / HTNG 2020 / RESTful Webhooks.
* **Partners**: SiteMinder, RateGain, Direct Booking.com & Expedia QuickConnect.
* **Workflow**:
  * **Inbound**: Channels push new bookings, modifications, and cancellations -> Adapter validates schema -> Publishes `ReservationCreated` event.
  * **Outbound**: Real-time availability, rates, and inventory (ARI) updates dispatched whenever internal bookings or rate adjustments occur.

### 2.2 Global Distribution Systems (GDS)
* **Partners**: Amadeus, Sabre, Travelport.
* **Function**: Corporate travel agent connectivity, rate parity maintenance, negotiated corporate rate code validation.

### 2.3 Payment Gateways & Terminals
* **Partners**: Stripe, Adyen, FreedomPay.
* **Scope**:
  * **Online Pre-Authorization**: Hosted Fields / Elements tokenize card details without cardholder data ever touching HMS servers (PCI-DSS SAQ A).
  * **Card-Present Terminal Integration**: Cloud API connection to on-premise PIN pads for chip/PIN and contactless payments at the Front Desk.

### 2.4 Electronic Keyless Door Lock Systems
* **Partners**: Assa Abloy (Visionline / Mobile Access), Salto Systems (Space), Dormakaba.
* **Capabilities**:
  * **Physical RFID Encoders**: Front Desk check-in sends keycard encoding request (Room Number + Check-in Date + Departure Date + Key Counter).
  * **BLE Mobile Key**: Digital key payload generated and dispatched to the guest's mobile smartphone app upon mobile check-in.

### 2.5 Point of Sale (POS) Systems
* **Partners**: Micros Simphony, Toast POS, Lightspeed.
* **Capabilities**:
  * **Room Inquiry**: POS queries HMS in real-time to verify guest surname and room occupancy.
  * **Direct Charge Posting**: Restaurant, room service, or bar checks posted directly to the guest's folio with itemized receipt metadata.

### 2.6 PBX & Telephony Systems
* **Partners**: Mitel, Cisco Unified Communications, Avaya.
* **Capabilities**:
  * Automatic guest name display on guestroom telephone upon check-in.
  * Call accounting: Outbound guest phone call duration and billing rates captured and posted to folio.
  * Wake-up call scheduling and verification logging.

### 2.7 Building Management & In-Room Automation (IoT)
* **Protocols**: BACnet IP, KNX, MQTT, Modbus.
* **Capabilities**:
  * **Energy Conservation**: When a room is marked `Vacant Inspected`, thermostats enter eco-mode (e.g., 24?C in summer).
  * **Arrival Welcome Scene**: Check-in event activates air conditioning to preferred guest temperature (21?C) and opens motorized drapery.
