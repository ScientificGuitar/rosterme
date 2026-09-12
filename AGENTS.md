# RosterMe

Roster signup app: orgs create events with time slots, share invite links, volunteers self-signup via public page.

## Stack

- **Backend**: .NET 10 / ASP.NET Core Minimal APIs (no controllers) / EF Core / PostgreSQL
- **Frontend**: React 19 / TypeScript / Vite / Tailwind CSS v4 / shadcn/ui / TanStack Query / Clerk (JWT)
- **Tests**: xUnit + WebApplicationFactory + Testcontainers (needs Docker for `postgres:17-alpine`)
- **Infra**: Docker Compose (PostgreSQL, API, frontend + nginx)

## Project layout

- `RosterMeApi/` — .NET API project
- `RosterMeApi.Tests/` — integration tests (Testcontainers) + unit tests
- `client/` — React frontend (`src/components/ui/` for shadcn)

## Patterns (must follow)

- **Auth**: every admin endpoint must verify ownership through entity chain via `ClerkUserId`; validate `azp` claim against allowlist. Public (no auth): fetch invite page, create/resend/get/cancel signup.
- **Validation/errors**: use `ValidateDtoFilter` (recursive DataAnnotations) — don't hand-roll. Errors → RFC 9457 ProblemDetails with optional `code` (e.g. `duplicate_pending`) for client branching. `DbConflictDetector`: 23505→409, 23503→400.
- **Signup invariants**: capacity check with `SELECT ... FOR UPDATE`; unique `(Email, TimeSlotId)` excl. cancelled, case-insensitive email; management tokens stored SHA256-hashed (raw token only in email link); signup + `EmailMessage` outbox row in same transaction (`EmailBackgroundService` sends via Resend).
- **Frontend API**: use `createAdminApi(getToken)` / `createPublicApi()`, shared error parsing via `ApiError`.

## Git convention

- Use [gitmoji](https://gitmoji.dev) for commit types (e.g. `:sparkles:` for features, `:bug:` for fixes, `:recycle:` for refactors)

## Dev commands

**Frontend** (`client/`):
- `npm run dev` — Vite dev server (port 5173, proxies `/api` to `http://localhost:5000`)
- `npm run build` — Type-check then build
- `npm run lint` — ESLint
- `npm run format` — Prettier write
- `npm run typecheck` — `tsc --noEmit`
- Generate API types from OpenAPI spec (backend must be running): `npm run generate:types`
- Add shadcn component: `npx shadcn@latest add <component>`

**Backend** (`RosterMeApi/`):
- `dotnet restore` / `dotnet build` / `dotnet run`
- Migrations: `dotnet ef migrations add <name>`, `dotnet ef database update` (auto-applied at startup via `MigrateAsync()`)
- Scalar API docs: `http://localhost:5000/scalar/v1` (when running)
- Raw OpenAPI spec: `http://localhost:5000/openapi/v1.json`

**Docker Compose** (root):
- `docker compose up --build` — builds images, starts db, backend, frontend
- Backend binds to port 8080, frontend to port 80

## Quirks

- **Tailwind v4**: Uses `@tailwindcss/vite` plugin — no `tailwind.config.js`
- **Vite proxy only** in dev (`/api` -> `localhost:5000`); dev server runs on 5173
- **Docker vs local DB**: `appsettings.Development.json` has `localhost:5432`; `compose.yaml` overrides to `Host=db` — do not commit docker-specific connection strings to `appsettings.Development.json`
- **Secrets via .env**: Resend API key and email config live in `.env` (loaded by `DotNetEnv`). Never commit `.env`; use `.env.example` as template.
