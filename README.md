# GoTicket — Event Booking Platform

> A battle-tested Event Booking Platform engineered for high-concurrency "War Ticket" scenarios where thousands of users compete for limited seats simultaneously.

## Project Overview

GoTicket is a full-stack event booking platform built with a **Service-Repository architecture**. The backend is specifically designed to handle the extreme concurrency pressure of ticket wars — ensuring data integrity, fair ordering, and zero overselling even under thousands of simultaneous requests. The frontend delivers a polished, mobile-first booking experience with real-time QR ticketing.

The system features real-time waitlist promotion through background job processing, row-level database locking for atomic seat allocation, comprehensive conflict detection to prevent double bookings, and client-side image compression for seamless uploads.

## Tech Stack

### Backend (`WarTicket-BE`)

| Layer              | Technology                            |
| ------------------ | ------------------------------------- |
| **Runtime**        | Node.js + TypeScript                  |
| **Framework**      | Express.js v5                         |
| **Database**       | PostgreSQL (via Prisma ORM v7)        |
| **Cache / Queue**  | Redis + BullMQ                        |
| **Validation**     | Zod v4                                |
| **Authentication** | JWT (Access + Refresh Token Rotation) |
| **File Uploads**   | Multer (disk storage)                 |
| **Testing**        | Jest 30 + jest-mock-extended          |

### Frontend (`GoTicket`)

| Layer                | Technology                               |
| -------------------- | ---------------------------------------- |
| **Framework**        | Next.js 16 (App Router)                  |
| **UI Library**       | React 19 + Material-UI v7                |
| **State Management** | TanStack React Query v5                  |
| **HTTP Client**      | Axios                                    |
| **Animations**       | Framer Motion                            |
| **QR Codes**         | react-qr-code + @yudiel/react-qr-scanner |
| **Date Handling**    | Day.js                                   |
| **Language**         | TypeScript 5                             |

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Client (GoTicket)                  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────┐
│                    Express.js API                        │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐             │
│  │   Auth   │  │  Events  │  │ Bookings  │  ...        │
│  │ Module   │  │  Module  │  │  Module   │             │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘             │
│       │              │              │                    │
│  ┌────▼──────────────▼──────────────▼─────┐             │
│  │          Service Layer                  │             │
│  │  (Business logic, validation, tx mgmt)  │             │
│  └────────────────┬───────────────────────┘             │
│                   │                                      │
│  ┌────────────────▼───────────────────────┐             │
│  │         Repository Layer                │             │
│  │   (Data access, Prisma queries)         │             │
│  └────────────────┬───────────────────────┘             │
└───────────────────┼─────────────────────────────────────┘
                    │
       ┌────────────▼────────────┐
       │  PostgreSQL (Prisma)    │
       │  SELECT ... FOR UPDATE  │
       │  Serializable Isolation │
       └─────────────────────────┘
                    │
       ┌────────────▼────────────┐
       │  Redis + BullMQ         │
       │  ┌───────────────────┐  │
       │  │ Booking Queue     │  │
       │  │ Promotion Queue   │  │
       │  └───────────────────┘  │
       └─────────────────────────┘
