# RosterMe — Frontend

React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui.

## Quick start

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. The dev server proxies `/api` to `http://localhost:5000`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check then build for production |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run generate:types` | Regenerate types from OpenAPI spec (backend must be running) |

## Stack

- **Build**: Vite 7
- **UI**: React 19, shadcn/ui (Radix primitives), Tailwind CSS v4
- **State**: TanStack Query
- **Auth**: Clerk (via `VITE_CLERK_PUBLISHABLE_KEY` env var)
- **Generated types**: `openapi-typescript` → `src/lib/generated/schema.ts`

## Env vars

Copy `.env.example` to `.env` and fill in the values:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_ISSUER=https://<instance>.clerk.accounts.dev/
CLERK_AUTHORIZED_PARTIES=http://localhost:5173,...
```

## Project layout

```
src/
├── components/   # React components (ui/ for shadcn)
├── hooks/        # Custom hooks
├── lib/          # API client, types, utilities
└── routes/       # Route components
```

For full project documentation, see `AGENTS.md` in the repository root.