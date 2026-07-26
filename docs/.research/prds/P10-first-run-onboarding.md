# P10 — First-Run Onboarding

| Field | Value |
| --- | --- |
| **Priority** | **P10** of 30 |
| **Score** | **15.0** |
| **Inputs** | Value 3 · Reach 5 · GapWeight ×2.0 · Effort 2 |
| **Category** | Project & Workspace Management |
| **Matrix features** | `PROJ-08` (first-run onboarding) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui **4** |
| **Effort** | **2** |
| **Depends on** | **Overlaps P06** — must be designed jointly (see §3.1) |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio has no first-run experience. A new user installs it, runs it, and lands on the
launch screen with an empty Recent Projects panel, three unexplained buttons, and no
indication of what the application requires in order to work.

The most consequential gap is the **unvalidated prerequisite**. PDLC Studio is a front end
for the Claude Code CLI; it does nothing without a working, authenticated `claude` binary.
The README lists this first among prerequisites (`README.md:136`), and the project has
invested heavily in finding that binary — `backend/cli/validation.ts` is 195 lines of
universal path detection covering npm, pnpm, asdf, yarn, and Volta, with tracing-based
script-path resolution and version validation.

But **the result of all that detection is never shown to the user**. If the CLI is missing,
misconfigured, or unauthenticated, the failure surfaces much later, as a stream error in the
chat transcript after the user has already picked a project and typed a message. The README's
troubleshooting section exists precisely because this failure mode is common
(`README.md:185-221`), and it opens by naming the symptom users actually see:

> If you encounter "Claude Code process exited with code 1" or similar errors, this typically
> indicates Claude CLI path detection failure.

That is a diagnosable condition being reported as an opaque error at the worst possible
moment. The detection code already knows the answer at startup.

`04-uiux-workflow-comparison.md` §2 Journey A records the wider problem:

> No onboarding, no tour, no explanation of the three buttons… there is nothing telling the
> user that Claude CLI must be installed and authenticated first. If it isn't, the failure
> surfaces much later, as a stream error in chat.

### Why P10 rather than lower

Reach is **5** — every user has a first run, and every user who hits a CLI problem hits it
here. For an open-source tool competing for evaluation attention, the first ninety seconds
disproportionately determine whether there is a second session.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui treats onboarding as a first-class concern with **three dedicated modules**:

- `onboarding/view` — first-run guidance
- `project-creation-wizard` — multi-step project setup
- `provider-auth` — walks the user through connecting Claude, Codex, or Cursor credentials

Its login gate also forces a deliberate setup step before the user reaches the product, which
creates a natural place to validate configuration.

**PDLC Studio should take much less.** It has one provider, no authentication (until P14), and
a deliberately minimal single-surface UX whose "time to value" advantage
(`04-uiux-workflow-comparison.md` §6) must not be traded away for a tour. A multi-step wizard
would damage the thing the product is best at.

The lesson taken is narrow: **validate the prerequisite and explain the screen.** Not a tour,
not a wizard.

---

## 3. Goals & non-goals

### Goals

1. Detect and report Claude CLI problems **at startup**, not at first message.
2. Give actionable remediation, reusing the README's existing troubleshooting knowledge.
3. Explain what the launch screen's three actions do, for someone who has never seen it.
4. Do all of this without adding a step for users whose setup is already working.
5. Preserve time-to-value: a correctly-configured user should notice nothing.

### Non-goals

- **A multi-step wizard.** Contradicts the product's identity.
- **A feature tour or coach marks.** High annoyance, low retention.
- **Installing or authenticating the CLI on the user's behalf.** Out of scope and
  presumptuous; PDLC Studio should not run `npm install -g` or trigger an auth flow.
- **Account creation.** There are no accounts until P14, and P14 is not this.
- **The Recent Projects empty state itself** — that is P06. See §3.1.

### 3.1 The P06 overlap — resolve before starting either

P06 (Recent Projects cold-start fix) and P10 both define first-run behaviour for the same
screen. `06-prioritization-and-roadmap.md` and P06 §16 both flag this. Left uncoordinated,
they will produce two competing empty states.

