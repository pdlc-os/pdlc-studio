# P14 — Authentication

| Field | Value |
| --- | --- |
| **Priority** | **P14** of 30 |
| **Score** | **13.3** |
| **Inputs** | Value 5 · Reach 4 · GapWeight ×2.0 · Effort 3 |
| **Category** | Access, Identity & Security |
| **Matrix features** | `SEC-01` (password authentication), `SEC-02` (token/session auth for API) |
| **Maturity** | PDLC Studio **0** → target **4** · claudecodeui **4** |
| **Effort** | **3** |
| **Depends on** | P01 should ship first (defence in depth, not a technical dependency) |
| **Blocks** | `GIT-09` (push/pull), `SEC-05` (API keys), safe remote/mobile use |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio has **no authentication of any kind**. No login, no session, no token, no API
key. A search of `backend/` and `frontend/src/` for `jwt`, `bcrypt`, `passport`, `login`,
`signup`, `authenticate`, and `authorization` returns **zero files**.

Every endpoint is open to anyone who can reach the port:

| Endpoint | What an unauthenticated caller gets |
| --- | --- |
| `POST /api/chat` | Run Claude against any directory — **including shell commands** |
| `GET /api/directories` | Browse the filesystem, **deliberately unconfined** |
| `GET /api/projects` | Every project path on the machine |
| `GET /api/projects/:p/histories/:s` | Full conversation contents |
| `POST /api/projects/clone` | Clone an arbitrary remote into an arbitrary directory |

The project is candid about this. `README.md:286-294` carries a `[!CAUTION]`:

> The combination of the two notes above matters: with no authentication and prompts
> disabled, anyone who can reach the port can run commands on this machine as you.

And `backend/handlers/directories.ts:8-14` reasons explicitly that unconfined filesystem
browsing "is not an escalation of what the API can already do", because `/api/chat` can run
arbitrary shell commands anyway.

**Two mitigations hold the line today**, and both are real:

1. The server binds `127.0.0.1` unless `--host` says otherwise.
2. `warnIfPermissionsExposed()` logs a startup warning on a non-loopback bind
   (`backend/utils/permissions.ts:64-77`).

But the README itself documents `--host 0.0.0.0` as a supported configuration
(`README.md:170`, `README.md:302`) for "personal network" use. Following the project's own
instructions produces an unauthenticated remote-shell service on the LAN.

### What P01 does and does not fix

P01 changes the default permission mode away from `bypassPermissions`, which is a genuine
and large reduction in blast radius. It does not close this gap:

- An attacker can still **read** every conversation, project path, and directory listing —
  none of those are gated by permission mode.
- An attacker can still **send** `permissionMode: "bypassPermissions"` in a chat POST. P01
  changes the *default*, not the *ceiling*.

P01's own §9 states this: *"P01 does not make the app safe to expose. It makes it safe by
default on localhost."* **P14 is what makes exposure defensible.**

### Why P14 ranks 14th and not 2nd

This is the pack's most-discussed ranking, and it is an honest output of the model the user
chose rather than an oversight.

Under **value ÷ effort, gap-weighted**: value is 5, but *reach* is 4 rather than 5 because a
strictly-localhost user gains friction rather than capability, and effort is 3 because
there is no database to store credentials in (§8). That lands it mid-table.

`06-prioritization-and-roadmap.md` §5 records the alternative explicitly: **under a
security-first lens, P14 moves to P02.** If remote or shared use is anywhere on the near
roadmap, that is the correct reordering, and the ranking should not be treated as an
argument against doing it early.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. **No code may
> be copied.** Described as observable capability only.

claudecodeui scores 4 here and treats authentication as foundational:

- **JWT** (`jsonwebtoken ^9.0.2`) with **bcrypt** password hashing (`bcrypt ^6.0.0`).
- `authenticateToken` middleware on essentially every `/api/*` route; only `/api/auth` and
  `/health` are public.
