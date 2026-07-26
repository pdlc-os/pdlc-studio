# P16 — Diff Viewer

| Field | Value |
| --- | --- |
| **Priority** | **P16** of 30 |
| **Score** | **13.3** (tie; ordered after P15 by dependency) |
| **Inputs** | Value 5 · Reach 4 · GapWeight ×2.0 · Effort 3 |
| **Category** | Code & File Interaction · Version Control |
| **Matrix features** | `FILE-04` (diff / merge view), `GIT-07` (uncommitted-diff viewer) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui **5** |
| **Effort** | **3** |
| **Depends on** | **P07** (file viewer, path confinement), **P15** (changed-file list) |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

P15 tells the user *which* files changed. This PRD tells them *what* changed.

Without it, the review loop is still broken. A user who sees `M src/auth/session.ts` in the
status panel knows something happened to that file and nothing about whether it was a
one-line fix or a rewrite. The only ways to find out today are to ask Claude to print the
diff — costing tokens and returning a snapshot rather than the current state — or to leave
the app for a terminal.

`04-uiux-workflow-comparison.md` §2 Journey C describes the whole gap, of which P15 and P16
are the two halves:

> **PDLC Studio**: read the transcript and reconstruct it mentally from the tool-call blocks.
> There is no diff, no changed-file list, no `git status`. To actually review, leave the app
> and run `git diff` in a terminal.

There is a second, less obvious motivation. P15 §9 notes that committing secrets an agent
wrote is a real hazard, and that **the diff viewer is the mitigation** — seeing changes
before committing is the entire point of a review step. P15 without P16 offers a commit
button with no way to check what is being committed, which is arguably worse than neither.

**These two PRDs should be treated as one deliverable split for reviewability.**

### Why P16 rather than higher

Effort 3, and it is third in a chain: P07 provides the file-render component and path
confinement, P15 provides the changed-file list. Its score ties with P14 and P15; the
dependency ordering in `06-prioritization-and-roadmap.md` §1 places it last of the three.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. **No code may
> be copied.** Observable capability only.

claudecodeui scores **5** here, using **`@codemirror/merge ^6.11.1`** — a full side-by-side
diff and merge view — as part of its broader CodeMirror 6 editor stack
(`@uiw/react-codemirror`, six language packages, `@codemirror/theme-one-dark`,
`@replit/codemirror-minimap`).

Its diff is *editable*, because its file viewer is an editor.

**PDLC Studio's is read-only**, because `FILE-03` (in-browser editing) is deferred pending
evidence anyone wants it, and `FILE-06` (manual file CRUD) is rejected outright — the agent
already does that, and a parallel manual write path doubles the write surface.

That difference cascades: a read-only diff needs no merge conflict handling, no editor
state, no save path, and no dirty-buffer semantics. It is a substantially smaller feature
than claudecodeui's, deliberately.

**PDLC Studio should also not adopt CodeMirror.** It has a design system with a syntax
renderer already (§7.4).

---

## 3. Goals & non-goals

### Goals

1. See what changed in a file, line by line, without leaving the app.
2. Review before committing, so P15's commit button is safe to use.
3. Cover both unstaged and staged changes.
4. Reuse P07's rendering rather than introducing a second code renderer.
5. Introduce no diff library and no editor dependency.

### Non-goals

- **Editing within the diff.** Read-only; `FILE-03` deferred.
- **Merge conflict resolution.** Out of scope; a terminal or dedicated tool does this better.
- **Hunk-level staging from the diff.** `GIT-04`, deferred — this is the natural follow-up.
- **Diffs between arbitrary commits.** `GIT-08` (log) is deferred, so there is no UI to pick
  commits from. Working-tree diffs only.
- **Word- or character-level intra-line highlighting.** Nice; not necessary for a first
  version. See §16.
- **Diffing binary files.** Detected and refused, as in P07.

---

## 4. Personas & user stories

**Marcus — about to commit an agent's work.**

> As a user, I want to read the actual changes before committing, so that I am not
> rubber-stamping eight files I have not seen.

**Priya — verifying a claim.**

> As a user, I want to check that the change Claude described is the change it made, because
> the transcript is a description and the diff is the truth.

