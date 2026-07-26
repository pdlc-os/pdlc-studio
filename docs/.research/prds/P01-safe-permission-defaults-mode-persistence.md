# P01 — Safe Permission Defaults & Mode Persistence

| Field | Value |
| --- | --- |
| **Priority** | **P01** of 30 |
| **Score** | **50.0** — the highest in the pack by a factor of two |
| **Inputs** | Value 5 · Reach 5 · GapWeight ×2.0 · Effort 1 |
| **Category** | Access, Identity & Security · Tool Execution, Permissions & Safety |
| **Matrix features** | `SEC-03` (safe-by-default tool permissions), `SEC-11` (permission mode persistence) |
| **Maturity** | PDLC Studio **1** → target **4** · claudecodeui **4** |
| **Effort** | **1** — constants, one hook, one storage key, docs (< 1 day of code, plus a deliberate decision) |
| **Depends on** | Nothing |
| **Blocks** | P24 (tool allowlist UI), P27 (audit log), and any credible remote-access story |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio ships with **approval prompts disabled**. A fresh session starts in
`bypassPermissions`, the most permissive of the Claude CLI's four modes, which runs every
tool — including `Bash` — with no prompt and no confirmation.

This is set in two independent places, and both must agree:

- **UI default**: `INITIAL_PERMISSION_MODE` in
  `frontend/src/hooks/chat/usePermissionMode.ts:20`
- **API default** for requests that omit the field: `DEFAULT_PERMISSION_MODE` in
  `backend/utils/permissions.ts:29`

Combined with the fact that **the app has no authentication whatsoever**, the practical
consequence is stated plainly in the project's own README (`README.md:293-294`):

> **CAUTION** — with no authentication and prompts disabled, anyone who can reach the port
> can run commands on this machine as you.

There is a second, subtler defect. Even a user who *deliberately opts into safety* by
cycling to `default` mode loses that choice on the next page load. `usePermissionMode` is
plain React state with no persistence, and the hook documents this explicitly
(`frontend/src/hooks/chat/usePermissionMode.ts:23-26`):

> State is preserved across component re-renders but resets on page reload.
> No localStorage persistence - simple React state management.

A `STORAGE_KEYS.PERMISSION_MODE` key already exists in `frontend/src/utils/storage.ts:10`,
but it is marked **legacy** and nothing reads or writes it.

So the current behaviour is: *the safe path is not the default, and choosing it does not
stick.* A user who carefully switches to approval prompts before running an unfamiliar
task, then refreshes the page, is silently returned to unattended execution with no
indication that anything changed. That is the failure mode this PRD exists to eliminate.

### Why this is P01

It is simultaneously the **highest-impact** and **lowest-effort** item in the entire pack.
The score of 50.0 is double the next item. It requires no new endpoint, no new component,
no new dependency — two constants, a persistence layer that already exists for other
settings, and one deliberate product decision.

It is also a prerequisite for anything else in the security category. There is no point
building a tool allowlist UI (P24) or an audit log (P27) on top of a default that bypasses
both.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is **AGPL-3.0-or-later**; PDLC Studio is MIT. No code may
> be copied. This section cites the competitor only as evidence that the alternative posture
> is practical and shipped. Implementation below is independently specified.

claudecodeui takes the **exact inverse** position. Its README states:

> "All Claude Code tools are **disabled by default**. This prevents potentially harmful
> operations from running automatically."

Users opt *in* to each tool through a settings surface, rather than opting out of a
blanket permit. Paired with JWT authentication (`jsonwebtoken`, `bcrypt`) and an
authenticated WebSocket (`authenticateWebSocket` in `server/index.js`), this is a coherent
"safe to expose" posture — which matters because claudecodeui binds `0.0.0.0` by default
and sells remote access as its headline feature.

The relevant lesson is not "copy their default." It is that a mainstream, 12.9k-star
product in this exact category ships closed-by-default and users accept it. The friction
cost of a safe default is empirically tolerable.