- **Token refresh** via an `X-Refreshed-Token` response header.
- `authenticateWebSocket()` — the realtime channel is authenticated too.
- A **separate API-key path** (`validateApiKey`) with `/api/agent` gated by key rather than
  user token — machine access distinct from human access.
- `/api/browser-use-mcp` restricted to local connections specifically.

Its default bind is `0.0.0.0` and remote access is the headline feature, so this is not
optional for them — it is the product.

**The structure worth taking**: a default-deny middleware with a small explicit public
allowlist, and a separation between human sessions and machine credentials. **What PDLC
Studio should not take**: multi-user accounts, a user table, or registration flows. There is
one operator, and §3 scopes to that.

---

## 3. Goals & non-goals

### Goals

1. Every API endpoint requires authentication by default.
2. Adding a new endpoint is secure unless it explicitly opts out.
3. `--host 0.0.0.0` becomes a defensible configuration.
4. A localhost-only user is not meaningfully inconvenienced.
5. No database, no new heavyweight dependency, no inflation of the single binary.

### Non-goals

- **Multi-user accounts.** One operator. No user table, no roles, no registration.
- **OAuth / SSO / external identity providers.** Wrong shape for a local tool.
- **Authorising *what* Claude may do.** That is the permission model — P01, P24, P27.
- **API keys for machine clients.** `SEC-05`, deferred; the design must not preclude it.
- **Encrypting conversation history at rest.** Separate concern.
- **TLS.** See §9 — this PRD requires an honest statement about plaintext, not a TLS
  implementation.

---

## 4. Personas & user stories

**Marcus — wants to use it from a tablet on his own LAN.**

> As a user, I want to reach the app from another device behind a password, so that following
> the README's own `--host 0.0.0.0` example is not reckless.

**Devon — shares a machine with housemates.**

> As a user on a shared network, I want the app to require credentials, so that being on the
> same Wi-Fi does not mean shell access to my laptop.

**Priya — strictly localhost.**

> As a local-only user, I want authentication not to slow me down, because on `127.0.0.1` I
> am the only one who can reach it anyway.

Priya's story is the constraint that shapes §6's localhost behaviour.

**Sam — runs it in a container on a home server.**

> As someone self-hosting, I want to set credentials via configuration, so that I can deploy
> without an interactive setup step.

---

## 5. Functional requirements

### Default-deny

- **FR-1** All `/api/*` endpoints **MUST** require a valid session by default.
- **FR-2** Public endpoints **MUST** be an explicit allowlist — a new route is protected
  unless deliberately exempted.
- **FR-3** The allowlist **MUST** be limited to the login endpoint and a health check.
- **FR-4** Unauthenticated requests **MUST** return `401` with no information about what
  exists behind them.

### Credentials

- **FR-5** A single operator password **MUST** be supported.
- **FR-6** The password **MUST** be stored hashed with a memory-hard algorithm and a
  per-installation salt. It **MUST NOT** be stored reversibly.
- **FR-7** It **MUST** be settable without an interactive step, via CLI flag or environment
  variable, for container deployment.
- **FR-8** Where no password is configured **and** the bind is loopback, the server **MUST**
  start and **MUST** operate exactly as today (see §6).
- **FR-9** Where no password is configured **and** the bind is non-loopback, the server
  **MUST** refuse to start, with a message explaining how to set one.

FR-9 is the requirement that actually closes the hole. Anything weaker — a warning, a
generated password printed to stdout — preserves the failure mode where a user follows the
README and ends up exposed.

### Sessions

- **FR-10** Successful login **MUST** establish a session credential.
- **FR-11** The credential **MUST** be transmitted in a way that is not readable by
  client-side script — an `HttpOnly` cookie.
- **FR-12** It **MUST** carry `SameSite=Strict` and `Secure` where the origin is HTTPS.
- **FR-13** Sessions **MUST** expire, with a configurable lifetime and a sensible default.
- **FR-14** There **MUST** be a logout that invalidates the session server-side, not only
  client-side.
