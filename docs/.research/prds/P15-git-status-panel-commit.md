# P15 — Git Status Panel & Commit

| Field | Value |
| --- | --- |
| **Priority** | **P15** of 30 |
| **Score** | **13.3** (tie with P14/P16; ordered ahead of P16 by dependency) |
| **Inputs** | Value 5 · Reach 4 · GapWeight ×2.0 · Effort 3 |
| **Category** | Version Control |
| **Matrix features** | `GIT-03` (working-tree status panel), `GIT-05` (commit from the UI) |
| **Maturity** | PDLC Studio **1** → target **3** · claudecodeui **4** |
| **Effort** | **3** |
| **Depends on** | P07 (panel shell, path confinement) |
| **Blocks** | **P16** (diff viewer consumes the changed-file list) |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio helps a user generate code changes and then abandons them at the moment of
review.

`04-uiux-workflow-comparison.md` §2 Journey C states the problem directly:

> **"The agent just changed 8 files. What did it do?"** … There is no diff, no changed-file
> list, no `git status`. To actually review, leave the app and run `git diff` in a terminal.
> This is the workflow PDLC Studio is *most* conspicuously missing, because it's the one that
> follows every single successful agent interaction.

That last clause is the argument. Reviewing changes is not an occasional task — it is the
step that follows *every* productive session. The app supports the generation half of the
loop and none of the verification half.

Git exists in the product today only as **two write-once operations**:

- `initGit?: boolean` on project creation (`shared/types.ts:91`,
  `backend/handlers/projectSetup.ts:115`)
- `POST /api/projects/clone` → `git clone`
  (`backend/handlers/projectSetup.ts:193`)
- plus `BrowseDirectoriesResponse.isGitRepository`, a read-only boolean in the folder picker
  (`shared/types.ts:82`)

There is no status, stage, commit, branch, log, or diff. A search for `git status`,
`git commit`, `git diff`, `isomorphic-git`, and `simple-git` returns nothing beyond the two
operations above.

The user's only recourse is a terminal — which is precisely the thing a web UI for a CLI
exists to avoid.

### Why P15 rather than higher

Value 5, but effort 3, and it depends on P07 landing first for the panel shell and the
confined-path machinery. It anchors Milestone 3 alongside P07 and P16
(`06-prioritization-and-roadmap.md` §6), and together those three close Journey C end to end.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. **No code may
> be copied.** Observable capability only.

claudecodeui scores 4 with a dedicated `/api/git` route group and a `git-panel` component
module. Its README states:

> "View, stage and commit your changes. You can also switch branches."

It also depends on `@octokit/rest ^22.0.0` for GitHub API integration, and renders diffs via
`@codemirror/merge`.

**PDLC Studio should take a strict subset.** The roadmap already rejects:

- `GIT-09` push/pull — "credential handling in an app with no authentication is a hazard"
- `GIT-10` GitHub API — "out of scope for a local CLI front end"

and defers `GIT-04` (hunk-level staging), `GIT-06` (branch switching), and `GIT-08` (log).

**This PRD is deliberately: see what changed, stage it, commit it.** That is the loop that
follows an agent session. Everything else is a different job that a terminal or a dedicated
git client does better.

---

## 3. Goals & non-goals

### Goals

1. See which files the working tree has changed, without leaving the app.
2. Distinguish staged, unstaged, and untracked changes.
3. Stage and unstage whole files.
4. Commit staged changes with a message.
5. Confine every operation to the active project's repository.
6. Introduce no git library dependency.

### Non-goals

- **Diff rendering.** That is P16, which consumes this PRD's file list.
- **Hunk-level staging.** `GIT-04`, deferred — a large UI investment.
- **Branch switching or creation.** `GIT-06`, deferred.
- **Commit history / log.** `GIT-08`, deferred.
- **Push / pull.** `GIT-09`, **rejected** until P14. Credentials in an unauthenticated app
  are a hazard.
- **Merge, rebase, cherry-pick, stash.** Out of scope; a terminal does these better.
- **GitHub or forge integration.** `GIT-10`, rejected.
- **Amending or rewriting history.** Out of scope; destructive and easy to get wrong.

---

## 4. Personas & user stories

**Marcus — just ran a refactor.**

> As a user whose agent touched eight files, I want to see the list, so that I know the blast
> radius before I decide whether to keep it.

**Priya — wants to keep some changes.**

> As a user, I want to stage the files I want and commit those, so that a partially-good
> agent run is still useful.