### Where PDLC Studio's position is genuinely defensible

The permissive default is not carelessness. `backend/utils/permissions.ts:14-17` states the
intent:

> This is deliberate: the app is meant to drive Claude unattended against a working
> directory the user picked.

Unattended operation is a real use case and a real differentiator. This PRD does **not**
propose removing it — it proposes making it an explicit, persisted, informed choice rather
than an unannounced default.

---

## 3. Goals & non-goals

### Goals

1. A first-run session **must** start in a mode that prompts for approval.
2. A user's chosen permission mode **must** persist across page reloads and restarts.
3. Choosing an unattended mode **must** be an informed, one-time, explicit action.
4. The API default **must** match the UI default, so an API client that omits
   `permissionMode` gets the same posture as the UI.
5. Users who want the current behaviour permanently **must** have a supported, documented
   way to get it that does not involve editing source.

### Non-goals

- **Authentication.** That is P14. This PRD reduces blast radius; it does not add identity.
- **A tool allowlist UI.** That is P24.
- **An audit log.** That is P27.
- **Removing `bypassPermissions`.** The mode stays fully supported and one control away.
- **Per-project permission profiles.** Deferred (matrix `TOOL-05`); blocked on a broader
  persistence decision.
- **Changing the CLI's own permission semantics.** The four modes are Claude Code's; this
  PRD only changes which one is selected and whether that selection is remembered.

---

## 4. Personas & user stories

**Priya — evaluating the tool.** Installs PDLC Studio, points it at a work repository, and
asks it to "clean up the test suite."

> As a first-time user, I want the app to ask before it runs shell commands, so that
> evaluating it on a real repository is not a gamble.

**Marcus — daily driver, wants unattended runs.** Uses PDLC Studio on a scratch checkout
and finds prompts an obstacle.

> As an experienced user, I want to turn approval prompts off once and have that stick, so
> that I am not re-selecting the same mode every morning.

**Devon — security-conscious, works on a laptop that leaves the house.** Occasionally binds
to `0.0.0.0` to use the app from a tablet.

> As a cautious user, I want my choice of approval mode to survive a page refresh, so that
> I never discover after the fact that the app quietly reverted to running everything.

**Sam — CI / scripted API consumer.** Posts to `/api/chat` from a script.

> As an API consumer, I want the server's default to be the safe one, so that forgetting a
> field does not silently grant shell access.

---

## 5. Functional requirements

Keywords per RFC 2119.

### Defaults

- **FR-1** `INITIAL_PERMISSION_MODE` (`frontend/src/hooks/chat/usePermissionMode.ts`)
  **MUST** change from `"bypassPermissions"` to `"default"`.
- **FR-2** `DEFAULT_PERMISSION_MODE` (`backend/utils/permissions.ts`) **MUST** change from
  `"bypassPermissions"` to `"default"`.
- **FR-3** The two **MUST** remain consistent. A test **MUST** fail if they diverge.
- **FR-4** All four modes **MUST** remain valid values of `resolvePermissionMode()`; this
  PRD changes only which is selected absent an explicit choice.

### Persistence

- **FR-5** The selected permission mode **MUST** persist to `localStorage` under the
  existing `AppSettings` object (`frontend/src/types/settings.ts`), not as a loose key.
- **FR-6** On load, a persisted mode **MUST** be restored in preference to
  `INITIAL_PERMISSION_MODE`.
- **FR-7** A persisted value that is not one of the four valid modes **MUST** be discarded
  and replaced with `INITIAL_PERMISSION_MODE`, without throwing.
- **FR-8** The settings-version migration path in `frontend/src/utils/storage.ts` **MUST**
  be extended so existing stored settings gain the new field without loss.
- **FR-9** The legacy `STORAGE_KEYS.PERMISSION_MODE` key **MUST** be read once during
  migration if present, then removed — matching the existing legacy-key handling for
  `THEME` and `ENTER_BEHAVIOR` (`frontend/src/utils/storage.ts:84-86`).