**Recommended division, and this PRD is written assuming it:**

| Concern | Owner |
| --- | --- |
| "No projects yet" empty state in the Recent panel | **P06** |
| Making created/cloned projects appear immediately | **P06** |
| Claude CLI health check and remediation | **P10** |
| Explaining what the three actions do | **P10** |

P06 ships first (it ranks higher and is effort 1); P10 layers on top without touching the
empty state P06 introduced.

---

## 4. Personas & user stories

**Priya — first run, CLI not installed.**

> As a new user, I want to be told immediately that Claude CLI is missing, so that I am not
> ten minutes into evaluating a tool that was never going to work.

**Marcus — Volta user.** His `claude` is a shim; detection warns but may resolve.

> As a user with a non-standard Node setup, I want to know whether detection succeeded, so
> that I can pass `--claude-path` before hitting a confusing runtime error.

**Devon — installed the CLI but never authenticated.**

> As a user, I want to know that the CLI is present but not logged in, so that I run
> `claude login` rather than reinstalling.

**Sam — everything is fine.**

> As a correctly-configured user, I want to reach the launch screen with no extra clicks, so
> that onboarding is not a tax on people who do not need it.

Sam's story is the constraint that shapes the whole design.

---

## 5. Functional requirements

### CLI health

- **FR-1** The backend **MUST** expose the result of Claude CLI detection and validation to
  the frontend.
- **FR-2** The health result **MUST** distinguish at least: **not found**, **found but
  unusable** (e.g. version check failed), **found but not authenticated** (if detectable),
  and **healthy**.
- **FR-3** Where detection resolved a path, that path **MUST** be reported, so a user can see
  which binary was chosen.
- **FR-4** A health check **MUST NOT** block server startup.
- **FR-5** The frontend **MUST** query health on load of the launch screen.
- **FR-6** A failed health check **MUST NOT** prevent the user from browsing or opening a
  project — it is advisory, not a gate.

### Remediation

- **FR-7** An unhealthy state **MUST** present concrete remediation, not a generic error.
- **FR-8** Remediation **MUST** include the `--claude-path "$(which claude)"` escape hatch
  documented in `README.md:191-195`.
- **FR-9** Where the user's environment suggests a version manager, remediation **SHOULD**
  name the specific command (`volta which claude`, `asdf which claude`) as the README does.
- **FR-10** Remediation **MUST** link to the README's troubleshooting section rather than
  duplicating it wholesale.
- **FR-11** The user **MUST** be able to re-run the check without restarting the server.

### Launch screen explanation

- **FR-12** On first run only, the launch screen **MUST** briefly explain what the three
  actions do.
- **FR-13** That explanation **MUST** be dismissible and **MUST NOT** reappear once
  dismissed or once a project has been opened.
- **FR-14** It **MUST NOT** be a modal, and **MUST NOT** block interaction.
- **FR-15** "First run" **MUST** be determined by persisted state, not by an empty project
  list — a user with no projects is not necessarily a new user.

### Accessibility

- **FR-16** Health warnings **MUST** be conveyed by text and icon, not colour alone.
- **FR-17** The health region **MUST** be an `aria-live="polite"` region so a state change is
  announced.
- **FR-18** Remediation commands **MUST** be selectable text, and **SHOULD** reuse P03's copy
  control.
- **FR-19** The dismissible explanation **MUST** be keyboard-dismissible and **MUST NOT**
  trap focus.

---

## 6. UX & interaction specification

### Healthy — the common case

**Nothing changes.** No banner, no badge, no delay. Sam's story is satisfied by absence.
The only first-run addition is the dismissible explanation (FR-12), which sits within the
existing layout rather than over it.

### Unhealthy

A banner above the launch panel — not a modal (FR-14), because the user must still be able
to browse projects (FR-6):