- **FR-15** The session store **MUST** survive a server restart, or the user **MUST** be
  told they will be logged out on restart. It **MUST NOT** silently log everyone out.

### Brute-force resistance

- **FR-16** Login attempts **MUST** be rate-limited per source.
- **FR-17** Failed responses **MUST NOT** distinguish "wrong password" from any other
  failure.
- **FR-18** Password comparison **MUST** be constant-time.

### Frontend

- **FR-19** An unauthenticated user **MUST** be shown a login screen rather than a broken
  app.
- **FR-20** A `401` mid-session **MUST** redirect to login without losing the current route.
- **FR-21** The login screen **MUST** be reachable and usable by keyboard, with a labelled
  password field.
- **FR-22** Failed login **MUST** be announced to assistive technology.

### Streaming

- **FR-23** The NDJSON chat stream **MUST** be authenticated like every other endpoint.
- **FR-24** Session expiry **during** an active stream **MUST** be handled gracefully —
  the stream terminates with a clear error, not a silent stall.

---

## 6. UX & interaction specification

### The localhost exemption — the central design decision

FR-8 means a localhost user with no configured password sees **no change at all**. No login
screen, no friction, no migration.

This is deliberate and worth defending. The alternative — forcing a password on every
existing user — would be a hostile upgrade for the large majority who run this exactly as
designed on `127.0.0.1`, and would push people toward weak passwords they type constantly.

The security argument holds because on loopback, anything that can reach the port is already
running as the user, and could read the credential store regardless.

| Bind | Password set? | Behaviour |
| --- | --- | --- |
| Loopback | No | **Runs open, exactly as today.** Startup log notes it |
| Loopback | Yes | Login required |
| Non-loopback | No | **Refuses to start** (FR-9) |
| Non-loopback | Yes | Login required |

The bottom-left cell is the whole point of the PRD.

### Login screen

A dedicated route, not a modal:

```
┌────────────────────────────────┐
│            ◈                   │
│        PDLC Studio             │
│                                │
│  Password                      │
│  [ ····························]│
│                                │
│         [ Sign in ]            │
│                                │
│  Set with --password or        │
│  PDLC_PASSWORD.                │
└────────────────────────────────┘
```

The hint matters: a user who has forgotten the password has no reset flow (there is no
email, no second factor), so the recovery path is "restart the server with a new one". Say so
rather than leaving them stuck.

Compose from Astryx `Field`, `Input`, and `Button`. **No new CSS classes.**

### Session expiry mid-stream

FR-24's case is specific and easy to get wrong. If a session expires while a chat response is
streaming, the connection must not simply stop — that is indistinguishable from the rate-limit
stall P02 exists to fix. The stream should terminate with an `error` frame that the client
recognises as an auth failure and turns into a redirect, preserving the transcript so far.

---

## 7. Technical design

### 7.1 Middleware

Hono middleware registered **before** route handlers, in `backend/middleware/`, alongside the
existing `config.ts`.

Default-deny (FR-1, FR-2) means the middleware protects everything and consults a small
explicit allowlist:

```ts
const PUBLIC_PATHS = new Set(["/api/auth/login", "/api/health"]);
```

A `Set` of exact paths, **not** a prefix match — prefix matching is how
`/api/health/../projects` style mistakes happen, and how a future `/api/authorization`
route accidentally becomes public.

### 7.2 Password hashing without a heavy dependency

**This is the main technical constraint** and the reason effort is 3 rather than 2.

claudecodeui uses `bcrypt`, which is a **native module**. That is unacceptable here:
`CLAUDE.md` documents the fight to keep `deno compile` output small (428 MB → 94 MB), and
native modules are exactly the class of dependency that breaks single-binary builds across
five targets.

Options:

| Option | Assessment |
| --- | --- |
| `bcrypt` (native) | **Rejected** — breaks `deno compile` |
| A pure-JS bcrypt | Works, but slow in JS and adds a dependency |
| **Web Crypto PBKDF2** | **Recommended** — `crypto.subtle` is available in both Deno and Node ≥20, zero dependencies, standard |
| Argon2 | Stronger, but every implementation is native or WASM |