### Informed opt-out

- **FR-10** Selecting `bypassPermissions` from the UI **MUST** show a confirmation
  explaining, in plain language, that Claude will run every tool including shell commands
  without asking.
- **FR-11** That confirmation **MUST** require an affirmative action; `Escape` or dismissal
  **MUST** leave the mode unchanged.
- **FR-12** The confirmation **MUST NOT** reappear on subsequent selections once the user
  has accepted it, tracked by a persisted `acknowledged` flag. Re-prompting every time
  trains dismissal.
- **FR-13** While in `bypassPermissions`, the mode indicator in the chat input footer
  **MUST** be visually distinct from the other three modes.

### Server-side configuration

- **FR-14** A `--permission-mode <mode>` CLI flag **SHOULD** be added
  (`backend/cli/args.ts`) so operators can set the server default without editing source.
- **FR-15** An invalid value **MUST** cause startup to fail with a message naming the four
  valid modes — consistent with how `resolvePermissionMode()` rejects bad request bodies.
- **FR-16** `warnIfPermissionsExposed()` (`backend/utils/permissions.ts:64-77`) **MUST**
  continue to warn when a permissive mode is combined with a non-loopback bind, and **MUST**
  now evaluate the *effective* configured mode rather than the hard-coded constant.

### Documentation

- **FR-17** `README.md` §Security Considerations and `CLAUDE.md` §Permission Mode Switching
  **MUST** be updated. Both currently document `bypassPermissions` as the default and would
  otherwise become actively misleading.

---

## 6. UX & interaction specification

### The mode indicator

Lives in the chat input footer, cycled by click or `Ctrl+Shift+M`
(`KEYBOARD_SHORTCUTS.PERMISSION_MODE_TOGGLE`, `frontend/src/utils/constants.ts:9`).

| Mode | Label | Treatment |
| --- | --- | --- |
| `default` | "Ask for approval" | Neutral — this is now the resting state |
| `acceptEdits` | "Auto-accept edits" | Neutral |
| `plan` | "Plan mode" | Neutral, distinct icon |
| `bypassPermissions` | **"No prompts"** | **Warning treatment** (FR-13) |

Use an Astryx semantic status/badge component for the warning treatment. **Do not** hand-roll
a colour — `CLAUDE.md` forbids utility classes and app CSS beyond the existing app-shell
classes. Discover the right component with
`npx @astryxdesign/cli component --list` rather than guessing props.

Colour **MUST NOT** be the only differentiator (WCAG 1.4.1). Pair it with a distinct icon
and the changed label text.

### The opt-out confirmation

Triggered only on transition *into* `bypassPermissions`, and only until acknowledged.

```
┌────────────────────────────────────────────────────────┐
│  Turn off approval prompts?                            │
│                                                        │
│  Claude will run every tool without asking — including │
│  shell commands via Bash, file writes, and deletions,  │
│  anywhere inside:                                      │
│                                                        │
│    ~/code/my-project                                   │
│                                                        │
│  This app has no authentication. If you have bound it  │
│  to a network interface, anyone who can reach the port │
│  can run commands as you.                              │
│                                                        │
│  You can change this any time with Ctrl+Shift+M.       │
│                                                        │
│           [ Cancel ]     [ Turn off prompts ]          │
└────────────────────────────────────────────────────────┘
```

Specifics that matter:

- **Name the actual working directory.** Abstract warnings get dismissed; a concrete path
  makes the blast radius real.
- **The network sentence is conditional.** Show it only when the server reports a
  non-loopback bind, so it stays true rather than boilerplate.
- **The confirming button is not styled as destructive-primary.** It is a legitimate choice,
  not a mistake — over-alarming trains dismissal as surely as under-warning.
- Compose from the Astryx dialog primitive already used by `NewProjectDialog` and
  `CloneRepositoryDialog`.

