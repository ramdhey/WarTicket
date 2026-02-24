# WarTicket-BE — Event Booking Platform Backend

A high-concurrency event booking backend for concerts, workshops, and pentas seni (school/university cultural events).

## Tech Choices

| Technology                          | Why                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| **Express 5** (TypeScript)          | Latest version with async error handling, read-only `req.query` for better security        |
| **PostgreSQL 15** (via Prisma 7)    | ACID transactions essential for booking concurrency; `SELECT FOR UPDATE` row-level locking |
| **Prisma 7** + `@prisma/adapter-pg` | Latest ORM with driver adapter architecture (no native binaries)                           |
| **BullMQ** (Redis)                  | Reliable job queue for booking serialization; prevents race conditions at scale            |
| **Zod 4**                           | Runtime request validation with TypeScript type inference                                  |
| **bcrypt**                          | Industry standard password hashing                                                         |
| **JWT**                             | Stateless authentication; role embedded in token                                           |

**Alternatives considered:**

- **Drizzle ORM** — Faster but less mature ecosystem; Prisma's migration system is more battle-tested
- **Socket.IO** for real-time — Opted for SSE (lighter weight, built-in HTTP, no extra dependency)
- **NestJS** — More structure but heavier; Express 5 is sufficient for this scope

---

## Architecture

```
Client → Express API → Zod Validation → Controllers → Services → Repositories → Prisma → PostgreSQL
                                              ↓
                                         BullMQ Queue → Workers (concurrency=1) → SELECT FOR UPDATE
                                              ↓
                                    Promotion Worker → Auto-promote waitlist → In-app notification
```

**Service-Repository Pattern:**

- `repository` — Database access layer (Prisma queries)
- `service` — Business logic, transaction orchestration
- `controller` — HTTP request/response handling
- `worker` — Background job processing

---

## Trade-offs

| What I Deprioritized   | Why                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Desktop responsive UI  | Brief says mobile-only (390px), desktop explicitly out of scope                                                                                                    |
| Email notifications    | Brief says in-app only                                                                                                                                             |
| Full smart sort in SQL | Used JS-level weighted sort (preference → date → capacity) — works well for < 10K events. At production scale, would use PostgreSQL `ts_rank` + materialized views |
| Optimistic locking     | Chose pessimistic locking (`SELECT FOR UPDATE`) — more reliable for "war ticket" scenarios where conflicts are frequent                                            |

**What would break at production load:**

- Smart sorting fetches all events then sorts in JS — would need PostgreSQL window functions
- SSE connections have no heartbeat/reconnection strategy
- Single Redis instance — would need Redis Cluster
- No rate limiting on booking endpoint

---

## Features Implemented

### Layer 1 — Core ✅

- [x] Auth (register, login, JWT, bcrypt)
- [x] Event CRUD (create, edit, delete with ownership)
- [x] Browse/Search with text search + pagination
- [x] Book a Spot (1–5 per transaction)
- [x] User Bookings (upcoming, past, cancelled)

### Layer 2 — Mid-Tier ✅

- [x] Time Slot Management (multi-slot events)
- [x] Full + Partial Cancellation
- [x] Waitlist with FIFO auto-promotion
- [x] Conflict Detection (overlapping time slots)
- [x] In-app Notifications (on waitlist promotion)

### Layer 3 — Advanced ✅

- [x] Concurrent Booking Protection (`SELECT FOR UPDATE` + BullMQ serialization)
- [x] Undo Cancellation (5-minute window)
- [x] Timezone Handling (UTC storage, user timezone field)
- [x] Smart Event Sorting (preference → date → capacity)
- [x] Role-Based Access Control (ADMIN / USER)

---

## API Endpoints

| Method | Endpoint                      | Auth | Description                                              |
| ------ | ----------------------------- | ---- | -------------------------------------------------------- |
| POST   | `/api/auth/register`          | —    | Register (email, password, timezone, preferences)        |
| POST   | `/api/auth/login`             | —    | Login → JWT token                                        |
| GET    | `/api/auth/profile`           | ✅   | User profile                                             |
| GET    | `/api/events`                 | —    | Browse events (search, category, pagination, sort=smart) |
| GET    | `/api/events/:id`             | —    | Event detail with slot availability                      |
| POST   | `/api/events`                 | ✅   | Create event (admin/user)                                |
| PUT    | `/api/events/:id`             | ✅   | Update event (creator/admin only)                        |
| DELETE | `/api/events/:id`             | ✅   | Delete event (creator/admin only)                        |
| POST   | `/api/bookings`               | ✅   | Book 1–5 spots                                           |
| GET    | `/api/bookings/me`            | ✅   | My bookings (upcoming/past/cancelled)                    |
| DELETE | `/api/bookings/:id`           | ✅   | Full cancel → triggers waitlist promotion                |
| PATCH  | `/api/bookings/:id/reduce`    | ✅   | Partial cancel (reduce quantity)                         |
| POST   | `/api/bookings/:id/undo`      | ✅   | Undo cancel (5-min window)                               |
| POST   | `/api/waitlists`              | ✅   | Join waitlist                                            |
| GET    | `/api/waitlists/me`           | ✅   | My waitlist entries                                      |
| GET    | `/api/notifications/me`       | ✅   | My notifications                                         |
| PATCH  | `/api/notifications/:id/read` | ✅   | Mark notification read                                   |
| PATCH  | `/api/notifications/read-all` | ✅   | Mark all read                                            |

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL + Redis)

### Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd WarTicket-BE
npm install

# 2. Start database + redis
docker compose up -d

# 3. Create .env (already included)
# DATABASE_URL=postgresql://rama_dev:secretpassword@localhost:5432/booking_db
# REDIS_URL=redis://localhost:6379
# JWT_SECRET=warticket-dev-secret-key-2024
# PORT=3000

# 4. Run migrations
npx prisma migrate dev

# 5. Seed database (100+ events, 300 users, 5 scenarios)
npx prisma db seed

# 6. Start dev server
npm run dev
```

---

## Key Scenario User Credentials

All passwords: `password123`

| Scenario      | Email                     | Role                                                  |
| ------------- | ------------------------- | ----------------------------------------------------- |
| Admin         | `andi.pratama@mail.com`   | ADMIN — can CRUD any event                            |
| S2: Busy User | `bayu.kusuma@mail.com`    | USER — has past + upcoming bookings + waitlist        |
| S4: Cancelled | `hana.nugraha@mail.com`   | USER — cancelled booking                              |
| S4: Promoted  | `fitri.purnomo@mail.com`  | USER — auto-promoted from waitlist (has notification) |
| S4: Waiting   | `citra.wijaya@mail.com`   | USER — still on waitlist                              |
| S5: Conflict  | `oscar.setiawan@mail.com` | USER — booked 2 overlapping events                    |

---

## What I'd Improve

1. **WebSocket for real-time** — Replace SSE with Socket.IO for bi-directional updates (slot availability, booking confirmations)
2. **PostgreSQL full-text search** — Currently using `ILIKE` contains; would add `tsvector` index for better search
3. **Rate limiting** — Add `express-rate-limit` on booking endpoints to prevent abuse
4. **Event image uploads** — Add S3/Cloudinary integration for event images
5. **Admin dashboard** — API-level RBAC is done; would build admin panel for event/booking management
6. **Optimistic concurrency** — Add `version` column as alternative locking strategy for lower-contention scenarios
7. **Test suite** — Add Jest integration tests for booking concurrency edge cases