**Devon — checkpointing.**

> As a user, I want to commit before asking for the next change, so that I have a point to
> return to if the next attempt goes badly.

Devon's story is the most important one: **committing is how you get undo** in an app that
has no checkpoint or rewind feature (`SESS-08`, deferred). P15 is the practical substitute.

---

## 5. Functional requirements

### Status

- **FR-1** The panel **MUST** list files changed in the active project's working tree.
- **FR-2** It **MUST** distinguish **staged**, **unstaged**, and **untracked**.
- **FR-3** It **MUST** show each file's change type — added, modified, deleted, renamed.
- **FR-4** A file both staged and further modified **MUST** appear in both groups, which is
  what git actually models.
- **FR-5** A non-repository project **MUST** show a clear, non-error empty state.
- **FR-6** A clean tree **MUST** show an explicit "no changes" state.
- **FR-7** The panel **MUST** offer manual refresh — there is no file watching (`FILE-09`
  rejected).
- **FR-8** It **SHOULD** refresh automatically when a chat turn completes, since that is when
  changes appear.

### Staging

- **FR-9** A file **MUST** be stageable individually.
- **FR-10** A staged file **MUST** be unstageable.
- **FR-11** Stage-all and unstage-all **SHOULD** be available.
- **FR-12** Staging **MUST NOT** modify file contents.

### Commit

- **FR-13** Staged changes **MUST** be committable with a message.
- **FR-14** Commit **MUST** be disabled when nothing is staged.
- **FR-15** An empty message **MUST** be rejected client-side before a request is made.
- **FR-16** The message **MUST** support a multi-line body, not just a subject.
- **FR-17** Success **MUST** report the short SHA.
- **FR-18** Failure **MUST** surface git's own stderr, which is the most useful diagnostic.
- **FR-19** A commit that would fail for missing `user.name`/`user.email` **MUST** produce a
  clear message naming the fix.

### Safety

- **FR-20** All operations **MUST** be confined to the active project's repository.
- **FR-21** `git` **MUST** be invoked with an argv array, never a shell string.
- **FR-22** No operation in this PRD **MUST** be capable of destroying uncommitted work.
- **FR-23** Paths from the client **MUST** be validated server-side against the project root.

FR-22 is a scoping constraint as much as a requirement: it is why `checkout`, `reset --hard`,
`clean`, and `stash` are absent. Every operation here is additive or reversible.

### Accessibility

- **FR-24** File groups **MUST** be semantic lists with meaningful headings.
- **FR-25** Change type **MUST NOT** be conveyed by colour alone.
- **FR-26** Stage/unstage controls **MUST** be keyboard-reachable buttons with names
  identifying the file.
- **FR-27** Status changes after an action **MUST** be announced politely.

---

## 6. UX & interaction specification

### Placement

**Inside P07's panel**, as a second section or a sibling tab within that panel — **not** a
new top-level route or navigation tab.

`04-uiux-workflow-comparison.md` §6 is explicit that the file tree, git panel, and diff
viewer are all to be "progressive disclosure from the chat surface" rather than a new
navigation layer, because "time to value" and "no navigation to learn" are two of the
product's three identity properties.

So P07 owns the panel shell; P15 adds content to it.

```
┌──────────────────────────┬──────────────────────┐
│ Files │ ● Changes (8)    │  Assistant           │
│                          │  I've updated the    │
│ Staged (3)               │  session handler…    │
│  M  src/auth/session.ts  │                      │
│  M  src/auth/login.ts    │                      │
│  A  src/auth/expiry.ts   │                      │
│                          │                      │
│ Changes (4)              │                      │
│  M  src/api/client.ts  ⊕ │                      │
│  M  tests/auth.test.ts ⊕ │                      │
│  D  src/legacy/old.ts  ⊕ │                      │
│                          │                      │
│ Untracked (1)            │                      │
│  ?  notes.md           ⊕ │                      │
│                          │                      │
│ ┌──────────────────────┐ │                      │
│ │ Commit message…      │ │                      │
│ └──────────────────────┘ │                      │
│      [ Commit 3 files ]  │  [ composer       ]  │
└──────────────────────────┴──────────────────────┘
```

- Status letters (`M`, `A`, `D`, `R`, `?`) satisfy FR-25 — they are the non-colour signal,
  and they are the notation git users already know.
- `⊕` stages; staged rows show `⊖`.
- The commit button names the count, so the scope of the action is visible before clicking.

