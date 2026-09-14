# RosterMe

Volunteer scheduling app: groups create events with time slots, share invite links, and volunteers self-sign up through a public page with no account required.

**Live:** [https://rosterme.app](https://rosterme.app)

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | .NET 10, ASP.NET Core Minimal APIs (no controllers), EF Core, Npgsql |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, TanStack Query |
| Auth | Clerk (JWT bearer), `azp` allowlist validation, `SuperAdmin` role policy |
| Email | Resend via transactional outbox; calendar invite (.ics) attachments |
| Database | PostgreSQL 17 |
| Infra | Docker Compose, nginx, Cloudflare Tunnel (no published host ports) |
| Tests | xUnit, `WebApplicationFactory`, Testcontainers (`postgres:17-alpine`) |

## Architecture

The API is split into three route groups, all mapped in `Program.cs`:

- **`/api`**: admin endpoints (groups, events, time slots, signups, invite links). Requires a valid Clerk JWT; every operation verifies ownership through the entity chain via `ClerkUserId`. `ValidateDtoFilter` runs on all requests.
- **`/api/invite`** and **`/api/signup/manage`**: public, no auth. Invite page fetch, signup create/resend, and token-based signup view/confirm/cancel. Signup create/resend are rate limited.
- **`/api/superadmin`**: metrics, activity, outbox inspection/cleanup. Gated by the `SuperAdmin` role claim.

The frontend talks to these through `createAdminApi(getToken)` and `createPublicApi()` in `client/src/lib/`, with shared error parsing via `ApiError`.

### Data model

```
Group ── Event ── TimeSlot ── Signup ── SignupAnswer
           │           │
           │           └── (capacity, allow waitlist)
           └── SignupQuestion (custom form questions)
InviteLink (per-event shareable codes, revocable)
EmailMessage (outbox rows processed by the email background service)
```

## Key design decisions

- **Auth & ownership.** Clerk JWTs are validated with `MapInboundClaims = false` (keeps `sub` as the user id) and an `azp` claim check against an explicit allowlist of origins. Admin endpoints resolve ownership as `Group → Event → TimeSlot` and reject anything not owned by the calling user.
- **Low-friction signup.** Volunteers sign up with just name + email. Each signup gets a random management token stored **SHA256-hashed**; the raw token only ever appears in emailed links. Confirm and cancel are `POST` (not `GET`) so email crawlers/prefetchers can't accidentally confirm a signup.
- **Capacity correctness.** Capacity checks run inside a transaction with `SELECT ... FOR UPDATE` on the time slot, serialized by a transaction-scoped Postgres advisory lock (`SlotAdvisoryLock`) so signup, cancel, removal, and waitlist promotion can't race.
- **Email outbox.** Signup creation and the corresponding `EmailMessage` row are persisted in the same transaction. `EmailBackgroundService` drains the outbox via Resend (batch, retried on failure); `ReminderBackgroundService` enqueues shift reminders ~24h ahead and rotates the management token. Confirmation/reminder emails include a generated `.ics` attachment.
- **Validation & errors.** DTOs are validated recursively with `ValidateDtoFilter` (DataAnnotations), not hand-rolled. Errors are returned as RFC 9457 `ProblemDetails` with an optional `code` (e.g. `duplicate_pending`) the client can branch on. `DbConflictDetector` maps Postgres codes: `23505` (unique violation) → 409, `23503` (FK violation) → 400.
- **Rate limiting.** Fixed-window limiter (`10/min`) on public signup create/resend. Disabled in tests via `Testing:DisableRateLimiting`.
- **API docs.** OpenAPI + Scalar are wired but **dev-only** (`app.Environment.IsDevelopment()`); they are not exposed in production. Frontend types are generated from the spec with `openapi-typescript`.

## Project layout

```
RosterMeApi/          .NET API project
  Endpoints/          AdminEndpoints, PublicEndpoints, SuperAdminEndpoints
  Entities/           EF Core entities
  Services/           outbox, reminders, waitlist, email templates, advisory lock, token service
  Validation/         ValidateDtoFilter, DbConflictDetector
  Data/               AppDbContext
RosterMeApi.Tests/    integration tests (Testcontainers) + unit tests
client/               React frontend
  src/lib/            API client, generated OpenAPI types
  src/components/ui/  shadcn components
docs/                 LOCAL_DEVELOPMENT.md
compose.yaml          prod stack (db, backend, frontend+nginx, cloudflared)
```

## Local development

See `docs/LOCAL_DEVELOPMENT.md` for the full walkthrough. Quick start:

```bash
# 1. Database only (Postgres published on 127.0.0.1:5432 via the dev overlay)
docker compose -f compose.yaml -f compose.dev.yaml up -d db

# 2. Backend (http://localhost:5000)
dotnet run --project RosterMeApi

# 3. Frontend (http://localhost:5173, proxies /api to :5000)
npm run dev --prefix client
```

**Environment:** root `.env` holds backend secrets (Resend key, email config, Clerk issuer/parties, CORS origins); `client/.env` holds `VITE_CLERK_PUBLISHABLE_KEY`. Copy `.env.example` templates.

**Frontend scripts** (`client/`): `npm run build` (type-check + build), `npm run lint`, `npm run format`, `npm run typecheck`, `npm run generate:types` (regenerates `src/lib/generated/schema.ts` from the running backend's OpenAPI spec).

**Backend:** `dotnet ef migrations add <name>` / `dotnet ef database update`; migrations are auto-applied at startup via `MigrateAsync()`.

## Testing

```bash
dotnet test
```

Integration tests spin up a real PostgreSQL via Testcontainers and exercise public and admin endpoints through `WebApplicationFactory<Program>`. Requires Docker.

## Deployment

`docker compose up -d` builds and runs the full stack (db → backend → frontend+nginx → cloudflared). Postgres and the API expose **no host ports**; the Cloudflare Tunnel is the only entrypoint. Migrations apply automatically on backend startup.