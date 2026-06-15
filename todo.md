# flai API Platform TODO

This file tracks the work needed to turn the current gateway prototype into a mature API platform.

## P0 - Stabilize The Current Product

- [x] Verify frontend source encoding/build with UTF-8-aware tooling and fix only real compiler errors.
- [x] Make `web` build pass with `yarn build`.
- [x] Make backend compile/test pass with `go test ./...`.
- [x] Add a documented local development workflow.
- [x] Add a first-admin bootstrap path.
- [x] Add first-run OOBE for the admin account and site name.
- [x] Add OIDC callback redirect back to the frontend.
- [x] Require a non-default `JWT_SECRET` outside development.
- [x] Hash API keys in storage and show raw keys only once.
- [x] Add user password changes with old-password or email-code verification.
- [x] Add `/v1/models` for OpenAI-compatible clients.
- [x] Support streaming responses for chat completions.
- [x] Add basic request size limits and timeouts.

## P1 - Core API Platform Features

- [x] Add API key management: create, name, disable, rotate, delete.
- [ ] Add API key expiration.
- [x] Add per-key model and IP/CIDR restrictions.
- [x] Add user self-service pages for API keys, balance, and usage.
- [x] Complete channel CRUD in the dashboard.
- [x] Add model and price management in the dashboard.
- [x] Add cached-input pricing for model prices, upstream sync, and billing.
- [x] Add tiered model pricing for input, output, and cached-input tokens.
- [x] Add protocol conversion for completion, responses, Claude, and Gemini upstream channel types.
- [x] Split global models from upstream-channel model configs.
- [x] Add a public model catalog with provider branding and user-channel pricing visibility.
- [x] Add a manually enabled `/api/pricing` endpoint compatible with NewAPI pricing format.
- [x] Add manually enabled public status monitoring with admin-managed nodes.
- [x] Add grouped system settings for branding, OIDC, content pages, announcements, and navigation modules.
- [x] Add group management in the dashboard.
- [x] Add redeem-code grants for balance and user group membership.
- [x] Add referral codes and configurable referral commission.
- [x] Add group multiplier overrides at upstream-channel and model level.
- [x] Require each API key to bind to exactly one user channel.
- [ ] Add balance ledger records for recharge, deduction, adjustment, and refund.
- [ ] Add per-user, per-key, per-IP, and per-model rate limits.
- [ ] Add daily and monthly budget limits.
- [ ] Add upstream health checks.
- [ ] Add channel failover and retry policy.
- [ ] Add channel selection rules by model, priority, weight, and user group.
- [ ] Normalize upstream error responses.
- [ ] Add audit logs for admin operations.

## P2 - Billing, Observability, And Operations

- [ ] Add price versioning for historical billing accuracy.
- [ ] Add pre-charge or balance reservation before forwarding paid requests.
- [ ] Add monthly invoices or usage exports.
- [ ] Add structured logs with request IDs.
- [ ] Add Prometheus metrics for latency, errors, tokens, and cost.
- [ ] Add alerts for upstream failures, high error rate, and abnormal spend.
- [ ] Move production storage from SQLite to PostgreSQL or MySQL.
- [ ] Add database migration tooling.
- [ ] Add Dockerfile and docker-compose.
- [ ] Add CI checks for Go tests, frontend build, and lint.
- [ ] Add deployment documentation.

## Notes

- Keep changes small and verifiable.
- Prefer compatibility with OpenAI-style clients unless a feature is explicitly admin-only.
- Avoid logging secrets, API keys, raw authorization headers, or sensitive request bodies.
- Treat billing correctness and key security as production blockers.
- User-facing channels now own channel multipliers; upstream channels own provider routing and model availability.
- Model configuration supports manual price edits/additions and syncing model lists/prices from one or more upstream channels.