### States

| State | Behaviour |
| --- | --- |
| Not a git repository | "This project isn't a git repository." No error styling (FR-5) |
| Clean tree | "No changes." (FR-6) |
| Loading | Skeleton; **must not** flash "no changes" first |
| Changes present | Grouped list |
| Staging in flight | Row shows progress; list not fully re-rendered |
| Committing | Button shows progress; message field disabled |
| Commit succeeded | Message cleared, short SHA reported, list refreshed |
| Commit failed | git stderr shown verbatim, message **preserved** |
| Git binary missing | Clear message; panel otherwise inert |

**Preserving the message on failure** matters — losing a carefully written commit message to
a missing `user.email` would be a small but memorable betrayal.

### After a chat turn

FR-8's auto-refresh is what makes this feel connected to the agent rather than bolted on.
When a turn completes, the changed-file count updates, and the user sees "8 changes" without
asking. This is the single interaction that closes Journey C.

It must be a **refresh**, not a notification — no toast, no badge animation. The count
changing is enough.

---

## 7. Technical design

### 7.1 Shelling out, not a library

**Recommendation: invoke the `git` binary via `runtime.runCommand`.** No `isomorphic-git`, no
`simple-git`.

Reasons specific to this project:

- The precedent exists and works: `backend/handlers/projectSetup.ts` already runs
  `git init` and `git clone` through `runtime.runCommand("git", [...])` with argv arrays
  (lines 115, 193).
- `CLAUDE.md` documents the fight to keep `deno compile` artefacts small; a git library is a
  substantial dependency shipped in five binaries.
- The user demonstrably has git — they used it to clone the project, and the app already
  depends on it for `clone`.

The cost is parsing git's output, which is addressed in §7.3.

### 7.2 Endpoints

```
GET  /api/projects/:encodedProjectName/git/status
POST /api/projects/:encodedProjectName/git/stage      { paths: string[] }
POST /api/projects/:encodedProjectName/git/unstage    { paths: string[] }
POST /api/projects/:encodedProjectName/git/commit     { message: string }
```

> **Route ordering.** `CLAUDE.md` requires literal segments before parameterised ones.
> These are nested under a parameterised project route, so they sit alongside `histories`
> and must not be registered above `create`, `clone`, or `recent` (P06). Same class of
> constraint P08 must respect for `/histories/search`.

New shared types:

```ts
export type GitChangeType = "added" | "modified" | "deleted" | "renamed" | "untracked";

export interface GitFileChange {
  path: string;              // relative to repo root
  originalPath?: string;     // renames
  type: GitChangeType;
  staged: boolean;
}

export interface GitStatusResponse {
  isRepository: boolean;
  branch?: string;           // display only; switching is GIT-06
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: GitFileChange[];
  hasChanges: boolean;
}

export interface GitCommitResponse {
  sha: string;
  shortSha: string;
  filesChanged: number;
}
```

`branch` is included because showing it costs nothing and orients the user — but **switching
is out of scope** (`GIT-06`), and the UI must not imply otherwise.

### 7.3 Parsing status correctly

**Use `git status --porcelain=v2 -z --untracked-files=all`.**

Each part matters:

| Flag | Why |
| --- | --- |
| `--porcelain=v2` | A stable, documented, machine-readable format. **Never parse human-readable `git status`** — it is localised and not a stable interface |
| `-z` | NUL-separated records, so **filenames containing spaces, quotes, or newlines parse correctly**. Git legitimately allows all of these |
| `--untracked-files=all` | Lists individual untracked files rather than just directories |

The `-z` point is the one most often skipped and the one most likely to produce a
security-adjacent bug: a filename containing a newline would otherwise be parsed as two
entries.

Porcelain v2 encodes staged and unstaged state as a two-character XY field, which maps
directly onto FR-2 and FR-4 — a file with both `X` and `Y` set appears in both lists.

Parsing belongs in a dedicated, well-tested module: `backend/git/statusParser.ts`, alongside
the existing `backend/history/parser.ts` precedent.

### 7.4 Confinement

FR-20/FR-23 reuse **`resolveWithinRoot`** from P07 §7.3 — the same function, with the same
tests, covering `..` traversal, absolute paths, symlink escape, and prefix confusion
(`/project-evil` vs `/project`).

**Do not reimplement path confinement here.** If P07 has not landed, that function is a
prerequisite, not a parallel effort.

