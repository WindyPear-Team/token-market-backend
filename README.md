# flai

flai is an AI API gateway with an admin dashboard. It provides OpenAI-compatible proxy routes, upstream channel management, OIDC dashboard login, API key authentication, user balances, token usage logging, and basic billing.

## Project Layout

- `main.go` and `cmd/flai/main.go`: backend entry points.
- `internal/app`: Gin app setup, routes, static frontend serving.
- `internal/api`: admin and user API handlers.
- `internal/config`: environment loading.
- `internal/middleware`: JWT/API key authentication and admin checks.
- `internal/model`: GORM models and database initialization.
- `internal/service`: OIDC auth, proxy forwarding, billing helpers, price sync.
- `web`: Vite + React admin dashboard.
- `flai.db`: local SQLite database.
- `todo.md`: production-readiness roadmap.

## Requirements

- Go matching `go.mod`.
- Node.js and Yarn for the frontend.
- SQLite is used by default through GORM.

## Configuration

Create `.env` from `.env.example` and adjust values for your environment.

```env
APP_ENV=development
PORT=8080
DB_PATH=flai.db
JWT_SECRET=your-secure-jwt-secret-here
OIDC_ISSUER=https://your-oidc-provider.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URL=http://localhost:8080/auth/callback
BOOTSTRAP_ADMIN_OIDC_SUBS=
BOOTSTRAP_ADMIN_EMAILS=
```

Notes:

- `JWT_SECRET` must be changed outside `development`, `dev`, `local`, or `test`.
- Dashboard login requires OIDC configuration.
- Passkey login is disabled by default. An admin must enable it in System Management, then users can bind passkeys from Settings. In production, configure `base_url` so WebAuthn RP ID and origin checks are stable.
- OIDC callback redirects to the same-origin SPA by default. During Vite development, the backend can return to the dev server when login starts from that origin.
- API proxy authentication uses `Authorization: Bearer <api-key>`.
- API keys are stored as hashes. A raw key is returned only by the rotate endpoint.
- Admin APIs require a logged-in user with `is_admin=true`.
- Set `BOOTSTRAP_ADMIN_OIDC_SUBS` or `BOOTSTRAP_ADMIN_EMAILS` to a comma-separated allowlist for first-admin bootstrap.

## Backend Development

Run the backend:

```powershell
go run .
```

Run backend checks:

```powershell
go test ./...
```

The backend listens on `PORT` and serves the frontend production build from `web/dist`.

## Frontend Development

Install frontend dependencies:

```powershell
cd web
yarn install
```

Run the Vite dev server:

```powershell
yarn dev
```

Build the frontend:

```powershell
yarn build
```

If PowerShell blocks `yarn.ps1`, use the `.cmd` shim instead:

```powershell
yarn.cmd build
```

The Vite dev server proxies `/api`, `/v1`, and `/auth` to the backend target configured in `web/vite.config.ts`.

## Main Routes

- `GET /health`: backend health check.
- `GET /auth/login`: start OIDC login.
- `GET /auth/callback`: OIDC callback.
- `POST /auth/passkey/login/options`: start passkey login.
- `POST /auth/passkey/login`: complete passkey login.
- `POST /v1/chat/completions`: OpenAI-compatible chat completions proxy.
- `POST /v1/completions`: OpenAI-compatible completions proxy.
- `POST /v1/images/generations`: OpenAI-compatible image generation proxy.
- `GET /api/user/me`: current user profile.
- `GET /api/user/passkeys`: current user's passkeys.
- `POST /api/user/passkeys/register/options`: start passkey binding.
- `POST /api/user/passkeys/register`: complete passkey binding.
- `DELETE /api/user/passkeys/:id`: delete a passkey.
- `POST /api/user/api-key/rotate`: rotate the current user's API key and return the new raw key once.
- `GET /api/channels`: admin channel list.
- `GET /api/users`: admin user list.
- `GET /api/logs`: admin usage logs.
- `GET /api/stats`: admin dashboard stats.

Image generation uses the same model, channel, API key, balance, and usage-log flow as text requests. If the upstream response does not include `usage`, flai estimates billing as prompt tokens plus `1,000,000` output units per generated image, so the model output price can be configured as the intended per-image cost.
The dashboard also includes `/dashboard/images`, controlled by the `sidebar_images_enabled` system setting, for users to generate images through the same proxy endpoint.

## Production Readiness

Track production work in `todo.md`. The current priorities are key security, streaming proxy support, rate limits, billing correctness, admin bootstrap, and deployment automation.