```
┌────────────────────────────────────────────────────────┐
│ ⚠  Claude CLI not found                                │
│                                                        │
│ PDLC Studio needs the Claude Code CLI installed and    │
│ authenticated. Nothing will run until it is available. │
│                                                        │
│ If it is installed but not being found, start with an  │
│ explicit path:                                         │
│                                                        │
│   pdlc-studio --claude-path "$(which claude)"   [⧉]    │
│                                                        │
│ Volta or asdf users: use `volta which claude` or       │
│ `asdf which claude` instead.                           │
│                                                        │
│ [ Check again ]              [ Troubleshooting guide ] │
└────────────────────────────────────────────────────────┘
```

Variants by state (FR-2):

| State | Heading | Emphasis |
| --- | --- | --- |
| Not found | "Claude CLI not found" | Installation and `--claude-path` |
| Found, unusable | "Claude CLI found but not working" | Show the resolved path (FR-3); version mismatch |
| Found, not authenticated | "Claude CLI not signed in" | `claude login` — **not** reinstallation |
| Healthy | *(no banner)* | — |

Distinguishing "not authenticated" from "not found" is the highest-value part of this
design: they have completely different fixes, and today both surface as the same opaque
"exited with code 1".

### First-run explanation

```
┌──────────────────────────────┬─────────────────────┐
│  ◈ PDLC Studio               │  Recent Projects    │
│                              │                     │
│  Pick a folder to work in —  │  (P06's empty state)│
│  Claude will read and write  │                     │
│  files there.           [✕]  │                     │
│                              │                     │
│  [ Create New Project… ]     │                     │
│  [ Clone Git Repository… ]   │                     │
│  [ Open Existing Project… ]  │                     │
└──────────────────────────────┴─────────────────────┘
```

One sentence, inline, dismissible. It says the one thing that is not obvious from the button
labels: **that the chosen folder is where Claude will read and write**. That is the piece a
new user genuinely cannot infer, and it is also a quiet safety message.

Compose from Astryx callout/banner primitives. **No new CSS classes** — `CLAUDE.md` restricts
app CSS to the existing app-shell and `.launch-*` classes.

### States

| State | Behaviour |
| --- | --- |
| Health check in flight | No banner — **do not flash a warning** before the result arrives |
| Healthy | No banner |
| Unhealthy | Banner with state-specific remediation |
| Re-check in flight | Button shows progress; banner stays |
| Re-check now healthy | Banner disappears; announced politely (FR-17) |
| Health endpoint unreachable | No banner — a failed meta-check must not become its own error |

That last row matters: if the health endpoint itself fails, showing "cannot determine CLI
health" is noise. Fail silent.

---

## 7. Technical design

### 7.1 Backend — reuse the detection that already runs

`backend/cli/validation.ts` (195 lines) already implements `detectClaudeCliPath()` and
`validateClaudeCli()`, described in `CLAUDE.md` as: auto-discovery in PATH, script-path
tracing with a temporary node wrapper, version validation with `claude --version`, and
fallback handling with logging.

This runs at startup and produces `cliPath`, which reaches handlers via `c.var.config`
(`backend/handlers/chat.ts:113`). **The information exists; it is simply not exposed.**

New endpoint:

```
GET /api/health/cli
```

```ts
export type CliHealthState =
  | "healthy"
  | "not-found"
  | "unusable"
  | "not-authenticated"
  | "unknown";

export interface CliHealthResponse {
  state: CliHealthState;
  path?: string;        // FR-3
  version?: string;
  detail?: string;      // stderr excerpt, for the unusable case
  checkedAt: string;
}
```

> **Route naming.** This sits under `/api/health/`, not `/api/projects/`, so it avoids the
> route-ordering constraint documented in `CLAUDE.md` entirely. Deliberate — see P06 and P08,
> both of which have to reason about ordering.

### 7.2 Detecting the authentication state

**This is the hard part and the main open question.**

`validateClaudeCli()` runs `claude --version`, which succeeds whether or not the user is
authenticated. So version validation cannot distinguish "installed" from "signed in".

Options, in order of preference:

| Approach | Assessment |
| --- | --- |
| A cheap CLI subcommand that reports auth state | Ideal if one exists. **Must be investigated.** |
| Inspect credential files under `~/.claude/` | Fragile — an undocumented format that may change |
| Attempt a trivial query and classify the error | Costs tokens and latency; unacceptable at startup |
| **Do not detect; classify at first failure instead** | Fallback: keep `not-authenticated` out of the startup check, and improve the *error* the user sees when a session fails |