```

### Concurrency Protection (Layer 3)

The core challenge of any "war ticket" system is preventing overselling when hundreds of users click "Book" at the same millisecond. WarTicket solves this with a **two-layer defense**:

**1. Row-Level Locking with `SELECT ... FOR UPDATE`**

Every booking operation acquires an exclusive row lock on the target time slot within a Prisma transaction. This ensures only one transaction can read and modify the seat count at a time — eliminating race conditions at the database level.

```sql
SELECT id, capacity, "bookedCount"
FROM time_slots
WHERE id = $1
FOR UPDATE
```

**2. Serializable Transaction Isolation**

All booking and cancellation transactions run at `Serializable` isolation level — the strictest isolation in PostgreSQL. This guarantees that concurrent transactions behave as if they were executed sequentially, preventing phantom reads and write skew anomalies.

**3. Asynchronous Waitlist Promotion via BullMQ**

When a booking is cancelled, freed seats are not immediately reassigned. Instead, a job is dispatched to the `promotion` queue. A dedicated worker processes promotions sequentially (concurrency: 1), preventing race conditions during the waitlist-to-booking transition. Promoted users receive real-time notifications.

## Expert Layer Implementation (Layer 4.2)

### Design Decision: Comprehensive Test Coverage over Recurring Events

At the expert layer, I deliberately chose **Comprehensive Test Coverage** over the alternative of implementing Recurring Events. The reasoning:

> _In a high-concurrency system, proving data integrity through edge-case testing — such as concurrent booking, waitlist promotion under pressure, and cancellation undo windows — is far more critical than adding new features. A recurring event feature adds convenience, but a single overselling bug destroys user trust permanently. Comprehensive testing ensures the system remains stable under extreme pressure before any feature expansion._

This decision reflects a **reliability-first engineering philosophy**: in systems where money and limited inventory are involved, correctness is non-negotiable.

## Test Scenarios

The test suite validates every critical path through the booking lifecycle:

### Booking Service Tests

| Scenario                                  | What It Proves                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| **Slot not found**                        | Graceful 404 when targeting invalid time slots                                   |
| **Duplicate booking rejection**           | Users cannot double-book the same slot                                           |
| **Time conflict detection**               | Overlapping bookings across different slots are blocked                          |
| **Capacity enforcement → Waitlist**       | When seats are full, users are automatically waitlisted with correct position    |
| **Successful confirmation**               | Available seats are allocated and `bookedCount` is incremented atomically        |
| **Full cancellation + promotion trigger** | Cancelling dispatches a BullMQ job to promote waitlisted users                   |
| **Partial cancellation**                  | Reducing quantity frees exactly N seats and triggers proportional promotion      |
| **Undo cancellation (within window)**     | Cancelled bookings can be restored within 5 minutes if seats are still available |
| **Undo cancellation (expired window)**    | Restoration is rejected after the 5-minute grace period                          |

### Waitlist Service Tests

| Scenario                          | What It Proves                                                   |
| --------------------------------- | ---------------------------------------------------------------- |
| **Invalid slot**                  | Waitlist rejects non-existent time slots                         |
| **Duplicate waitlist prevention** | Users cannot join the same waitlist twice                        |
| **Already booked conflict**       | Users with confirmed bookings cannot also join the waitlist      |
| **Correct position calculation**  | New waitlist entries receive the accurate next position in queue |

```bash
# Run the full test suite
npm test

# Run with coverage
npm test -- --coverage
```

## API Endpoints

### Authentication

| Method | Endpoint             | Description                           |
| ------ | -------------------- | ------------------------------------- |
| `POST` | `/api/auth/register` | Register (multipart, supports avatar) |
| `POST` | `/api/auth/login`    | Login                                 |
| `POST` | `/api/auth/refresh`  | Rotate access + refresh tokens        |
| `POST` | `/api/auth/logout`   | Logout (invalidates refresh token)    |
| `GET`  | `/api/auth/profile`  | Get current user profile              |
| `PUT`  | `/api/auth/profile`  | Update profile (multipart, avatar)    |

### Events

| Method   | Endpoint          | Description                      |
| -------- | ----------------- | -------------------------------- |
| `GET`    | `/api/events`     | List events (public, smart sort) |
| `GET`    | `/api/events/:id` | Event detail with availability   |
| `POST`   | `/api/events`     | Create event (Admin, multipart)  |
| `PUT`    | `/api/events/:id` | Update event (Admin)             |
| `DELETE` | `/api/events/:id` | Delete event (Admin)             |

### Bookings

| Method   | Endpoint                   | Description                           |
| -------- | -------------------------- | ------------------------------------- |
| `POST`   | `/api/bookings`            | Book tickets (auto-waitlist if full)  |
| `GET`    | `/api/bookings/me`         | My bookings (upcoming/past/cancelled) |
| `GET`    | `/api/bookings/:id`        | Booking detail with ticket QR codes   |
| `DELETE` | `/api/bookings/:id`        | Cancel booking                        |
| `PATCH`  | `/api/bookings/:id/reduce` | Partial cancellation                  |
| `POST`   | `/api/bookings/:id/undo`   | Undo cancellation (5-min window)      |

### Admin Tickets

| Method | Endpoint                         | Description             |
| ------ | -------------------------------- | ----------------------- |
| `GET`  | `/api/admin/tickets/:id/verify`  | Verify ticket (QR scan) |
| `POST` | `/api/admin/tickets/:id/checkin` | Check-in ticket         |

### Waitlist & Notifications

| Method  | Endpoint                      | Description         |
| ------- | ----------------------------- | ------------------- |
| `POST`  | `/api/waitlists`              | Join waitlist       |
| `GET`   | `/api/waitlists/me`           | My waitlist entries |
| `GET`   | `/api/notifications/me`       | My notifications    |
| `PATCH` | `/api/notifications/:id/read` | Mark as read        |
| `PATCH` | `/api/notifications/read-all` | Mark all as read    |

## Project Structure

```
src/
├── app.ts                    # Express app configuration
├── server.ts                 # Server entry point
├── middlewares/
│   ├── auth.ts               # JWT authentication
│   ├── rbac.ts               # Role-based access control
│   ├── upload.ts             # Multer file upload + URL generation
│   ├── validate.ts           # Zod schema validation
│   └── errorHandler.ts       # Centralized error handling
├── lib/
│   ├── prisma.ts             # Prisma client singleton
│   ├── redis.ts              # Redis connection
│   └── queue.ts              # BullMQ queue definitions
├── workers/
│   ├── booking.worker.ts     # Background booking processor
│   └── promotion.worker.ts   # Waitlist → Booking promoter
└── modules/
    ├── auth/                 # Register, Login, Profile, JWT rotation
    ├── event/                # CRUD, smart sort, category filtering
    ├── booking/              # Book, Cancel, Partial cancel, Undo
    ├── ticket/               # QR verify, Check-in (Admin)
    ├── waitlist/             # Join, Position tracking
    └── notification/         # Real-time user notifications