### States

| State | Behaviour |
| --- | --- |
| First ever load | `default` mode. No dialog, no interruption. |
| Load with persisted mode | Restore it silently. No dialog even for `bypassPermissions` — it was already acknowledged. |
| Load with corrupt persisted value | Fall back to `default`. Log a console warning once. No user-facing error. |
| Cycling into `bypassPermissions`, not acknowledged | Show dialog. Mode changes only on confirm. |
| Cycling into `bypassPermissions`, acknowledged | Change immediately. |
| CLI declines the mode | Unchanged from today — `permissions.disableBypassPermissionsMode` wins and `PermissionInputPanel` handles the prompts that return (`backend/utils/permissions.ts:20-23`). |

### Keyboard & accessibility

- `Ctrl+Shift+M` continues to cycle. When the dialog opens, focus **MUST** move into it and
  be trapped until resolved.
- `Escape` cancels, leaving the mode unchanged (FR-11).
- The dialog **MUST** have `role="dialog"`, `aria-modal="true"`, and an `aria-labelledby`
  pointing at its heading.
- The mode indicator **MUST** expose its current state to assistive technology — via
  `aria-label` naming the active mode, not via colour or icon alone.
- Tests **MUST** assert on roles and `aria-*`, never on generated StyleX class names
  (`CLAUDE.md`, "Testing note").

---

## 7. Technical design

### 7.1 Backend

**`backend/utils/permissions.ts`**

```ts
// Was: "bypassPermissions"
export const DEFAULT_PERMISSION_MODE: PermissionMode = "default";
```

The extensive comment block above it (lines 11-28) must be rewritten. It currently explains
why the permissive default is deliberate; it will need to explain the inverse, and to point
at the new `--permission-mode` flag as the supported way to restore the old behaviour.

`warnIfPermissionsExposed()` currently early-returns unless the compile-time constant is
`bypassPermissions` (line 65-67). Under FR-16 it must take the *effective* mode as a
parameter instead, since that is now configurable at runtime:

```ts
export function warnIfPermissionsExposed(
  host: string,
  mode: PermissionMode,
): void
```

Call site is in the CLI startup path (`backend/cli/deno.ts` / `backend/cli/node.ts`).

**`backend/cli/args.ts`** gains `--permission-mode`, parsed and validated against
`VALID_PERMISSION_MODES` (reuse the existing export — do not duplicate the list). Invalid
values exit non-zero with a message naming the four modes.

**`backend/middleware/config.ts`** carries the resolved mode on `c.var.config`, alongside
the existing `cliPath`, so `handleChatRequest` can fall back to it rather than to the module
constant.

**`backend/handlers/chat.ts`** — `resolvePermissionMode(chatRequest.permissionMode)` at
line 120 currently substitutes the module constant for `undefined`. It must instead
substitute the configured default from `c.var.config`. The 400-on-invalid behaviour
(lines 121-131) is unchanged and must stay.

### 7.2 Shared types

`shared/types.ts:13-21` carries a doc comment on `ChatRequest.permissionMode` describing
`bypassPermissions` as "this app's default." That comment becomes false and must be
rewritten. The type union itself is unchanged.

### 7.3 Frontend

**`frontend/src/types/settings.ts`** — extend `AppSettings`:

```ts
export interface AppSettings {
  theme: Theme;
  enterBehavior: EnterBehavior;
  permissionMode: PermissionMode;
  bypassAcknowledged: boolean;
  version: number;
}
```

`CURRENT_SETTINGS_VERSION` **MUST** be incremented.

**`frontend/src/utils/storage.ts`** — `migrateLegacySettings()` already demonstrates the
exact pattern required: read legacy keys, build the new object, save, delete the legacy
keys (lines 59-89). Extend it to read `STORAGE_KEYS.PERMISSION_MODE` (FR-9), validate the
value, and default to `"default"` if absent or invalid.