**Recommendation: PBKDF2-HMAC-SHA256 via Web Crypto**, with a high iteration count
(≥600,000, per current OWASP guidance) and a per-installation random salt. It is weaker than
Argon2id against dedicated hardware, but this protects a single local password against an
attacker who already has filesystem read access — a threat model where the marginal
difference is small and the dependency cost is not.

Because `crypto.subtle` is a web standard, it works identically under both runtimes and needs
no addition to the `Runtime` interface (`backend/runtime/types.ts`).

### 7.3 Credential and session storage

No database (§8). Two small files under `~/.claude/`:

```
~/.claude/pdlc-studio-auth.json      { version, salt, hash, iterations }
~/.claude/pdlc-studio-sessions.json  { version, sessions: [{ id, expiresAt }] }
```

- Written with restrictive permissions (`0600`) — **and this must be verified**, since a
  world-readable credential file defeats the exercise.
- Session ids are cryptographically random, stored **hashed**, so a leaked file does not
  yield usable sessions.
- FR-15 is satisfied: sessions survive restart.
- Expired entries pruned on write, so the file stays bounded.

Note P06 also proposes a `~/.claude/pdlc-studio-*.json` sidecar. **A shared, tested helper
for reading and writing these files should be written once**, by whichever PRD lands first,
rather than twice with different failure semantics.

### 7.4 Cookies over the streaming endpoint

FR-11's `HttpOnly` cookie is the right choice over a `localStorage` token — it removes the
XSS-exfiltration path entirely.

It works with the NDJSON stream because the frontend uses `fetch`, and cookies are sent
automatically on same-origin requests. **No change to the streaming transport is needed**,
which is a significant simplification versus claudecodeui's `authenticateWebSocket`.

`SameSite=Strict` (FR-12) is the CSRF defence. Because the API is same-origin with the SPA
and there are no cross-site flows, `Strict` costs nothing.

### 7.5 Backend changes

| File | Change |
| --- | --- |
| New `backend/middleware/auth.ts` | Default-deny middleware, allowlist |
| New `backend/auth/password.ts` | PBKDF2 hash and constant-time verify |
| New `backend/auth/sessions.ts` | Create, validate, invalidate, prune |
| New `backend/handlers/auth.ts` | `POST /api/auth/login`, `POST /api/auth/logout` |
| New `backend/utils/sidecar.ts` | Shared `~/.claude/*.json` read/write (§7.3) |
| Modify `backend/cli/args.ts` | `--password`, `--session-ttl` |
| Modify `backend/cli/deno.ts` / `node.ts` | **FR-9 startup refusal** |
| Modify `backend/utils/permissions.ts` | `warnIfPermissionsExposed` now accounts for auth |

That last one matters: once authentication exists, the startup warning should say something
different when a non-loopback bind *is* protected. Leaving it unchanged would cry wolf.

### 7.6 Frontend changes

| File | Change |
| --- | --- |
| New `frontend/src/components/LoginPage.tsx` | FR-19 |
| New `frontend/src/hooks/useAuth.ts` | Auth state, login, logout |
| Modify `frontend/src/App.tsx` | `/login` route; guard the others |
| Modify `frontend/src/config/` API layer | Central `401` handling (FR-20) |

`401` handling belongs in **one place** in the API layer, not in each caller. Otherwise a new
endpoint added later will handle expiry inconsistently.

---

## 8. Data model & persistence

| Datum | Store | Lifetime | Notes |
| --- | --- | --- | --- |
| Password hash, salt, iterations | `~/.claude/pdlc-studio-auth.json`, `0600` | Until changed | Never reversible |
| Active sessions (hashed ids) | `~/.claude/pdlc-studio-sessions.json`, `0600` | Until expiry | Pruned on write |
| Session cookie | Browser, `HttpOnly` | Session TTL | Not script-readable |