**Devon — spotting an accident.**

> As a user, I want to notice when an agent has touched something unrelated — a lockfile, a
> config, a credential — so that I do not commit it.

Devon's story is the security case, and it is why P16 belongs immediately after P15 rather
than several milestones later.

---

## 5. Functional requirements

### Content

- **FR-1** A changed file **MUST** be viewable as a diff against its committed state.
- **FR-2** Unstaged and staged changes **MUST** be independently viewable, matching git's
  own model.
- **FR-3** For a file both staged and further modified, both diffs **MUST** be reachable.
- **FR-4** Added files **MUST** render as all-additions.
- **FR-5** Deleted files **MUST** render as all-deletions.
- **FR-6** Renames **MUST** be identified as such, showing old and new paths.
- **FR-7** Untracked files **MUST** be viewable — as file content, not a diff, since there is
  no base.
- **FR-8** Binary files **MUST** be detected and refused with a clear message.
- **FR-9** Diffs above a size threshold **MUST** be truncated with an explicit indication.

### Presentation

- **FR-10** Added and removed lines **MUST** be visually distinguished.
- **FR-11** The distinction **MUST NOT** rely on colour alone — `+`/`−` gutter markers are
  required.
- **FR-12** Line numbers for both sides **MUST** be shown.
- **FR-13** Unchanged context **MUST** be shown around each hunk, with a configurable or
  sensible default amount.
- **FR-14** Large runs of unchanged lines between hunks **MUST** be collapsed, expandable on
  demand.
- **FR-15** Syntax highlighting **SHOULD** be applied where the language is recognised.

### Navigation

- **FR-16** Selecting a file in P15's status panel **MUST** open its diff.
- **FR-17** Moving between changed files **MUST** be possible without returning to the list.
- **FR-18** A summary count of added and removed lines **MUST** be shown per file.

### Accessibility

- **FR-19** The diff **MUST** be readable by a screen reader in a sensible order, with each
  line's status conveyed as text.
- **FR-20** It **MUST** be keyboard-scrollable and focusable.
- **FR-21** Collapsed regions **MUST** be expandable by keyboard with correct
  `aria-expanded`.
- **FR-22** The added/removed distinction **MUST** survive high-contrast and forced-colours
  modes.

FR-19 deserves emphasis. A diff rendered purely as coloured backgrounds is meaningless to a
screen reader. Each line needs a textual status — which the `+`/`−` markers of FR-11 provide
if they are real text rather than pseudo-element decoration.

---

## 6. UX & interaction specification

### Placement

Inside P07's panel, replacing the file-viewer region when a diff is selected. Not a new
route, not a modal, consistent with the progressive-disclosure decision in
`04-uiux-workflow-comparison.md` §6.

### Unified, not side-by-side

**Recommendation: a unified (single-column) diff.**

Reasons specific to this app:

- The panel shares horizontal space with the chat transcript. Side-by-side needs roughly
  double the width, and on the narrow viewports P29 targets it is unusable.
- Unified diffs degrade gracefully as width shrinks; split diffs do not.
- Reviewing agent changes is usually reading a handful of hunks, not comparing two long
  versions structurally.

Side-by-side can be added later as an option if asked for — but it should not be the first
version, and it should never be the only one.

```
┌─────────────────────────────────────────────┐
│  src/auth/session.ts          +12  −4    ▾  │
├─────────────────────────────────────────────┤
│      12  12    const TTL = 60 * 60;         │
│      13  13                                 │
│      14     −  export function expire(s) {  │
│          14 +  export function expire(      │
│          15 +    s: Session,                │
│          16 +  ): void {                    │
│      15  17      s.expiresAt = Date.now();  │
│                                             │
│  ⋯ 34 unchanged lines ⋯          [ expand ] │
│                                             │
│      50  52    return session;               │
└─────────────────────────────────────────────┘
```

- Two line-number gutters (old, new) satisfy FR-12.
- `+`/`−` in a dedicated column satisfy FR-11 and FR-19.
- The collapsed run satisfies FR-14.
- `+12 −4` satisfies FR-18.

### States