Note the existing `getSettings()` discards stored settings whose `version` does not match
exactly (line 47). Bumping the version therefore routes every existing user through
migration, which is the desired path — but the migration currently reads only the legacy
keys, not the *previous version's unified object*. It must be extended to preserve
`theme` and `enterBehavior` from a v1 object rather than resetting them, or every user
loses their theme on upgrade. **This is the single most likely bug in this PRD.**

**`frontend/src/hooks/chat/usePermissionMode.ts`** — currently self-contained React state.
It must read initial state from settings and write changes back. Prefer routing through the
existing `SettingsContext` (`frontend/src/contexts/`) and `useSettings`
(`frontend/src/hooks/useSettings.ts`) rather than calling `storage.ts` directly, so there is
one source of truth for settings.

The hook's returned shape (`isPlanMode`, `isDefaultMode`, `isAcceptEditsMode`,
`isBypassPermissionsMode`) is consumed elsewhere and **MUST NOT** change — this keeps the
diff contained to the hook's internals.

Add to the returned interface:

```ts
requestPermissionMode: (mode: PermissionMode) => void;  // may open the dialog
pendingModeConfirmation: PermissionMode | null;
confirmPendingMode: () => void;
cancelPendingMode: () => void;
```

`setPermissionMode` stays as the unguarded setter for internal use; the footer control and
the keyboard shortcut call `requestPermissionMode`.

**New component** `frontend/src/components/chat/BypassConfirmDialog.tsx`, composed from the
same Astryx dialog primitive as `NewProjectDialog.tsx`. It needs the working directory
(available on `ChatPage` from the route) and whether the bind is non-loopback.

> The bind address is **not currently exposed to the frontend**. Either add it to an
> existing response or accept a small `GET /api/config` addition. See Open Questions.

### 7.4 Reuse

Explicitly reuse rather than rebuild:

| Need | Existing thing to use | Path |
| --- | --- | --- |
| Dialog shell | Astryx dialog as used by the project dialogs | `frontend/src/components/NewProjectDialog.tsx` |
| Settings persistence + migration | `getSettings` / `setSettings` / `migrateLegacySettings` | `frontend/src/utils/storage.ts` |
| Settings distribution | `SettingsContext` + `useSettings` | `frontend/src/contexts/`, `frontend/src/hooks/useSettings.ts` |
| Mode validation | `VALID_PERMISSION_MODES`, `resolvePermissionMode` | `backend/utils/permissions.ts` |
| Startup warning | `warnIfPermissionsExposed` | `backend/utils/permissions.ts` |

---

## 8. Data model & persistence

PDLC Studio has **no database**, and this PRD introduces none.

| Datum | Store | Lifetime | Rationale |
| --- | --- | --- | --- |
| Selected permission mode | `localStorage`, inside `AppSettings` | Until cleared | Per-browser, matching theme and Enter behaviour |
| `bypassAcknowledged` | `localStorage`, inside `AppSettings` | Until cleared | Per-browser by design — a new browser should be warned again |
| Server default mode | Process memory from `--permission-mode` | Process lifetime | Operator configuration, not user state |

**Deliberate consequence**: mode is per-browser, not per-machine or per-project. A user with
two browsers gets two settings. This is consistent with how theme already behaves and is the
correct trade for a change of this size — per-project modes are `TOOL-05`, deferred pending
a persistence decision that would affect several features at once.

---

## 9. Security implications

**Risk reduced.** The default blast radius drops from "arbitrary shell execution on first
message" to "arbitrary shell execution only after an explicit, informed opt-in." For the
unauthenticated-network-exposure scenario in `README.md:293-294`, an attacker reaching the
port now triggers approval prompts in the legitimate user's browser rather than silently
executing.

**Risk *not* reduced — state plainly, do not overclaim:**

- An attacker who can reach the port can still **read** conversation history, project paths,
  and directory listings through unauthenticated GET endpoints.