**No database**, consistent with `SESS-04`'s rejection in
`06-prioritization-and-roadmap.md` §4.

Concurrency: two instances could race on the sessions file. Last-write-wins risks dropping a
session, which logs someone out — annoying, not dangerous. Acceptable; note it.

---

## 9. Security implications

This PRD *is* a security change, so this section is about what it does **not** achieve.

**Achieved**: unauthenticated read of conversations, project paths, and directory listings is
closed. Unauthenticated shell execution via `/api/chat` is closed. Non-loopback exposure
without a password becomes impossible (FR-9).

**Not achieved — and each must be stated in the README, not left implied:**

1. **No TLS.** Over plain HTTP on a LAN, the password and session cookie travel in
   cleartext. Anyone who can passively observe the network can capture both. **FR-12's
   `Secure` flag only applies on HTTPS**, so on plain HTTP the cookie is sent unencrypted by
   necessity.

   This is the single biggest residual risk. The honest guidance is: authentication makes
   `--host 0.0.0.0` *defensible on a trusted network*; it does not make it safe on an
   untrusted one. A reverse proxy terminating TLS remains the correct answer for anything
   beyond a home LAN, and the README should say so rather than implying auth is sufficient.

2. **A compromised browser still has full access.** `HttpOnly` prevents script from *reading*
   the cookie, not from *using* the session via same-origin requests.

3. **Local filesystem access defeats it.** Anyone who can read `~/.claude/` can read the hash
   and attack it offline. On loopback that is not a new exposure.

4. **No password rotation flow.** Changing it means restarting with a new value. Acceptable
   for a single-operator tool; should be documented, not discovered.

5. **Rate limiting is per-process and in-memory.** A restart clears it. Adequate against
   casual guessing, not against a determined attacker with restart access.

**Timing safety** (FR-18): comparison must be constant-time. Note that FR-17's uniform
failure response is undermined if a wrong password returns faster than a correct one, so the
hash must be computed even on paths that will fail.

---

## 10. Performance & scale

PBKDF2 at ≥600,000 iterations deliberately takes ~100–300 ms. That is the point, and it is
paid once per login, not per request.

Session validation per request is a hash and a map lookup — negligible. **The sessions file
must not be read from disk on every request**; load once and keep in memory, persisting on
change.

---

## 11. Telemetry & observability

Via `backend/utils/logger.ts`:

- `logger.cli.info` at startup: whether auth is enabled and what the bind is.
- `logger.cli.error` on the FR-9 refusal, naming how to fix it.
- `logger.api.warn` on failed login attempts — **without** the attempted password.
- `logger.api.warn` on rate-limit triggering.

No client analytics.

---

## 12. Test plan

### Backend — `make test-backend`

New `backend/auth/password.test.ts`:

| Test | Asserts |
| --- | --- |
| Hash then verify succeeds | FR-6 |
| Wrong password fails | FR-6 |
| Same password yields different hashes (salt) | FR-6 |
| Verification is constant-time across lengths | FR-18 |
| Hash is not reversible to the input | FR-6 |

New `backend/auth/sessions.test.ts`:

| Test | Asserts |
| --- | --- |
| Created session validates | FR-10 |
| Expired session rejected | FR-13 |
| Logout invalidates server-side | FR-14 |
| Sessions survive a simulated restart | FR-15 |
| Stored ids are hashed, not raw | §7.3 |
| Expired entries pruned | §7.3 |

New `backend/middleware/auth.test.ts` — **the most important file here**:

| Test | Asserts |
| --- | --- |
| Unauthenticated request to each protected route returns 401 | FR-1 |
| **A route not in the allowlist is protected by default** | **FR-2** |
| Allowlist matches exact paths, not prefixes | §7.1 |
| 401 body reveals nothing about the resource | FR-4 |
| Valid session passes through | FR-10 |
| **Chat streaming endpoint is protected** | FR-23 |

New `backend/handlers/auth.test.ts`:

| Test | Asserts |
| --- | --- |
| Correct password issues an `HttpOnly` cookie | FR-11 |
| Cookie carries `SameSite=Strict` | FR-12 |
| Wrong password returns an indistinguishable failure | FR-17 |
| Rate limiting engages after N failures | FR-16 |

New startup tests:

| Test | Asserts |
| --- | --- |
| Loopback + no password → starts, open | FR-8 |
| **Non-loopback + no password → refuses to start** | **FR-9** |
| Non-loopback + password → starts | FR-9 |

### Frontend — `make test-frontend`

New `frontend/src/components/LoginPage.test.tsx` and `hooks/useAuth.test.ts`:

| Test | Asserts |
| --- | --- |
| Password field is labelled and keyboard-usable | FR-21 |
| Failed login announced to AT | FR-22 |
| 401 redirects to login preserving the route | FR-20 |
| Post-login returns to the original route | FR-20 |
| **Session expiry mid-stream surfaces an auth error, not a stall** | FR-24 |

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Loopback, no password → identical to today.
2. `--host 0.0.0.0` with no password → **refuses to start** with a helpful message.
3. `--host 0.0.0.0 --password …` → login required from another device.
4. `curl` every endpoint unauthenticated → 401 across the board.
5. `curl` the chat stream unauthenticated → 401.
6. Log in, restart the server → still logged in (FR-15).
7. Log out → session rejected server-side.
8. Expire a session mid-stream → clear error, transcript preserved.
9. **Verify `~/.claude/pdlc-studio-auth.json` is `0600`.**
10. Ten wrong passwords → rate limited.

---

## 13. Rollout & migration

- **No migration for localhost users** — FR-8 preserves today's behaviour exactly.
- **Breaking for non-loopback users**: they must set a password or the server will not start.
  This is intentional and must lead the release notes.
- **Minor version bump**, with the FR-9 behaviour called out prominently.
- **README must be rewritten** — `README.md:286-306` currently states "No authentication:
  Currently no built-in auth mechanism", and the `[!CAUTION]` block becomes partly obsolete.
  The TLS caveat from §9 must replace it rather than simply being deleted.
- **Ship after P01**, so the permission default and the auth boundary land in a sensible
  order.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Users believe auth makes plain-HTTP exposure safe** | **High** | **High** | §9.1 — README must state the TLS gap explicitly; do not let auth read as sufficient |
| 2 | FR-9 refusal breaks existing `--host 0.0.0.0` deployments | **Certain** | Medium | Intentional; lead the release notes; error message names the fix |
| 3 | A new endpoint added later is accidentally public | Medium | **High** | FR-2 default-deny; explicit test for an unlisted route |
| 4 | Credential file world-readable | Medium | **High** | `0600` and a test that verifies it |
| 5 | A native hashing dependency creeps in and breaks `deno compile` | Medium | High | §7.2 Web Crypto only; no new runtime dependency |
| 6 | Session expiry mid-stream looks like a hang | Medium | Medium | FR-24; explicit test |
| 7 | Localhost exemption is seen as a loophole | Medium | Low | §6 rationale; startup log states the mode |
| 8 | Sidecar helper duplicated with P06 | Medium | Low | §7.3 — one shared, tested helper |
| 9 | Forgotten password locks the user out | Medium | Low | Login screen states the recovery path |

---

## 15. Acceptance criteria

- [ ] All `/api/*` routes require a session by default
- [ ] Public paths are an exact-match allowlist of login and health only
- [ ] A route not in the allowlist is protected — proven by test
- [ ] 401 responses reveal nothing about the resource
- [ ] Password hashed with PBKDF2 via Web Crypto, per-installation salt, ≥600k iterations
- [ ] **No native dependency; `deno compile` output unaffected**
- [ ] Password settable via flag and environment variable
- [ ] Loopback + no password behaves exactly as today
- [ ] **Non-loopback + no password refuses to start**
- [ ] Session cookie is `HttpOnly`, `SameSite=Strict`, `Secure` on HTTPS
- [ ] Sessions expire, survive restart, and can be invalidated server-side
- [ ] Login rate-limited; failures indistinguishable; comparison constant-time
- [ ] Chat streaming endpoint authenticated
- [ ] Mid-stream expiry produces a clear error, not a stall
- [ ] Credential and session files are `0600` — verified by test
- [ ] Login screen keyboard-usable, labelled, failures announced
- [ ] 401 redirects to login preserving the route
- [ ] **README rewritten, including the TLS limitation**
- [ ] `make check` passes under both runtimes