If no cheap check exists, **FR-2 degrades to three states** (`healthy`, `not-found`,
`unusable`) and the authentication case is handled by improving the first-message error
instead. The PRD still delivers most of its value; §16 records this.

### 7.3 Re-check (FR-11)

`GET /api/health/cli` should re-run detection rather than return a cached startup result, so
"Check again" is meaningful after the user installs the CLI or fixes their PATH.

Detection involves spawning a process and tracing paths, so it is not free. Cache for a few
seconds to prevent a user hammering the button from spawning a process per click.

**Startup must not block on it** (FR-4) — the existing startup path already logs detection
results, and the endpoint can re-derive on demand.

### 7.4 Environment hints (FR-9)

The README names Volta and asdf specifically. Detecting which is in use is possible —
checking for `VOLTA_HOME` or `ASDF_DIR` in the environment, or for the manager's directories
in the resolved path — but it is heuristic.

Recommendation: **show all the variants rather than guessing wrong.** The banner has room
for one line naming both, as the mock in §6 does. A wrong guess is worse than a short list.

### 7.5 Frontend

| Item | Purpose |
| --- | --- |
| New `frontend/src/hooks/useCliHealth.ts` | Fetch, re-check, state |
| New `frontend/src/components/CliHealthBanner.tsx` | The banner |
| New `frontend/src/components/FirstRunHint.tsx` | The dismissible explanation |
| Modify `frontend/src/components/ProjectSelector.tsx` | Mount both |

**First-run state (FR-15)** persists in `AppSettings` via `useSettings`, as
`hasSeenLaunchHint: boolean`. Note that **P01 and P09 both bump
`CURRENT_SETTINGS_VERSION`**; whichever lands last extends the same migration rather than
writing a parallel one. This is now a three-way coordination point and is worth tracking.

Copy controls for the remediation command (FR-18) reuse P03's `CopyButton` if P03 has
shipped; otherwise plain selectable text, with the control added later.

### 7.6 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| CLI detection and validation | `detectClaudeCliPath`, `validateClaudeCli` | `backend/cli/validation.ts` |
| Resolved path on request context | `c.var.config` | `backend/middleware/config.ts` |
| Structured logging | `logger.cli` | `backend/utils/logger.ts` |
| Settings persistence | `AppSettings`, `useSettings` | `frontend/src/utils/storage.ts` |
| Copy control | `CopyButton` (P03) | `frontend/src/components/chat/` |
| Launch layout | `.launch-*` | `frontend/src/index.css` |

---

## 8. Data model & persistence

| Datum | Store | Lifetime |
| --- | --- | --- |
| `hasSeenLaunchHint` | `AppSettings` in `localStorage` | Until cleared |
| CLI health result | Server memory, briefly cached | Seconds |

No database, no new files on disk. Note this deliberately differs from P06, which proposes a
JSON sidecar — the first-run flag is a browser-level UI preference, not machine state.

---

## 9. Security implications

Two things, both modest but worth stating.

**1. The health endpoint reveals a filesystem path.** `CliHealthResponse.path` exposes where
the `claude` binary lives, which leaks a little about the machine's layout. On an
unauthenticated API this is a real, if small, disclosure.

It is far less than what is already exposed: `GET /api/directories` browses the filesystem
unconfined, and `GET /api/projects` returns project paths. So this adds nothing
qualitatively new — but it should be a deliberate decision rather than an accident, and it is
another small entry on the list of reasons P14 matters.

**2. Remediation text must not be constructed from untrusted input.** The suggested commands
are static strings. The resolved path is *displayed* (FR-3) but must be rendered as text and
never interpolated into a command the UI offers to copy — a path containing shell
metacharacters would otherwise produce a copyable command that does something unintended.
Show the path; keep the copyable command literal.

No new write surface. No new process execution beyond re-running detection the server
already performs.

---

## 10. Performance & scale

Detection spawns a process and traces paths — meaningfully more expensive than a typical
request. Mitigations: the short cache (§7.3), no blocking at startup (FR-4), and one call per
launch-screen load rather than polling.