Additionally, git subcommands must run with an explicit working directory, and paths passed
to `git add`/`git restore` must be preceded by `--` to prevent a filename being interpreted
as a flag — exactly as `projectSetup.ts:193` already does for `git clone`.

### 7.5 Commit safety

- `git commit -m <message>` with the message as an **argv element**, never interpolated
  (FR-21). A message containing quotes, newlines, or `$(…)` is then inert.
- Multi-line messages (FR-16) pass through as a single argv element containing newlines.
- **Never** `--amend`, `--no-verify`, or `-a`. `-a` in particular would stage everything,
  contradicting FR-9's explicit staging model.
- FR-19's missing-identity case is detectable from git's stderr and deserves a translated
  message naming `git config user.email`, because git's own wording is long and the fix is
  not obvious to everyone.

### 7.6 Frontend

| Item | Purpose |
| --- | --- |
| New `frontend/src/components/git/GitPanel.tsx` | Section within P07's panel |
| New `frontend/src/components/git/GitFileList.tsx` | Grouped list |
| New `frontend/src/components/git/CommitForm.tsx` | Message + commit |
| New `frontend/src/hooks/git/useGitStatus.ts` | Fetch, refresh, optimistic staging |
| New `frontend/src/hooks/git/useGitCommit.ts` | Commit + error surfacing |

FR-8's auto-refresh hooks into turn completion, which `useClaudeStreaming` already observes
(it is where P02 and P04 also attach).

### 7.7 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Running git safely | `runtime.runCommand` with argv | `backend/handlers/projectSetup.ts:115,193` |
| Path confinement | `resolveWithinRoot` (P07) | `backend/utils/paths.ts` |
| Panel shell | `FilePanel` (P07) | `frontend/src/components/files/` |
| Turn-completion signal | `useClaudeStreaming` | `frontend/src/hooks/` |
| Encoded project name | `getEncodedProjectName` | `backend/history/pathUtils.ts` |
| List/button primitives | Astryx | design system |
| Multi-line message field | Astryx `TextArea` | design system |

---

## 8. Data model & persistence

**None.** Git is the source of truth; every response is derived from `git status` at request
time.

One deliberate exception worth considering: an **in-progress commit message** could be worth
preserving across a panel close, since losing a half-written message is annoying. Local
component state covers the common case; persisting to `AppSettings` is possible but adds a
settings field for marginal benefit. **Recommendation: component state only**, plus FR's
preservation on failure.

---

## 9. Security implications

**This PRD adds the first user-triggered *write* operations to a repository**, so it deserves
more care than the read-only P07.

| Threat | Mitigation |
| --- | --- |
| Path traversal to stage files outside the repo | FR-20/FR-23 via `resolveWithinRoot` (P07 §7.3) |
| Filename interpreted as a git flag | `--` terminator before paths (§7.4) |
| Shell injection via commit message | argv array, never a shell string (FR-21, §7.5) |
| Malicious filename breaking the parser | `-z` NUL separation (§7.3) |
| Destroying uncommitted work | FR-22 — no `checkout`, `reset`, `clean`, or `stash` in scope |
| Committing secrets the agent wrote | Not this PRD's job to prevent, but **the diff viewer (P16) is the mitigation** — seeing changes before committing is the point |
| **No authentication** | Unchanged and unaddressed until P14 |

That last row is heavier here than in P07. P07 added a *read* surface to an unauthenticated
API; P15 adds a **write** surface — an unauthenticated caller could stage and commit
arbitrary tracked changes.

The blast radius is bounded: everything this PRD can do is additive and recoverable
(FR-22), and an attacker who can reach the port can already run `/api/chat`. But it is a
genuine escalation from read to write, and it strengthens the case for sequencing P14
earlier — see `06-prioritization-and-roadmap.md` §5.

---

## 10. Performance & scale

`git status --porcelain=v2` on a large repository can take noticeable time, especially on a
cold filesystem cache or a repo with many untracked files.

- **Do not poll.** FR-7's manual refresh plus FR-8's turn-completion trigger are sufficient.
- Guard against overlapping requests — a second refresh while one is in flight should be
  coalesced, not queued.
- `--untracked-files=all` is the expensive mode. If it proves slow on large repos, `normal`
  (directory-collapsed) is the fallback, at the cost of FR-3 fidelity for untracked files.
- Cap the rendered list with a "and N more" indicator; a repo with 10,000 untracked files
  must not render 10,000 rows.