---

## 16. Open questions

1. **Should P14 move to P02?** `06-prioritization-and-roadmap.md` §5 sets out the
   security-first ordering. This is a product decision, not a technical one, and it should be
   made explicitly rather than by default.
2. **Is PBKDF2 acceptable, or is Argon2id worth a WASM dependency?** §7.2 recommends PBKDF2
   on dependency-cost grounds. Revisit if the threat model changes.
3. **Should there be a password-change flow?** §9.4 says restart-with-a-new-value. A
   `--change-password` mode would be friendlier and is small.
4. **Should TLS be offered directly** — a `--tls-cert`/`--tls-key` pair — rather than only
   recommending a reverse proxy? It would close §9.1 properly, but adds real surface. Strong
   candidate for a follow-up PRD.
5. **Should `GET /api/health` be public at all?** It is convenient for container health
   checks and reveals almost nothing, but "almost nothing" is not "nothing".
6. **How does this interact with P10's `/api/health/cli`?** That endpoint reveals a filesystem
   path and **must not** be in the public allowlist.

Question 6 is a concrete cross-PRD hazard: P10 adds a health endpoint, P14 makes health
public. **They must not be the same path.** P10 already scopes its endpoint under
`/api/health/cli`; this PRD's allowlist must name `/api/health` exactly, not the prefix
(§7.1) — which is precisely why exact matching was specified.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| PBKDF2 hashing + constant-time verify | 3 h |
| Session store, expiry, pruning, restart persistence | 5 h |
| Shared sidecar helper with `0600` handling | 2 h |
| Default-deny middleware + allowlist | 3 h |
| Login/logout handlers + rate limiting | 4 h |
| CLI flags + FR-9 startup refusal | 3 h |
| `warnIfPermissionsExposed` update | 1 h |
| `LoginPage` + `useAuth` | 4 h |
| Central 401 handling in the API layer | 2 h |
| Mid-stream expiry handling | 2 h |
| Backend tests | 8 h |
| Frontend tests | 4 h |
| README rewrite incl. TLS caveat | 2 h |
| Manual verification incl. permissions and remote device | 3 h |
| **Total** | **≈46 h — 6 days** |

Effort 3 is right. Roughly a third is tests, which is appropriate for the one PRD in the pack
whose failure mode is a security hole rather than a bug.

---

## 18. References

- `README.md:286-306` — Security Considerations and the `[!CAUTION]` block to be rewritten
- `README.md:170`, `README.md:302` — the `--host 0.0.0.0` examples this PRD makes safe
- `backend/utils/permissions.ts:64-77` — `warnIfPermissionsExposed`
- `backend/handlers/directories.ts:8-14` — the unconfined-reads justification
- `backend/middleware/config.ts` — existing middleware pattern
- `backend/cli/args.ts` — flag parsing
- `backend/runtime/types.ts` — why Web Crypto avoids touching this
- `frontend/src/App.tsx` — route structure to guard
- `frontend/src/config/` — API layer for central 401 handling
- `CLAUDE.md` § "Single Binary Distribution" — why native modules are rejected
- `../01-claudecodeui-deep-scan.md` §3.1 — competitor's auth structure
- `../03-feature-comparison-matrix.md` — `SEC-01`, `SEC-02`, `SEC-10`
- `../06-prioritization-and-roadmap.md` §5 — the security-first alternative ordering
- `P01-safe-permission-defaults-mode-persistence.md` §9 — what P01 does not fix