| State | Behaviour |
| --- | --- |
| No file selected | Panel shows the status list (P15) |
| Loading | Skeleton; no flash of "no changes" |
| Diff present | Rendered as above |
| Added file | All-additions, no old gutter |
| Deleted file | All-deletions, no new gutter |
| Renamed | Header shows `old → new` |
| Untracked | File content with a note that there is no base to compare |
| Binary | "Binary file — no preview", with size |
| Too large | Truncated with a banner and the total change count |
| File changed since load | Stale indicator with refresh (see §10) |

The stale case matters: an agent may modify a file while the user is reading its diff. P15's
FR-8 refreshes the status list on turn completion; the open diff should indicate staleness
rather than silently showing an outdated view.

---

## 7. Technical design

### 7.1 Generating the diff

**Use `git diff` via `runtime.runCommand`**, following P15 §7.1's reasoning: the precedent
exists (`backend/handlers/projectSetup.ts:115,193`), the user demonstrably has git, and a
diff library would ship inside five `deno compile` binaries.

Commands:

| Need | Command |
| --- | --- |
| Unstaged (FR-2) | `git diff --no-color -- <path>` |
| Staged (FR-2) | `git diff --cached --no-color -- <path>` |
| Rename detection (FR-6) | add `--find-renames` |
| Context amount (FR-13) | `-U<n>` |

`--no-color` is essential — colour escape codes would otherwise need stripping, and git may
emit them when it believes it is writing to a terminal.

The `--` terminator before the path is required for the same reason as in P15: a filename
beginning with `-` must not be read as a flag.

### 7.2 Parsing unified diff output

Git emits standard unified-diff format. A parser is needed to produce structured hunks for
rendering, and it belongs in `backend/git/diffParser.ts` alongside P15's
`statusParser.ts`.

What it must handle correctly:

| Case | Note |
| --- | --- |
| Hunk headers `@@ -a,b +c,d @@` | Both line-number sequences derive from these |
| `\ No newline at end of file` | A real marker that is not a content line |
| Empty hunks / empty files | Boundary |
| Files with CRLF line endings | Must not corrupt the rendering |
| **Filenames with spaces or quotes** | Git quotes paths in diff headers under some configs |
| Binary marker lines | `Binary files … differ` → FR-8 |
| Mode-only changes | A file can change permissions with no content diff |

The mode-only case is easy to miss and produces a confusing empty diff if unhandled — the
correct behaviour is a note that only the file mode changed.

**Do not attempt to compute diffs in the application.** Git's output is authoritative and
handles rename detection, binary detection, and whitespace options that a hand-rolled
implementation would not.

### 7.3 Endpoint

```
GET /api/projects/:encodedProjectName/git/diff?path=<relative>&staged=<bool>
```

Registered alongside P15's `git/*` routes, subject to the same ordering constraint from
`CLAUDE.md` (after `create`, `clone`, `recent`).

```ts
export interface DiffLine {
  type: "context" | "added" | "removed" | "marker";
  oldLine?: number;
  newLine?: number;
  content: string;
}

export interface DiffHunk {
  oldStart: number; oldCount: number;
  newStart: number; newCount: number;
  lines: DiffLine[];
}

export interface FileDiffResponse {
  path: string;
  originalPath?: string;      // renames
  changeType: GitChangeType;  // reuses P15's type
  isBinary: boolean;
  isModeOnly: boolean;
  truncated: boolean;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  language?: string;          // highlighting hint, as P07
}
```

Reusing P15's `GitChangeType` rather than defining a parallel enum keeps the two panels
consistent.

### 7.4 Rendering — and the syntax-highlighting tension

P07 established that code rendering goes through **Astryx `CodeBlock`**, which provides
`hasLineNumbers`, `highlightLines`, `language`, `maxHeight`, `container="section"` and
`width="100%"`.

**`CodeBlock` is not a diff component.** Its `highlightLines` marks lines with a background
accent — useful, but it expresses one kind of emphasis, not added-versus-removed, and it
carries no dual gutter.

Three options:

| Option | Assessment |
| --- | --- |
| Use `CodeBlock` with `highlightLines` | Cannot distinguish additions from removals, and has one gutter. **Insufficient for FR-10/FR-11/FR-12.** |
| **Custom diff component using Astryx primitives** | Full control over gutters and markers. Loses `CodeBlock`'s syntax highlighting unless the tokenizer is reachable. **Recommended.** |
| Add a diff library | Contradicts §7.1's dependency reasoning |

**Recommendation: a purpose-built `DiffView` composed from Astryx primitives**, with FR-15
(syntax highlighting) treated as a **SHOULD**, not a MUST, precisely because it may not be
reachable.

`CodeBlock` exposes a `tokenizer` prop — `(code, language) => Array<{type, start, end}>` —
which implies a tokenizing capability exists in the design system. **Investigate whether it
is exported independently**; if so, per-line highlighting inside a custom diff renderer
becomes possible. If not, ship without highlighting rather than adding a second
highlighting library, which `CLAUDE.md`'s design-system rule forbids and which would drift
from the transcript's theme.

This is the PRD's main open question (§16.1).

### 7.5 Frontend

| Item | Purpose |
| --- | --- |
| New `frontend/src/components/git/DiffView.tsx` | Hunks, gutters, markers |
| New `frontend/src/components/git/DiffHunk.tsx` | One hunk, with collapsed-run expansion |
| New `frontend/src/hooks/git/useFileDiff.ts` | Fetch, cache, staleness |
| Modify `frontend/src/components/git/GitPanel.tsx` (P15) | Open a diff on file select |
| Modify `frontend/src/components/files/FilePanel.tsx` (P07) | Host the diff region |

### 7.6 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Safe git invocation | `runtime.runCommand` argv pattern | `backend/handlers/projectSetup.ts` |
| Path confinement | `resolveWithinRoot` (P07) | `backend/utils/paths.ts` |
| Change-type enum | `GitChangeType` (P15) | `shared/types.ts` |
| Changed-file list | `useGitStatus` (P15) | `frontend/src/hooks/git/` |
| Panel shell | `FilePanel` (P07) | `frontend/src/components/files/` |
| Parser module precedent | `statusParser.ts` (P15), `history/parser.ts` | `backend/` |
| Collapsed-region disclosure | Astryx `Collapsible` | design system |

---

## 8. Data model & persistence

**None.** Diffs are derived from git at request time.

A short-lived in-memory cache keyed by path and staged-flag is worthwhile to avoid
re-running `git diff` when a user toggles between files — but it **must** be invalidated on
P15's status refresh, or the stale-view problem in §6 becomes silent rather than indicated.

---

## 9. Security implications

Read-only, and lighter than P15's write surface. Three notes:

1. **Path confinement** reuses `resolveWithinRoot` (P07 §7.3) plus the `--` terminator.
   No new mechanism.
2. **Diff content is rendered as text, never as markup.** Diffs contain arbitrary file
   content, including HTML and script fragments. The renderer must build DOM from structured
   `DiffLine` values and must never interpolate content into markup. PDLC Studio has no
   raw-HTML path (no `rehype-raw` equivalent), so there is no existing hazard to fall into —
   but a diff of an HTML file is exactly where someone might reach for one.
3. **This is the mitigation for P15's biggest risk.** P15 §9 lists "committing secrets the
   agent wrote" and points here. That makes P16 security-*positive*: it is the review step
   that makes the commit button defensible.

Standing caveat: like every other endpoint, this is unauthenticated until P14.

---

## 10. Performance & scale

- **Diff size** is the main concern. A regenerated lockfile can produce a diff of tens of
  thousands of lines. FR-9's truncation is not optional — render a bounded number of hunks
  with an explicit "diff truncated" banner and the true totals.
- **Rendering cost**: each line is a DOM row. Even truncated, a few thousand rows is heavy;
  consider a render cap per hunk in addition to the overall cap.
- **Collapsed runs** (FR-14) reduce DOM substantially on files with scattered small changes,
  which is the common case for agent edits.
- **Staleness over polling**: do not re-run `git diff` on a timer. Invalidate on P15's status
  refresh and show the stale indicator otherwise.

---

## 11. Telemetry & observability

Via `backend/utils/logger.ts`, matching P15:

- `logger.api.warn` on git failure with stderr.
- `logger.api.warn` on rejected out-of-root paths.
- `logger.api.debug` with diff size and duration under `--debug`, informing §10's thresholds.

---

## 12. Test plan

### Backend — `make test-backend`

New `backend/git/diffParser.test.ts` — the highest-value file:

| Test | Asserts |
| --- | --- |
| Single-hunk diff parsed with correct line numbers | FR-12 |
| Multi-hunk diff parsed with correct offsets | FR-13 |
| Added file → all additions, no old numbers | FR-4 |
| Deleted file → all deletions | FR-5 |
| Rename detected with both paths | FR-6 |
| **`\ No newline at end of file` handled as a marker** | §7.2 |
| **Mode-only change reported, not an empty diff** | §7.2 |
| Binary marker → `isBinary: true` | FR-8 |
| CRLF content preserved | §7.2 |
| Filename with spaces/quotes parsed | §7.2 |
| Addition and deletion counts correct | FR-18 |

New `backend/handlers/gitDiff.test.ts`:

| Test | Asserts |
| --- | --- |
| Unstaged diff returned | FR-2 |
| Staged diff returned with `staged=true` | FR-2 |
| Both differ for a file staged then modified | FR-3 |
| Untracked file returns content, not a diff | FR-7 |
| Oversized diff truncated with counts intact | FR-9 |
| Out-of-root path rejected | §9 |
| Path beginning with `-` not treated as a flag | §9 |

### Frontend — `make test-frontend`

New `frontend/src/components/git/DiffView.test.tsx`:

| Test | Asserts |
| --- | --- |
| Added and removed lines distinguished | FR-10 |
| **`+`/`−` markers are real text, not decoration** | **FR-11, FR-19** |
| Both line-number gutters rendered | FR-12 |
| Collapsed run expandable by keyboard with `aria-expanded` | FR-14, FR-21 |
| Addition/deletion summary shown | FR-18 |
| Binary state renders a message, not content | FR-8 |
| Truncation banner shown when truncated | FR-9 |
| **Diff content rendered as text, never markup** | §9.2 |
| Keyboard-scrollable and focusable | FR-20 |
| Stale indicator shown after a status refresh | §6 |

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Edit a file, view the diff → matches `git diff` in a terminal exactly.
2. Stage it, edit again → both diffs available and different (FR-3).
3. Delete a file → all-deletions.
4. Rename a file → both paths shown.
5. Add an untracked file → content shown with a no-base note.
6. `chmod +x` a file with no content change → mode-only note, not an empty diff.
7. Regenerate a lockfile → truncated cleanly; panel stays responsive.
8. Diff a file containing `<script>alert(1)</script>` → rendered as text.
9. Narrow the viewport → unified diff still readable.
10. Screen reader: each line's status is announced.
11. Forced-colours mode: additions and removals still distinguishable (FR-22).

---

## 13. Rollout & migration

Additive. New endpoint, new types, new components inside P07's panel. No migration.
Minor release.

**Must ship in the same milestone as P15**, and ideally close behind it — a commit button
without a diff viewer is the weakest possible state of this feature set (§1).

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Syntax highlighting unreachable without a second library** | **Medium** | Medium | §7.4 — FR-15 is a SHOULD; ship without rather than adding a library |
| 2 | Huge diffs freeze the UI | **Medium** | **High** | FR-9 truncation, per-hunk caps, collapsed runs (§10) |
| 3 | Parser mishandles an edge case, showing a wrong diff | Medium | **High** | 11 parser tests (§12); wrong information is worse than none |
| 4 | Diff content rendered as markup | Low | **High** | §9.2; explicit test with a script fragment |
| 5 | Side-by-side chosen, unusable in the panel | Low | Medium | §6 — unified first, deliberately |
| 6 | Stale diff shown after an agent edit | Medium | Medium | §6 stale indicator; cache invalidated on status refresh |
| 7 | Mode-only change renders as an empty diff | Medium | Low | §7.2; explicit test |
| 8 | P15 ships without P16, leaving a blind commit button | Medium | **High** | §13 — same milestone |
| 9 | Colour-only distinction fails forced-colours mode | Medium | Medium | FR-11 text markers; FR-22 test |

