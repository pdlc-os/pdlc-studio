# P06 — Recent Projects Cold-Start Fix

| Field | Value |
| --- | --- |
| **Priority** | **P06** of 30 |
| **Score** | **18.0** |
| **Inputs** | Value 3 · Reach 4 · GapWeight ×1.5 · Effort 1 |
| **Category** | Project & Workspace Management |
| **Matrix features** | `PROJ-05` (recent projects list) |
| **Maturity** | PDLC Studio **3** → target **4** · claudecodeui **4** |
| **Effort** | **1** |
| **Depends on** | Nothing |
| **Blocks** | P10 (onboarding) overlaps — see §3 |
| **Status** | Proposed |

---

## 1. Context & problem statement

The launch screen's Recent Projects panel is **empty for every new user**, and stays empty
after they create or clone their first project.

The cause is precise and visible in `backend/handlers/projects.ts:30-40`:

```ts
for (const path of projectPaths) {
  const encodedName = await getEncodedProjectName(path);
  // Only include projects that have history directories
  if (encodedName) {
    projects.push({ path, encodedName });
  }
}
```

`getEncodedProjectName` returns `null` when no Claude Code history directory exists for a
path, and such projects are silently dropped. `CLAUDE.md` documents the consequence
plainly:

> **Recent Projects comes from `~/.claude.json`** and only lists directories that already
> have conversation history, so a newly created or cloned directory will not appear there
> until it has been used.

So the launch screen's most prominent panel — occupying the full right-hand 40% of an
Xcode-style split — is blank at exactly the moment a new user is deciding whether this tool
works. `04-uiux-workflow-comparison.md` §2 Journey A identifies this as the product's
cold-start problem: *"a new user sees an empty panel where the app's most prominent
affordance should be, with no text explaining why."*

There are really **three** distinct defects bundled here:

1. **New users see an empty panel with no explanation.** There is no empty state telling
   them what the panel is for or what to do.
2. **A just-created or just-cloned project does not appear.** The user completes a
   deliberate "Create New Project…" flow and the result is invisible in the list of
   projects. That reads as a bug even though it is documented behaviour.
3. **The filter is silent.** A user with projects in `~/.claude.json` that lack history
   directories has no way to know why they are missing.

### Why P06 rather than lower

Effort 1, reach 4 — every user encounters the launch screen every time they start the app,
and every new user encounters the empty state. It is also the cheapest meaningful
improvement to first impressions, which matters disproportionately for an evaluation-stage
open-source tool.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui maintains a **`projects` table in SQLite** (`server/index.js`) rather than
deriving the list from Claude's config, and pairs it with a dedicated
`project-creation-wizard` module and an `onboarding/` module.

Because its project list is its own persisted data rather than a filtered view of someone
else's file, a newly created project appears immediately. That is the structural difference.

**PDLC Studio should not adopt SQLite** — `SESS-04` is explicitly rejected in
`06-prioritization-and-roadmap.md` §4 as incompatible with single-binary distribution. The
useful lesson is narrower: *the project list should reflect what the user has actually
opened, not only what Claude Code has already written history for.*

---

## 3. Goals & non-goals

### Goals

1. A project the user creates, clones, or opens appears in Recent Projects immediately.
2. The empty state explains what the panel is and what to do, rather than showing nothing.
3. Entries that no longer exist on disk are handled gracefully rather than erroring on
   click.
4. Ordering reflects genuine recency.
5. No database, no new runtime dependency.

### Non-goals

- **Full onboarding.** That is P10. This PRD fixes the empty state; P10 addresses the wider
  first-run experience including the Claude CLI prerequisite. They overlap and should be
  designed together — see §16.
- **Project rename or removal.** `PROJ-06`, deferred.
- **Favourites or pinning.** `PROJ-09`, deferred.
- **Per-project settings.** `PROJ-07`, deferred pending a persistence decision.
- **Changing `~/.claude.json`.** That file belongs to Claude Code. This PRD reads it and
  must not write it.

---

## 4. Personas & user stories

**Priya — first run.**

> As a new user, I want the empty Recent Projects panel to tell me what it is for, so that I
> do not wonder whether the app has failed to load something.

**Marcus — just cloned a repository.**

> As a user who has just cloned a repo through the app, I want it in my recent list, so that
> reopening it tomorrow does not mean navigating the folder picker again.

**Devon — moved a project directory.**