- An attacker can still **submit** `permissionMode: "bypassPermissions"` directly in a chat
  POST body. Nothing server-side prevents it. This PRD changes the *default*, not the
  *ceiling*.

That second point is important and must not be glossed: **P01 does not make the app safe to
expose.** It makes it safe *by default on localhost*. Only P14 (authentication) addresses
exposure, which is why P01 is listed as blocking it in spirit even though it is not a
technical prerequisite.

**New risk introduced**: prompt fatigue. Approval prompts on every tool call may push users
to `bypassPermissions` faster than the current default would have. FR-12's one-time
acknowledgement is a partial mitigation; P24 (tool allowlist UI) is the real answer, letting
users permit `Read` and `Grep` permanently while still gating `Bash`. This is the strongest
argument for sequencing P24 soon after.

---

## 10. Performance & scale

Negligible. One additional `localStorage` read at mount (already happening for settings),
one write per mode change. No new network calls unless the `GET /api/config` option in §7.3
is chosen, which would be a single small request at page load.

---

## 11. Telemetry & observability

No product analytics — PDLC Studio has none and this PRD does not introduce any.

Server-side, via the existing structured logger (`backend/utils/logger.ts`):

- `logger.cli.info` at startup naming the effective permission mode. Operators currently
  have no way to confirm which mode is in force.
- The existing `logger.cli.warn` from `warnIfPermissionsExposed()`, now driven by the
  effective mode (FR-16).
- The existing `logger.chat.warn` on rejected modes (`backend/handlers/chat.ts:122-124`) is
  unchanged.

Client-side: one `console.warn` when a corrupt persisted mode is discarded (FR-7), emitted
once, consistent with the once-per-page-load discipline used for unknown SDK message types.

---

## 12. Test plan

### Backend — Deno test runner, `make test-backend`

Extend `backend/utils/permissions.test.ts`:

| Test | Asserts |
| --- | --- |
| Default is `"default"` | `DEFAULT_PERMISSION_MODE === "default"` — locks FR-2 |
| Undefined resolves to the configured default | `resolvePermissionMode(undefined)` |
| Each of four modes resolves to itself | FR-4 |
| Unknown string resolves to `null` | Unchanged behaviour |
| `warnIfPermissionsExposed` warns on `0.0.0.0` + `bypassPermissions` | FR-16 |
| `warnIfPermissionsExposed` silent on `127.0.0.1` + `bypassPermissions` | FR-16 |
| `warnIfPermissionsExposed` silent on `0.0.0.0` + `default` | FR-16 — the new case |

Extend `backend/handlers/chat.test.ts`:

| Test | Asserts |
| --- | --- |
| Omitted `permissionMode` uses configured default | FR-2 |
| Explicit valid mode overrides the default | FR-4 |
| Invalid mode still returns 400 naming valid modes | Regression guard |

New, in `backend/cli/args.test.ts`:

| Test | Asserts |
| --- | --- |
| `--permission-mode plan` parses | FR-14 |
| `--permission-mode nonsense` exits non-zero | FR-15 |

### Frontend — Vitest + Testing Library, `make test-frontend`

Extend `frontend/src/hooks/chat/usePermissionMode.test.ts`:

| Test | Asserts |
| --- | --- |
| Initial mode is `"default"` with empty storage | FR-1 |
| Persisted mode is restored | FR-6 |
| Corrupt persisted value falls back without throwing | FR-7 |
| Cycling into bypass sets `pendingModeConfirmation`, not the mode | FR-10, FR-11 |
| Confirm applies the mode and sets `bypassAcknowledged` | FR-12 |
| Cancel leaves mode unchanged | FR-11 |
| Second bypass selection after acknowledgement skips the dialog | FR-12 |

New `frontend/src/components/chat/BypassConfirmDialog.test.tsx`:

| Test | Asserts |
| --- | --- |
| Renders the working directory | UX spec |
| Network sentence present only when non-loopback | UX spec |
| `Escape` cancels | FR-11 |
| Has `role="dialog"` and `aria-modal` | A11y |
| Focus moves into the dialog on open | A11y |