---

## 15. Acceptance criteria

- [ ] Changed files viewable as unified diffs
- [ ] Unstaged and staged diffs independently reachable, including for the same file
- [ ] Added, deleted, renamed, untracked, binary and mode-only cases all handled correctly
- [ ] Oversized diffs truncated with accurate totals
- [ ] Added/removed distinguished by **text markers**, not colour alone
- [ ] Both old and new line-number gutters shown
- [ ] Context shown; long unchanged runs collapsed and keyboard-expandable
- [ ] Per-file addition/deletion counts shown
- [ ] Selecting a file in the status panel opens its diff
- [ ] Navigation between changed files without returning to the list
- [ ] Diff content rendered as text, never markup
- [ ] All paths confined; `--` terminator used; `--no-color` passed
- [ ] Screen reader announces each line's status
- [ ] Distinction survives forced-colours mode
- [ ] **No diff library, no editor dependency, no second syntax highlighter**
- [ ] `make check` passes under both runtimes

---

## 16. Open questions

1. **Is Astryx's tokenizer reachable outside `CodeBlock`?** Determines whether FR-15 is
   achievable. `CodeBlock` accepts a `tokenizer` prop of shape
   `(code, language) => Array<{type, start, end}>`, which suggests the capability exists —
   but whether the default implementation is exported is unknown. **Resolve first**; it is
   the difference between a highlighted and an unhighlighted diff.
2. **Should side-by-side be offered as an option?** §6 recommends unified only for v1.
   Revisit once the panel's width behaviour is known in practice.
3. **Should hunk-level staging (`GIT-04`) be folded in?** It is the natural next step and the
   diff view is where it belongs. Deliberately deferred to keep effort at 3 — but if it is
   wanted, designing the hunk model for it now costs little.
4. **What is the right truncation threshold?** Needs measurement against real lockfile diffs.
5. **Should intra-line word diffing be added?** `git diff --word-diff` exists. It materially
   improves readability of small edits within long lines. Deferred, but cheap to add later
   since it is a git flag rather than an algorithm.
6. **Should the diff be copyable?** P03 provides the control, and copying a diff into a PR
   description or a message is a real workflow. Cheap if P03 has shipped.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| **Resolve the tokenizer question (§16.1)** | 2 h |
| Unified-diff parser | 6 h |
| Parser tests incl. edge cases | 5 h |
| Diff endpoint incl. staged/unstaged and truncation | 4 h |
| Shared types | 1 h |
| `useFileDiff` hook incl. cache and staleness | 3 h |
| `DiffView` + `DiffHunk` with gutters and markers | 7 h |
| Collapsed-run expansion | 2 h |
| Integration with P15's status list and P07's panel | 3 h |
| Backend handler tests | 3 h |
| Frontend tests | 4 h |
| Manual verification incl. a11y and forced colours | 3 h |
| **Total** | **≈43 h — 5–6 days** |

Parser plus parser tests is a quarter of the effort, matching P15's allocation and for the
same reason: a diff that is subtly wrong is worse than no diff, because the user will trust
it.

---

## 18. References

- `backend/handlers/projectSetup.ts:115,193` — safe `git` invocation via argv
- `backend/utils/paths.ts` — `resolveWithinRoot` (P07 §7.3)
- `backend/git/statusParser.ts` — sibling parser from P15
- `backend/history/parser.ts` — parser module precedent
- `shared/types.ts` — `GitChangeType` from P15
- `CLAUDE.md` § "Chat UI" — `CodeBlock` and the no-hand-rolled-equivalents rule
- `CLAUDE.md` § "Backend" — route-ordering constraint
- `../01-claudecodeui-deep-scan.md` §3.5, §3.6 — `@codemirror/merge` baseline
- `../03-feature-comparison-matrix.md` — `FILE-04`, `GIT-07`, deferred `GIT-04`
- `../04-uiux-workflow-comparison.md` §2 Journey C, §6
- `P07-file-tree-read-only-file-viewer.md` §7.6 — the `CodeBlock` capability table
- `P15-git-status-panel-commit.md` §9 — why this PRD is the mitigation for its main risk