> As a user whose project has moved, I want a stale entry to tell me it is missing rather
> than failing silently when I click it.

---

## 5. Functional requirements

### Recency tracking

- **FR-1** Opening a project — by any of the three launch-screen paths — **MUST** record it
  as recently opened.
- **FR-2** Recent Projects **MUST** be the union of Claude Code's known projects and the
  app's own recently-opened list, de-duplicated by resolved absolute path.
- **FR-3** Ordering **MUST** be most-recent-first, using the app's own timestamp where
  available.
- **FR-4** The list **MUST** be capped at a sensible maximum (10–15) with the oldest entries
  evicted.
- **FR-5** Paths **MUST** be compared after normalisation, so that `~/code/x`, `~/code/x/`,
  and a symlinked equivalent do not produce duplicate rows.
- **FR-6** `~/.claude.json` **MUST NOT** be written to.

### Existence handling

- **FR-7** Each entry **SHOULD** be checked for existence when the list is rendered.
- **FR-8** An entry whose directory no longer exists **MUST** be visually marked as
  unavailable rather than hidden — silently disappearing is what makes the current behaviour
  confusing.
- **FR-9** Activating an unavailable entry **MUST** show a clear message and offer removal,
  not navigate into a broken state.
- **FR-10** Existence checks **MUST NOT** block the initial render.

### Empty state

- **FR-11** With no recent projects, the panel **MUST** render an explanatory empty state,
  not blank space.
- **FR-12** The empty state **MUST** direct the user to the three actions on the left.
- **FR-13** It **MUST NOT** be an error or warning treatment — having no projects yet is
  normal.

### Transparency

- **FR-14** Where entries exist in `~/.claude.json` but were filtered out, the UI **SHOULD**
  make that discoverable rather than silent.

### Accessibility

- **FR-15** The list **MUST** be a semantic list with each entry keyboard-activatable.
- **FR-16** Unavailable entries **MUST** convey that state to assistive technology, not by
  styling alone.
- **FR-17** The empty state **MUST** be readable in reading order, not presented as
  decorative.

---

## 6. UX & interaction specification

### Empty state

```
┌────────────────────────────────┐
│  Recent Projects               │
│                                │
│      ┌──────────┐              │
│      │    ◈     │              │
│      └──────────┘              │
│                                │
│   No projects yet              │
│                                │
│   Create, clone, or open a     │
│   folder to get started —      │
│   your recent projects will    │
│   appear here.                 │
│                                │
└────────────────────────────────┘
```

Neutral tone (FR-13). Uses the app mark via `AppIcon`, which already handles optical sizing.

### Populated list

```
┌────────────────────────────────┐
│  Recent Projects               │
│                                │
│  ▸ pdlc-studio                 │
│    ~/code/pdlc-studio          │
│                                │
│  ▸ api-gateway                 │
│    ~/work/api-gateway          │
│                                │
│  ▸ old-experiment      ⚠ moved │
│    ~/tmp/old-experiment        │
│                                │
└────────────────────────────────┘
```

- Directory basename as the primary label; full path, home-abbreviated, as secondary.
- Unavailable entries stay visible with a marker (FR-8) and reduced emphasis — but the
  marker must not be colour-only (FR-16).

### Interaction

| Action | Result |
| --- | --- |
| Click / Enter on an available entry | Open the project |
| Click / Enter on an unavailable entry | Inline message + "Remove from list" |
| Tab | Moves through entries in order |

### States

| State | Behaviour |
| --- | --- |
| Loading | Brief skeleton or nothing — **must not** flash the empty state before data arrives |
| Empty | FR-11 empty state |
| Populated | List, most recent first |
| Some unavailable | Rendered inline with markers |
| Fetch failed | Error state with retry; **not** the empty state — they mean different things |

The loading-versus-empty distinction matters: flashing "No projects yet" for 200 ms on every
launch would be worse than the current behaviour.

---

## 7. Technical design

### 7.1 Where recency is stored

PDLC Studio has **no database**, and this PRD adds none. Two viable stores:

| Option | Assessment |
| --- | --- |
| **`localStorage`** | Zero backend change. But it is per-browser — the list would not follow a user between Chrome and Safari, and would be empty in a fresh profile despite projects existing. |
| **A JSON sidecar** under `~/.claude/` (e.g. `pdlc-studio-recents.json`) | Machine-scoped, survives browser changes, matches how the app already reads machine state from `~/.claude.json`. Requires a small backend read/write. |

