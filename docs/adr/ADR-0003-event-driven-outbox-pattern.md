# ADR-0003: Transactional Outbox Pattern & RabbitMQ Event Broker Selection

## Status
Accepted

## Context
Hospitality workflows require reliable, real-time coordination across departments:
* Guest Check-in must trigger keycard encoding, PBX welcome display, in-room IoT AC activation, and housekeeping notification.
* Guest Checkout must immediately trip room status to Dirty and notify the housekeeping dispatch queue.

Publishing directly to an external message broker inside an active database transaction introduces the classic **Dual-Write Problem**: if the database commits but the broker is down, the event is lost; if the broker succeeds but the database rolls back, ghost events are dispatched.

Furthermore, we must resolve the messaging technology selection between **Redis** and **RabbitMQ**:
* **Redis Streams/PubSub**: Highly performant for in-memory cache and ephemeral socket pub/sub, but lacks native AMQP topic routing, native dead-letter exchanges (DLX), message redelivery policies with exponential backoff, and can suffer data eviction or loss under extreme memory saturation.
* **RabbitMQ**: A mature, purpose-built AMQP 0-9-1 message broker providing durable persistent queues, topic exchanges for fine-grained departmental routing, native dead-letter exchanges (DLX) for failed consumers, guaranteed delivery, consumer acknowledgments, and an accessible management UI (port 15672) for local development and monitoring.

## Decision
1. We implement the **Transactional Outbox Pattern** in PostgreSQL (`audit_schema.outbox_events`) to eliminate the dual-write problem. State changes and outbox records commit in the same atomic transaction.
2. We select **RabbitMQ** as the sole, authoritative Event Broker for all asynchronous cross-domain and integration events.
3. We designate **Redis** exclusively for:
   * Distributed caching (e.g., room availability cache, user session tokens).
   * Idempotency key tracking with TTL locks.
   * Ephemeral WebSocket / SSE channel fan-out to frontend clients.
4. An Outbox Publisher Worker tails `audit_schema.outbox_events` and dispatches messages to RabbitMQ topic exchanges (`hms.events.topic`). Dead-letter queues (`hms.dlx`) capture unprocessable events for administrative replay.

## Consequences
### Positive:
* Absolute separation of concerns: Redis handles ephemeral high-speed cache/sockets; RabbitMQ handles durable, reliable event delivery.
* Native Dead Letter Exchanges (DLX) prevent poisoned message loops.
* Topic-based routing allows granular subscriptions (e.g., `events.frontoffice.checkin`, `events.operations.room.*`).
* Seamless local development with standard RabbitMQ Docker image including management UI.

### Negative / Tradeoffs:
* Requires running and maintaining RabbitMQ alongside Redis and PostgreSQL.
* Outbox polling/tailing introduces a minor 10-50ms propagation delay.