---

## 11. Telemetry & observability

Server-side, via `backend/utils/logger.ts`:

- Detection already logs its results and fallbacks (`CLAUDE.md`, "Claude CLI Path
  Detection"). Unchanged.
- `logger.cli.debug` on each health request, recording the resolved state.

No client analytics.

---

## 12. Test plan

### Backend — Deno test runner, `make test-backend`

New `backend/handlers/health.test.ts`:

| Test | Asserts |
| --- | --- |
| Healthy CLI returns `state: "healthy"` with path and version | FR-1, FR-2, FR-3 |
| Missing binary returns `not-found` | FR-2 |
| Version check failure returns `unusable` with detail | FR-2 |
| Repeated calls within the cache window do not re-spawn | §7.3 |
| Call after the cache window re-runs detection | FR-11 |
| Endpoint failure does not throw unhandled | Robustness |

Extend `backend/cli/validation` tests if present, or add coverage for the classification
mapping between validation results and `CliHealthState`.

### Frontend — Vitest, `make test-frontend`

New `frontend/src/hooks/useCliHealth.test.ts`:

| Test | Asserts |
| --- | --- |
| Fetches on mount | FR-5 |
| Re-check triggers a new request | FR-11 |
| **Endpoint failure yields no banner state** | §6 states table |
| In-flight state does not report unhealthy | §6 states table |

New `frontend/src/components/CliHealthBanner.test.tsx`:

| Test | Asserts |
| --- | --- |
| Renders nothing when healthy | §6 |
| **Renders nothing while the check is in flight** | §6 — no warning flash |
| Not-found state shows install and `--claude-path` guidance | FR-7, FR-8 |
| Unusable state shows the resolved path | FR-3 |
| Not-authenticated state suggests sign-in, **not** reinstall | FR-2, FR-7 |
| Warning conveyed by text and icon, not colour alone | FR-16 |
| Region is `aria-live="polite"` | FR-17 |
| Does not block project selection | FR-6 |

New `frontend/src/components/FirstRunHint.test.tsx`:

| Test | Asserts |
| --- | --- |
| Shown when `hasSeenLaunchHint` is false | FR-12 |
| Hidden once dismissed | FR-13 |
| Hidden after a project has been opened | FR-13 |
| **Not shown merely because the project list is empty** | FR-15 |
| Keyboard-dismissible; no focus trap | FR-19 |
| Not a modal | FR-14 |

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Rename `claude` off PATH, start the server → banner shows not-found with remediation.
2. Restore it, click "Check again" → banner disappears, announced politely.
3. Start with `--claude-path /nonexistent` → unusable state showing the path.
4. Clear settings → first-run hint appears; dismiss → gone; reload → still gone.
5. Clear settings, open a project without dismissing → hint gone next time (FR-13).
6. Stop the backend and load the launch screen → **no health banner**, no error noise.
7. Confirm a healthy setup adds zero clicks between launch and chat.

---

## 13. Rollout & migration

- Additive. New endpoint, new components, one new settings field.
- **Existing users**: `hasSeenLaunchHint` defaults to `false`, so they will see the hint once.
  Acceptable — it is one dismissible sentence. Alternatively, default it to `true` during
  migration so only genuinely new installs see it. **Recommendation: default `true` on
  migration**, `false` for fresh settings.
- Settings version bump — coordinate with P01 and P09 (§7.5).
- Ship after P06, per §3.1.
- Minor release.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **No cheap way to detect authentication state** | **Medium** | Medium | §7.2 fallback to three states; improve the first-message error instead |
| 2 | Warning banner flashes before the check resolves | Medium | Medium | §6 states table; explicit test |
| 3 | Onboarding taxes correctly-configured users | Medium | **High** | Healthy path shows nothing; one dismissible sentence only |
| 4 | Duplicate/competing empty states with P06 | **High** if uncoordinated | Medium | §3.1 division of ownership; ship P06 first |
| 5 | Settings version bump collides with P01 and P09 | **Medium** | Medium | Single shared migration; three-way coordination noted in §7.5 |
| 6 | Health check spawns a process per click | Medium | Medium | Short cache (§7.3) |
| 7 | Health endpoint failure becomes its own error state | Medium | Low | Fail silent (§6) |
| 8 | Existing users see a first-run hint they do not need | Medium | Low | Default `true` on migration (§13) |
| 9 | Resolved path with shell metacharacters in a copyable command | Low | Medium | §9 — display the path, keep copyable commands literal |

---

## 15. Acceptance criteria

- [ ] `GET /api/health/cli` reports state, path, and version
- [ ] States distinguish not-found from unusable (and not-authenticated if detectable)
- [ ] Startup is not blocked by the check
- [ ] Frontend queries health on launch-screen load
- [ ] Unhealthy state never blocks project selection
- [ ] **No banner while the check is in flight**
- [ ] **No banner when the health endpoint itself fails**
- [ ] Remediation includes `--claude-path "$(which claude)"`
- [ ] Volta and asdf variants named
- [ ] Links to the README troubleshooting section
- [ ] "Check again" re-runs detection without a restart
- [ ] Not-authenticated guidance says sign in, not reinstall
- [ ] First-run hint explains that the chosen folder is where Claude reads and writes
- [ ] Hint is inline, dismissible, non-modal, keyboard-dismissible
- [ ] Hint determined by persisted state, not an empty project list
- [ ] Warning conveyed by text and icon, not colour alone
- [ ] Health region is `aria-live="polite"`
- [ ] Healthy users see no additional steps
- [ ] `make check` passes

---

## 16. Open questions

1. **Is there a cheap CLI command that reports authentication state?** Blocking for FR-2's
   most valuable distinction. If not, §7.2's fallback applies and the value shifts to
   improving the first-message error — which is worth doing regardless.
2. **Should P06's empty state and P10's hint be one component?** §3.1 separates them, but they
   occupy adjacent space and could read as clutter together. Worth reviewing visually once
   both exist.
3. **Should the health banner also appear on `/projects/*`**, not just the launch screen? A
   user who leaves the app open while their CLI breaks would otherwise only learn at the next
   message. Recommendation: launch screen only for now; revisit if reported.
4. **Should remediation offer to re-run with `--claude-path` automatically?** Tempting, but
   the server cannot restart itself cleanly and this edges toward the rejected "install on
   the user's behalf" non-goal.
5. **Default `hasSeenLaunchHint` to `true` or `false` for existing users?** §13 recommends
   `true`, on the grounds that an established user does not need onboarding.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Investigate auth-state detection (§7.2) | 2 h |
| `GET /api/health/cli` endpoint + classification | 3 h |
| Short-lived cache + re-check | 1.5 h |
| Shared types | 0.5 h |
| `useCliHealth` hook | 2 h |
| `CliHealthBanner` with four state variants | 4 h |
| `FirstRunHint` + settings field + migration | 2.5 h |
| `ProjectSelector` integration | 1 h |
| Backend tests | 3 h |
| Frontend tests | 4 h |
| Manual verification incl. broken-CLI scenarios | 2 h |
| **Total** | **≈25.5 h — 3.5 days** |

---

## 18. References

- `backend/cli/validation.ts` (195 lines) — `detectClaudeCliPath`, `validateClaudeCli`
- `backend/middleware/config.ts` — how `cliPath` reaches handlers
- `backend/handlers/chat.ts:113` — `c.var.config` usage
- `frontend/src/components/ProjectSelector.tsx` — the launch screen
- `frontend/src/index.css` — `.launch-*` layout chrome
- `README.md:134-139` — prerequisites
- `README.md:185-221` — troubleshooting, `--claude-path`, Volta/asdf guidance
- `CLAUDE.md` § "Claude CLI Path Detection"
- `CLAUDE.md` § "Launch screen"
- `../01-claudecodeui-deep-scan.md` §3.4 — competitor's onboarding modules
- `../03-feature-comparison-matrix.md` — `PROJ-08`
- `../04-uiux-workflow-comparison.md` §2 Journey A, §6
- `P06-recent-projects-cold-start-fix.md` §16 — the overlap this PRD resolves