New in `frontend/src/utils/storage.test.ts`:

| Test | Asserts |
| --- | --- |
| v1 settings migrate, **preserving theme and enterBehavior** | §7.3's flagged bug |
| Legacy `PERMISSION_MODE` key is read then removed | FR-9 |
| Missing mode defaults to `"default"` | FR-5 |

### Cross-cutting

A single test asserting `INITIAL_PERMISSION_MODE === DEFAULT_PERMISSION_MODE` (FR-3). This
must live somewhere that imports both — likely a small frontend test importing the backend
constant, or a script in `make check`. Without it the two will drift, which is exactly the
failure this PRD is correcting.

### Manual verification

1. Clear `localStorage`, load the app → footer shows "Ask for approval."
2. Ask Claude to run `ls` → an approval prompt appears.
3. Cycle to bypass → dialog appears naming the working directory.
4. Cancel → mode unchanged.
5. Confirm → mode changes, indicator shows warning treatment.
6. **Reload** → still bypass, no dialog. *(This is the SEC-11 fix.)*
7. Cycle away and back to bypass → no dialog (acknowledged).
8. Start with `--permission-mode bypassPermissions --host 0.0.0.0` → startup warning appears.
9. `curl` a chat POST omitting `permissionMode` → server applies the configured default.

---

## 13. Rollout & migration

**This is a behavioural breaking change for every existing user**, and should be treated as
one.

- **Version**: minor bump (`0.3.0`), not a patch. `backend/package.json` is the single
  source of truth (`CLAUDE.md`, "Release Process").
- **Release notes**: must lead with the change. Auto-generated notes from merged PRs will
  not convey it adequately; write it explicitly.
- **Migration is automatic.** Existing users are routed through settings migration on first
  load and land on `"default"`. Users who want the old behaviour set it once, and it now
  persists — the fix and the escape hatch arrive together.
- **Operators** restore the old server default with `--permission-mode bypassPermissions`.
- **No feature flag.** The change is small, reversible in one commit, and a flag would leave
  the unsafe path alive in a shipped binary.
- **Docs must land in the same PR** as the code (FR-17). `README.md` and `CLAUDE.md` both
  currently document the old default in multiple places; shipping the code without them
  leaves the two most-read documents actively wrong.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Settings migration drops theme/enterBehavior** — the version bump discards non-matching stored settings and the current migration only reads legacy keys | **High** | Medium | Explicitly handle the v1→v2 object path, not just legacy keys. Dedicated test in §12. Called out in §7.3 as the most likely bug. |
| 2 | Prompt fatigue drives users to bypass faster than before | Medium | Medium | One-time acknowledgement (FR-12); sequence P24 (allowlist UI) soon after so `Read`/`Grep` can be permitted permanently |
| 3 | Existing users perceive a regression | High | Low | Lead the release notes with it; make the restore path one flag or one UI action |
| 4 | The two defaults drift again later | Medium | High | FR-3's cross-cutting test |
| 5 | Docs left stale, so README contradicts behaviour | Medium | Medium | FR-17; same PR |
| 6 | `--permission-mode` becomes an attractive-nuisance footgun in shell history | Low | Low | Startup warning already covers the dangerous combination |
| 7 | Users read the confirmation as alarmism and stop reading dialogs | Medium | Medium | Concrete path, conditional network sentence, non-destructive button styling |

---

## 15. Acceptance criteria