---

## 11. Telemetry & observability

Via `backend/utils/logger.ts`, following `projectSetup.ts`'s existing pattern of logging
git's stderr on failure (lines 119, 196-201):

- `logger.api.warn` on any git command failure, including stderr.
- `logger.api.warn` on a rejected out-of-root path — a real security signal.
- `logger.api.debug` on status duration under `--debug`, feeding §10.

No client analytics.

---

## 12. Test plan

### Backend — `make test-backend`

New `backend/git/statusParser.test.ts` — **the highest-value tests here**:

| Test | Asserts |
| --- | --- |
| Parses staged, unstaged, untracked from porcelain v2 | FR-2 |
| File both staged and modified appears in both | **FR-4** |
| Added, modified, deleted, renamed mapped correctly | FR-3 |
| Rename carries `originalPath` | FR-3 |
| **Filename containing a space parses as one entry** | §7.3 |
| **Filename containing a newline parses as one entry** | §7.3 `-z` |
| Filename containing quotes parses correctly | §7.3 |
| Non-UTF8 filename does not crash the parser | Robustness |
| Empty output yields a clean tree | FR-6 |

New `backend/handlers/git.test.ts`:

| Test | Asserts |
| --- | --- |
| Status on a non-repository returns `isRepository: false`, not an error | FR-5 |
| Stage adds only the named paths | FR-9, FR-12 |
| Unstage restores | FR-10 |
| Commit with nothing staged rejected | FR-14 |
| Commit returns short SHA | FR-17 |
| Commit failure surfaces stderr | FR-18 |
| Missing `user.email` produces the translated message | FR-19 |
| **Path outside the repo rejected** | FR-20, FR-23 |
| **Path beginning with `-` not treated as a flag** | §7.4 |
| Commit message containing `$(…)` is inert | FR-21 |
| Multi-line message preserved | FR-16 |

Tests need real temporary git repositories. That is fine — `git init` is fast, and
`projectSetup.ts` already establishes that the test environment has git.

### Frontend — `make test-frontend`

New `frontend/src/components/git/GitPanel.test.tsx` and hook tests:

| Test | Asserts |
| --- | --- |
| Groups rendered as semantic lists with headings | FR-24 |
| Change type shown as a letter, not colour alone | FR-25 |
| Stage control names its file | FR-26 |
| Non-repository state is not styled as an error | FR-5 |
| **Loading does not flash "no changes"** | §6 states |
| Commit disabled with nothing staged | FR-14 |
| Empty message rejected before any request | FR-15 |
| **Commit message preserved on failure** | §6 |
| Status refreshes on turn completion | FR-8 |
| Status change announced politely | FR-27 |

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Open a project with changes → grouped correctly against `git status` in a terminal.
2. Create a file named `a b"c$(d).txt` → appears as one correct entry.
3. Stage, unstage, commit → verify with `git log` and `git status`.
4. Commit with `user.email` unset → clear, actionable message.
5. Run an agent turn that edits files → panel updates without manual refresh.
6. Open a non-git project → clear empty state, no error.
7. `curl` a stage request with `../../etc/passwd` → rejected.
8. Large repo with many untracked files → panel remains responsive.

---

## 13. Rollout & migration

Additive: new endpoints, new types, new components inside P07's panel. No existing behaviour
changes. No persistence, no migration. Minor release.

**Sequencing**: after P07 (panel shell and `resolveWithinRoot`), before P16 (which consumes
the changed-file list). All three in Milestone 3.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Filename parsing breaks on spaces/newlines/quotes** | **Medium** | **High** | `-z` porcelain v2 (§7.3); four dedicated parser tests |
| 2 | **Adds an unauthenticated write surface** | **Certain** | Medium | Bounded by FR-22 (nothing destructive); strengthens the case for P14 |
| 3 | Path traversal in stage/unstage | Medium | **High** | `resolveWithinRoot` reuse; `--` terminator; tests |
| 4 | Someone adds `checkout`/`reset` "while they're in there" | Medium | **High** | FR-22 as an explicit requirement, not just a non-goal |
| 5 | `git status` slow on large repos | Medium | Medium | §10 — no polling, coalesced refresh, `--untracked-files` fallback |
| 6 | Commit message lost on failure | Medium | Medium | §6 preservation; explicit test |
| 7 | Parsing human-readable `git status` instead of porcelain | Low | **High** | §7.3 states the rule; parser tests use porcelain fixtures |
| 8 | Branch shown implies switching is available | Medium | Low | Display-only; no affordance |
| 9 | A git library dependency gets added later | Low | Medium | §7.1 rationale recorded |

