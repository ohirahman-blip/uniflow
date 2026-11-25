# UniFlow MCP preparation

This commit prepares an opt-in interface. It is **disabled by default** and does not change sign-in, existing workspace permissions, or workspace saving. No migration is applied automatically.

## Included

- `POST /api/mcp`: stateless JSON responses over Streamable HTTP. Explicit compatibility baseline: MCP `2025-11-25`, with `2025-06-18` and `2025-03-26` supported. No SSE stream/session is allocated; GET/DELETE on this endpoint return 405.
- `GET/POST/DELETE /api/mcp-access`: connection management using the account's verified Supabase session. The owner is always resolved server-side, never taken from request arguments.
- Separate random 256-bit MCP access keys, stored only as SHA-256 hashes. Raw keys are shown once. Keys expire within 1–90 days and can be revoked immediately. Workspace session JWTs and service-role credentials are not MCP access keys.
- Separate `workspace:read` and `workspace:propose` scopes. Every call checks the grant and owner. Database-backed limit: 60 MCP requests per connection per minute.
- Module and semester lists; stored event definitions, exams, homework and tasks; input validation for **unsaved** entry drafts. Lists are paginated, 100 items maximum per page. Read results omit cover images, grades, private notes and integration secrets.
- Request limits and an explicit browser-origin allowlist. No wildcard CORS.

## Deliberate limits

`uniflow_prepare_entry` returns `saved: false` and `requiresConfirmation: true`. It does not enqueue, persist, create, update or delete an actual entry. Its result must never be described to users as a saved entry. The write/import and confirmation flow will be a separate change.

This first foundation uses manually issued access keys for clients that support custom Bearer headers. It does **not** implement OAuth discovery, authorization, refresh, PKCE or client registration. It is therefore not a ready-made universal ChatGPT/Claude connector. General remote-client compatibility and the current MCP protocol revision need to be addressed before a public rollout. Do not advertise this as OAuth compliant.

Event listing returns the stored series definitions rather than expanded dated occurrences; it is not an authoritative collision/availability API. It omits detailed exceptions and notes. An AI must not infer a free time slot from this list. Dates are local study-calendar dates; no automatic timezone conversion is performed.

## Later activation

1. Apply `supabase/migrations/20261125_uniflow_mcp_preparation.sql` in the intended Supabase project.
2. Keep the existing server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never put the latter in a `VITE_` variable or a chatbot configuration.
3. Set `UNIFLOW_MCP_ALLOWED_ORIGINS` to the exact trusted web origins, comma separated. Desktop server-to-server requests without an Origin header still require an access key.
4. Only when ready, set `UNIFLOW_MCP_ENABLED=true`. Leaving it unset or false makes both endpoints return 404. Disabling it immediately stops both endpoints without touching the app login.
5. Add the first-party connection-management screen. It should list metadata, allow creating scoped connections, show the returned key once, and allow revocation. The HTTP API is prepared; no new settings screen has been exposed yet.
6. Connect a compatible development client with the generated MCP key and `/api/mcp`. Include `Authorization: Bearer <MCP_ACCESS_KEY>`, JSON content type and `Accept: application/json, text/event-stream`. Use the negotiated `MCP-Protocol-Version` on later calls.

Example creation body for `POST /api/mcp-access`, authenticated with the user's existing Supabase session:

```json
{"label":"My chatbot","scopes":["workspace:read","workspace:propose"],"expiresInDays":30}
```

Revocation body for `DELETE /api/mcp-access`: `{"id":"<connection UUID>"}`. GET returns connection metadata, never token hashes or raw keys.

## Before enabling actual writes

- Implement OAuth 2.1 consent and audience-bound tokens for clients that cannot use manual keys, using the existing account identity. Do not pass through Supabase login tokens to MCP tools.
- Use typed, narrow entry commands, never a generic workspace JSON replacement. Validate module/semester ownership, recurrence, dates and end times server-side.
- Introduce idempotency and optimistic concurrency/transactional commands. The current app saves a complete JSON workspace; direct concurrent MCP writes would risk overwriting newer browser changes.
- Show a concrete draft and collect confirmation. Define how an accepted change reaches an open app session and its autosave state.
- Add an audit trail and durable limits for mutations. Never store tokens or private note content in request logs.
- Perform protocol, authorization, revoked/expired key, cross-account, validation, replay, concurrency and deployment checks before activating. None were executed as part of this requested no-test change.

Specification references: [Streamable HTTP baseline](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).