**Recommendation: the JSON sidecar.** The list describes machine state (which directories
exist and were opened), not browser preference. `localStorage` would produce the confusing
result of a populated list in one browser and an empty one in another on the same machine.

The file **must be separate from `~/.claude.json`** (FR-6) — that file belongs to Claude
Code and writing it risks corrupting another tool's state.

### 7.2 Backend

**Modify `backend/handlers/projects.ts`.** The current loop drops entries where
`getEncodedProjectName` returns `null` (lines 30-40). The fix is to keep them and mark them:

```ts
export interface ProjectInfo {
  path: string;
  encodedName: string | null;   // null → no Claude history yet
  lastOpened?: string;          // ISO timestamp from the sidecar
  exists?: boolean;             // FR-7
}
```

`encodedName` becoming nullable is a **wire contract change** in `shared/types.ts`. Every
consumer must be checked — it is used to build history URLs
(`/api/projects/:encodedProjectName/histories`), and a `null` must mean "no history to
fetch" rather than a malformed request.

**New endpoint** `POST /api/projects/recent` recording an opened path, and the sidecar read
folded into `GET /api/projects`.

> **Route-ordering constraint**: `CLAUDE.md` is explicit that literal `/api/projects/*`
> routes must be registered **before** the parameterised
> `/api/projects/:encodedProjectName/...` routes, or the literal is captured as a project
> name. `recent` must follow `create` and `clone` in that ordering.

**Existence checks** reuse `exists()` from `backend/utils/fs.ts`, already used by
`backend/handlers/directories.ts`.

### 7.3 Path normalisation

FR-5 needs one canonical function. `backend/utils/paths.ts` (135 lines) already contains
`resolveBrowsePath` and has its own test file (`paths.test.ts`, 98 lines) — the
normalisation helper belongs there, next to the existing path logic, and inherits that test
file.

Note the sharp edge: symlink resolution changes whether two paths are "the same". Resolving
symlinks is more correct but means the recorded path may differ from what the user picked.
Recommendation: normalise separators and trailing slashes and expand `~`, but **do not**
resolve symlinks — the user's chosen path is the one to show them.

### 7.4 Frontend

| Component | Change |
| --- | --- |
| `frontend/src/components/ProjectSelector.tsx` | Empty state, unavailable markers, ordering |
| `frontend/src/components/NewProjectDialog.tsx` | Record on success |
| `frontend/src/components/CloneRepositoryDialog.tsx` | Record on success |
| `frontend/src/components/DirectoryPickerDialog.tsx` | Record on open |

All three dialogs converge on "a directory path that gets opened as a project"
(`CLAUDE.md`, "Launch screen"), so the recording call belongs at that convergence point —
one place, not three. Whatever handler receives the chosen path in `ProjectSelector` is the
right home.