---

## 15. Acceptance criteria

- [ ] Panel lists changed files grouped staged / unstaged / untracked
- [ ] A file both staged and modified appears in both groups
- [ ] Change type shown as a letter, never colour alone
- [ ] Non-repository and clean-tree states are clear and non-error
- [ ] Loading never flashes "no changes"
- [ ] Manual refresh, plus automatic refresh on turn completion
- [ ] Stage and unstage per file, plus stage-all / unstage-all
- [ ] Commit disabled with nothing staged; empty message rejected client-side
- [ ] Multi-line commit messages supported
- [ ] Success reports the short SHA; failure surfaces git stderr
- [ ] Missing `user.email` produces a message naming the fix
- [ ] **Commit message preserved on failure**
- [ ] `git status --porcelain=v2 -z --untracked-files=all` used; human output never parsed
- [ ] Filenames with spaces, quotes, and newlines handled correctly
- [ ] All paths confined via `resolveWithinRoot`; `--` terminator used
- [ ] Commit message passed as an argv element
- [ ] **No destructive operation reachable** — no checkout, reset, clean, stash, amend
- [ ] No git library dependency
- [ ] `make check` passes under both runtimes

---

## 16. Open questions

1. **Where exactly does the panel live** — a second section inside P07's panel, or a tab
   within it? Must be settled with P07 so the shell supports it. §6 assumes a tab.
2. **Should FR-8's auto-refresh be unconditional?** On a large repo it makes every turn
   slightly slower. Options: refresh only when the panel is open (recommended), or debounce.
3. **Should commit offer to stage everything** if nothing is staged? Convenient, and exactly
   the kind of shortcut that leads to committing something unintended. Recommendation: no —
   FR-14's explicit model is safer.
4. **Should the commit message be pre-filled** from the chat turn's content? Genuinely
   attractive — the agent just described what it did. But it risks confident, wrong messages.
   Worth prototyping as a *suggestion* the user edits, not a default.
5. **Is `--untracked-files=all` affordable** on realistically large repos? Measure; §10 has
   the fallback.
6. **Should `GIT-04` (hunk staging) be reconsidered** once this ships? It is the most
   commonly requested next step and the largest deferred item in this category.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Porcelain v2 `-z` parser | 5 h |
| Parser tests incl. hostile filenames | 4 h |
| Status endpoint | 2 h |
| Stage / unstage endpoints incl. confinement | 3 h |
| Commit endpoint incl. stderr translation | 3 h |
| Shared types | 1 h |
| `useGitStatus` incl. coalesced refresh | 3 h |
| `useGitCommit` | 2 h |
| `GitPanel` + `GitFileList` | 5 h |
| `CommitForm` | 3 h |
| Turn-completion refresh wiring | 1.5 h |
| Backend handler tests | 4 h |
| Frontend tests | 4 h |
| Manual verification incl. hostile filenames and large repo | 2.5 h |
| **Total** | **≈42 h — 5–6 days** |

The parser and its tests are nearly a quarter of the effort. That is the correct allocation:
it is the component where a subtle bug produces wrong information about the user's own
changes, which is worse than no information.

---

## 18. References

- `backend/handlers/projectSetup.ts:115,193` — existing safe `git` invocation via argv
- `backend/handlers/projectSetup.ts:196-201` — precedent for surfacing git stderr
- `backend/utils/paths.ts` — home of `resolveWithinRoot` (P07 §7.3)
- `backend/history/parser.ts` — precedent for a dedicated, tested parser module
- `shared/types.ts:82,91` — `isGitRepository`, `initGit`
- `frontend/src/hooks/useClaudeStreaming.ts` — turn-completion signal for FR-8
- `CLAUDE.md` § "Backend" — route-ordering constraint
- `CLAUDE.md` § "Single Binary Distribution" — dependency discipline behind §7.1
- `../01-claudecodeui-deep-scan.md` §3.6 — competitor capability
- `../03-feature-comparison-matrix.md` — `GIT-03`, `GIT-05`, and the rejected `GIT-09`/`GIT-10`
- `../04-uiux-workflow-comparison.md` §2 Journey C, §6
- `P07-file-tree-read-only-file-viewer.md` §7.3 — path confinement this PRD reuses