- [ ] `INITIAL_PERMISSION_MODE` is `"default"`
- [ ] `DEFAULT_PERMISSION_MODE` is `"default"`
- [ ] A test fails if the two diverge
- [ ] Permission mode persists across reload
- [ ] A corrupt persisted mode falls back to `"default"` without throwing
- [ ] Settings migration preserves existing `theme` and `enterBehavior`
- [ ] Legacy `STORAGE_KEYS.PERMISSION_MODE` is consumed then removed
- [ ] Selecting `bypassPermissions` shows a confirmation naming the working directory
- [ ] The confirmation's network sentence appears only on a non-loopback bind
- [ ] `Escape` cancels the confirmation, leaving the mode unchanged
- [ ] The confirmation does not reappear after acknowledgement
- [ ] The `bypassPermissions` indicator is distinguishable without relying on colour alone
- [ ] `--permission-mode` accepts all four modes and rejects anything else at startup
- [ ] `warnIfPermissionsExposed` evaluates the effective mode
- [ ] Startup logs name the effective mode
- [ ] `README.md` and `CLAUDE.md` reflect the new default everywhere they mention it
- [ ] `make check` passes

---

## 16. Open questions

1. **Should the default be `default` or `acceptEdits`?** `acceptEdits` auto-accepts file
   edits but still prompts for `Bash`, which may be the better balance for an agent-driven
   tool — most approvals are edits, and most risk is shell. This PRD specifies `default` as
   the conservative choice, but `acceptEdits` is a legitimate alternative worth deciding
   explicitly rather than by omission.
2. **How does the frontend learn the bind address** for the conditional network sentence?
   Options: a small `GET /api/config`; piggyback on an existing response; or drop the
   conditional and always show a softer sentence. Adding an endpoint for one boolean is
   arguably not worth it.
3. **Should `bypassAcknowledged` expire?** A user who acknowledged six months ago on a
   scratch repo may now be on a work machine. A per-project or time-based reset is
   defensible but adds state.
4. **Does `--permission-mode` belong in this PRD at all?** It is the operator escape hatch,
   but it also expands scope from "change two constants" to "add a flag, thread it through
   config, test it." Splitting it into a follow-up would keep P01 truly effort-1.
5. **Should the server reject `bypassPermissions` in request bodies when bound
   non-loopback?** This would close the §9 gap where an attacker simply asks for bypass. It
   is a meaningful hardening, but it changes the API contract and could break legitimate
   remote use. Probably belongs with P14.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Backend constants + comment rewrite | 0.5 h |
| `warnIfPermissionsExposed` signature + call sites | 1 h |
| `--permission-mode` flag + config threading | 2 h |
| `AppSettings` extension + version bump | 0.5 h |
| Migration logic **including the v1-object path** | 2 h |
| `usePermissionMode` persistence + confirmation state | 2 h |
| `BypassConfirmDialog` component | 2 h |
| Mode indicator warning treatment | 1 h |
| Backend tests | 2 h |
| Frontend tests | 3 h |
| Cross-cutting consistency test | 1 h |
| `README.md` + `CLAUDE.md` updates | 1.5 h |
| **Total** | **≈18.5 h — 2.5 days** |

Effort is scored **1** on the pack's scale because the *code* change is genuinely small and
touches no architecture. The wall-clock is dominated by tests and documentation, which is
the correct ratio for a change to a security default.

**Suggested split**: the flag (Open Question 4) can ship separately. Without it, this is
roughly 1.5 days.

---

## 18. References

- `frontend/src/hooks/chat/usePermissionMode.ts` — UI default, and the no-persistence comment
- `backend/utils/permissions.ts` — API default, validation, exposure warning
- `backend/handlers/chat.ts:120-131` — request-path resolution and 400 handling
- `frontend/src/utils/storage.ts:59-89` — the migration pattern to extend
- `frontend/src/utils/constants.ts:5-10` — keyboard shortcut definitions
- `shared/types.ts:13-21` — the wire doc comment that becomes false
- `README.md:286-306` — Security Considerations
- `CLAUDE.md` §Permission Mode Switching
- `../03-feature-comparison-matrix.md` — `SEC-03`, `SEC-11`
- `../04-uiux-workflow-comparison.md` §2 Journey F
- `../06-prioritization-and-roadmap.md` §2
