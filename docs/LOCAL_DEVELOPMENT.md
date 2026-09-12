# Local Development

Run the database in Docker, backend and frontend on the host.

## Prerequisites

- .NET 10 SDK, Node 22, Docker
- Root `.env` populated (see `.env` values used by `compose.yaml`)

## Start

```bash
# 1. Database only (published to 127.0.0.1:5432 via the dev overlay)
docker compose -f compose.yaml -f compose.dev.yaml up -d db

# 2. Backend (http://localhost:5000)
dotnet run --project RosterMeApi

# 3. Frontend (http://localhost:5173, proxies /api to :5000)
npm run dev --prefix client
```

## Prod vs local compose files

- Prod: `docker compose up -d` — publishes **no** host ports (Cloudflare Tunnel is the
  only entrypoint, `www` → `frontend:80`).
- Local: add `-f compose.dev.yaml` to expose Postgres on loopback. Never use the dev
  overlay in prod — host port clashes are exactly what it would reintroduce.

## Troubleshooting

- Backend can't reach DB → is the `db` container up with the dev overlay (`-f` flags)?