```

## Setup Instructions

### 1. Start Infrastructure

```bash
docker-compose up -d
```

This starts PostgreSQL and Redis containers.

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values (see Environment Variables below).

### 3. Install Dependencies

```bash
npm install
```

### 4. Initialize Database

```bash
npx prisma db push
npx prisma generate
```

### 5. Run Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:<PORT>/api/health`.

### 6. Run Tests

```bash
npm test
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://rama_dev:secretpassword@localhost:5432/booking_db

# Redis (for BullMQ queues)
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key-change-in-production

# Server
PORT=8005

# File uploads — set to your public-facing URL for correct image/avatar URLs
PUBLIC_URL=http://local/
```

| Variable       | Description                          | Default                    |
| -------------- | ------------------------------------ | -------------------------- |
| `DATABASE_URL` | PostgreSQL connection string         | —                          |
| `REDIS_URL`    | Redis connection string              | `redis://localhost:6379`   |
| `JWT_SECRET`   | Secret for signing JWTs              | —                          |
| `PORT`         | Server port                          | `3000`                     |
| `PUBLIC_URL`   | Public base URL for file upload URLs | Auto-detected from request |

---

## Frontend — GoTicket

The companion frontend is a **Next.js 16** application with React 19 and Material-UI v7, providing a modern and responsive interface for event discovery, booking, and ticket management.

### Frontend Routes

| Route                  | Description                                  |
| ---------------------- | -------------------------------------------- |
| `/`                    | Landing page — featured events, hero section |
| `/events`              | Browse all events with category filtering    |
| `/events/:id`          | Event detail with time slots and booking     |
| `/bookings`            | My bookings (upcoming, past, cancelled)      |
| `/bookings/:id`        | Booking detail with per-ticket QR codes      |
| `/profile`             | User profile with avatar management          |
| `/notifications`       | Real-time waitlist promotions and alerts     |
| `/login`               | Authentication                               |
| `/register`            | Registration with avatar upload              |
| `/admin/events/create` | Create event (Admin)                         |
| `/admin/scan`          | QR ticket scanning (Admin)                   |

### Frontend Features

- **Client-Side Image Compression** — Uploads are automatically compressed using the Canvas API before transmission, maintaining quality while respecting server-side file limits
- **Per-Ticket QR Codes** — Multi-quantity bookings generate individual QR codes for each ticket (e.g., a booking of 3 shows 3 scannable QR codes)
- **Animated UI** — Staggered card animations, smooth transitions via Framer Motion
- **Auth Context** — JWT-aware context with automatic token refresh and role-based UI rendering
- **Responsive Design** — Mobile-first layout optimized for on-the-go ticket purchasing

### Frontend Setup

```bash
cd GoTicket
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8005/api
```

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## License

MIT