The `.launch-*` classes in `frontend/src/index.css` already own the split-panel chrome.
`CLAUDE.md` explains why they exist (Astryx has no split-panel primitive and `Card` cannot
clip a child's background to its own corners) and directs that everything inside be composed
from Astryx components. **The empty state must be Astryx composition, not new CSS.**

### 7.5 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Existence check | `exists()` | `backend/utils/fs.ts` |
| Path resolution | `resolveBrowsePath` + tests | `backend/utils/paths.ts` |
| Encoded-name lookup | `getEncodedProjectName` | `backend/history/pathUtils.ts` |
| Home directory | `getHomeDir()` | `backend/utils/os.ts` |
| App mark for the empty state | `AppIcon` | `frontend/src/components/AppIcon.tsx` |
| Layout chrome | `.launch-*` | `frontend/src/index.css` |

---

## 8. Data model & persistence

New file, `~/.claude/pdlc-studio-recents.json`:

```json
{
  "version": 1,
  "recents": [
    { "path": "/Users/me/code/pdlc-studio", "lastOpened": "2026-07-26T18:40:00Z" }
  ]
}
```

| Property | Decision |
| --- | --- |
| Location | Under `~/.claude/`, alongside state the app already reads |
| Format | JSON, versioned for future migration |
| Size | Capped at FR-4's maximum; bounded by construction |
| Failure mode | **Missing or corrupt file MUST degrade to the current behaviour**, never error |
| Concurrency | Two instances could race. Last-write-wins is acceptable; the data is not precious |

That failure mode is the important one: a corrupt sidecar must never prevent the launch
screen from rendering. Read it in a `try`, fall back to `[]`.

---

## 9. Security implications

Small, but not zero.

**New write surface.** The app currently writes nothing to the user's home directory. This
PRD introduces one file. It must:

- Write only to the fixed path, never to a path derived from user input.
- Contain only directory paths the user explicitly chose.
- Never be executed, interpolated into a shell, or used to construct a command.

**Information exposure.** The sidecar records directory paths. Anyone who can read the home
directory can already read `~/.claude.json`, which contains the same class of information —
so this adds no meaningful exposure.

**Existence checking as a probe.** `GET /api/projects` would now stat paths. Since paths come
only from files the user's own account owns, this is not a new capability. Note that
`backend/handlers/directories.ts` already documents the broader position: the API is
deliberately unconfined for filesystem *reads*, justified on the grounds that
`/api/chat` can run arbitrary shell commands anyway.

> **Cross-PRD note.** P01 changes the default permission mode away from
> `bypassPermissions`. That weakens the justification quoted in `directories.ts`'s header
> comment, which reasons that unconfined reads are "not an escalation of what the API can
> already do." After P01, the API's default capability is smaller, and the comment should be
> revisited. This PRD does not change that behaviour, but P07 (file viewer) will have to
> confront it directly.

---

## 10. Performance & scale

The list is capped (FR-4), so at most ~15 `stat` calls per launch-screen load. Negligible,
but FR-10 requires they not block initial render — resolve existence asynchronously and
mark entries as they resolve.

---

## 11. Telemetry & observability

Server-side, via `backend/utils/logger.ts`:

- `logger.api.warn` when the sidecar is unreadable or corrupt, before falling back.
- Existing error logging in `handleProjectsRequest` is unchanged.

No client-side analytics.

---

## 12. Test plan

### Backend — Deno test runner, `make test-backend`

New `backend/handlers/projects.test.ts`:

| Test | Asserts |
| --- | --- |
| Projects without history are **included**, with `encodedName: null` | Core fix |
| Projects with history keep their encoded name | Regression |
| Sidecar entries merge with `~/.claude.json` entries | FR-2 |
| Duplicates de-duplicated after normalisation | FR-5 |
| Ordering is most-recent-first | FR-3 |
| List capped at the maximum | FR-4 |
| Missing sidecar degrades to config-only behaviour | §8 |
| **Corrupt sidecar degrades without throwing** | §8 |
| Missing `~/.claude.json` returns an empty list, not an error | Existing behaviour |
| `~/.claude.json` is never written | FR-6 |

Extend `backend/utils/paths.test.ts`:

| Test | Asserts |
| --- | --- |
| Trailing slash normalised | FR-5 |
| `~` expanded | FR-5 |
| Separators normalised | FR-5 |
| Symlinks **not** resolved | §7.3 decision |

New route-ordering test: `POST /api/projects/recent` is not captured as a project name.

### Frontend — Vitest, `make test-frontend`

Extend/add `frontend/src/components/ProjectSelector.test.tsx`:

| Test | Asserts |
| --- | --- |
| Empty state renders with explanatory text | FR-11, FR-12 |
| **Empty state does not flash during loading** | States table |
| Fetch failure shows an error state, not the empty state | States table |
| Unavailable entries render with a non-colour-only marker | FR-8, FR-16 |
| Activating an unavailable entry offers removal | FR-9 |
| Entries are a semantic list, keyboard-activatable | FR-15 |
| Opening a project records it | FR-1 |

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Move `~/.claude/pdlc-studio-recents.json` aside and clear `~/.claude.json` projects →
   empty state renders with text, not blank.
2. Create a new project → **appears in Recent Projects immediately**. This is the headline
   fix.
3. Clone a repository → same.
4. Open an existing directory with no Claude history → appears.
5. Move a project on disk, reload → marked unavailable, not hidden.
6. Activate the unavailable entry → clear message and removal offer.
7. Corrupt the sidecar with invalid JSON → launch screen still renders.
8. Confirm `~/.claude.json` is byte-identical after all of the above.

---

## 13. Rollout & migration

- **New file created on first project open.** Absence is the normal starting state and is
  handled (§8).
- **`ProjectInfo.encodedName` becomes nullable** — a shared-type change. Since frontend and
  backend ship together in one binary and one npm package, there is no version-skew concern.
- No user-facing migration.
- Minor release.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Nullable `encodedName` breaks history fetching** for projects without history | **Medium** | **High** | Audit every consumer; `null` must mean "no history", not a malformed URL. Explicit test. |
| 2 | Corrupt sidecar breaks the launch screen | Medium | **High** | Read in a `try`, fall back to `[]`; dedicated test |
| 3 | Empty state flashes during load | **Medium** | Medium | Distinguish loading from empty; explicit test |
| 4 | Writing near `~/.claude.json` corrupts Claude Code's own state | Low | **High** | Separate file; FR-6; test asserting no write |
| 5 | Path normalisation creates duplicate rows | Medium | Low | One shared helper in `paths.ts` with tests |
| 6 | Existence checks slow the launch screen | Low | Medium | FR-10 async resolution |
| 7 | Two running instances race on the sidecar | Low | Low | Last-write-wins accepted; data is not precious |
| 8 | Overlap with P10 produces two competing empty states | Medium | Medium | Design together; see §16 |

---

## 15. Acceptance criteria

- [ ] Projects without Claude history appear in Recent Projects
- [ ] A newly created project appears immediately
- [ ] A newly cloned repository appears immediately
- [ ] An opened directory appears immediately
- [ ] Ordering is most-recent-first
- [ ] List is capped and evicts oldest
- [ ] Paths de-duplicated after normalisation; symlinks not resolved
- [ ] Empty state explains the panel and points at the three actions
- [ ] Empty state does not flash during loading
- [ ] Fetch failure is distinguishable from empty
- [ ] Unavailable entries marked, not hidden, and not by colour alone
- [ ] Activating an unavailable entry offers removal
- [ ] Missing or corrupt sidecar degrades silently
- [ ] `~/.claude.json` is never written
- [ ] `/api/projects/recent` registered before the parameterised route
- [ ] Empty state composed from Astryx, no new CSS classes
- [ ] `make check` passes

---

## 16. Open questions

1. **Sidecar or `localStorage`?** §7.1 recommends the sidecar for machine scope, at the cost
   of a backend change that would otherwise be unnecessary. If effort must stay minimal,
   `localStorage` delivers most of the value with no backend work — accepting per-browser
   lists.
2. **How does this interact with P10 (onboarding)?** Both define a first-run experience for
   the same screen. Either P06 ships a minimal empty state that P10 later replaces, or P10
   absorbs FR-11/12/13 entirely. **Decide before starting either.** Recommendation: P06 ships
   the empty state; P10 layers the CLI-prerequisite check on top.
3. **Should filtered-out projects be shown at all (FR-14)?** Once `encodedName` is nullable
   they *are* shown, which resolves FR-14 implicitly. Is any additional explanation needed,
   or is showing them sufficient?
4. **Should removal from the list be possible for available entries too?** That edges into
   `PROJ-06` (project removal), deferred. Recommendation: removal only for unavailable
   entries here.
5. **What is the right cap?** 10 fits the panel without scrolling at typical heights; 15
   holds more history. Needs a look at the real layout.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Sidecar read/write in backend | 2 h |
| `handleProjectsRequest` merge + nullable `encodedName` | 2 h |
| Audit and fix `encodedName` consumers | 1.5 h |
| `POST /api/projects/recent` + route ordering | 1 h |
| Path normalisation helper | 1 h |
| Existence checks, async | 1 h |
| Empty state component | 1.5 h |
| Unavailable-entry handling | 1.5 h |
| Backend tests | 3 h |
| Frontend tests | 2.5 h |
| Manual verification | 1 h |
| **Total** | **≈18 h — 2.5 days** |

Drops to roughly **1 day** if Open Question 1 resolves to `localStorage`.

---

## 18. References

- `backend/handlers/projects.ts:30-40` — the filter that causes the problem
- `backend/history/pathUtils.ts` — `getEncodedProjectName`
- `backend/handlers/directories.ts:1-14` — the unconfined-reads justification (see §9)
- `backend/utils/paths.ts` + `paths.test.ts` — path resolution and its tests
- `backend/utils/fs.ts` — `exists()`
- `backend/utils/os.ts` — `getHomeDir()`
- `shared/types.ts:28-35` — `ProjectInfo`, `ProjectsResponse`
- `CLAUDE.md` § "Launch screen" — the documented limitation and the `.launch-*` rationale
- `CLAUDE.md` § "Backend" — route-ordering constraint
- `../03-feature-comparison-matrix.md` — `PROJ-05`
- `../04-uiux-workflow-comparison.md` §2 Journey A
