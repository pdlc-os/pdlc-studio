# P25 — Full-Text Code Search

| Field | Value |
| --- | --- |
| **Priority** | **P25** of 30 |
| **Score** | **8.0** |
| **Inputs** | Value 4 · Reach 3 · GapWeight ×2.0 · Effort 3 |
| **Category** | Code & File Interaction |
| **Matrix features** | `FILE-05` (full-text code search) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui **5** |
| **Effort** | **3** |
| **Depends on** | **P07** (viewer, confinement). Surfaces in **P17** (palette) |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio cannot search file contents. There is no way to answer "where is this function
defined?" or "what else calls this?" without either asking Claude — costing tokens and a round
trip — or leaving for a terminal.

P07 adds a file tree and viewer, which answers "show me this file." It does not answer "find
me the file", which is the more common need in an unfamiliar codebase.

The gap compounds with P08. Once conversation search exists, the absence of *code* search
becomes conspicuous: the app can find what you said about a function but not the function.

`04-uiux-workflow-comparison.md` §2 Journey B frames the underlying cost:

> PDLC Studio makes every file access a round-trip through the model — slow, token-expensive,
> and lossy.

Search is the sharpest case. Asking Claude to grep something costs a full turn and returns a
summary of what it found rather than the matches themselves.

### Why P25 rather than higher

Effort 3, and it is downstream of P07. Reach is 3 — a user who mostly asks Claude to make
changes may never search directly, whereas everyone reads files. It is the lowest-ranked of
the Code & File Interaction items that made the top 30.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Observable capability only.

claudecodeui scores **5** here, with **`@vscode/ripgrep ^1.17.1`** — the actual ripgrep
binary, packaged for Node — plus `fuse.js` for fuzzy matching.

Ripgrep is genuinely the right tool: it is fast, respects `.gitignore` by default, and handles
binary detection and encoding correctly.

**PDLC Studio cannot take that dependency.** `@vscode/ripgrep` ships platform-specific native
binaries, which is precisely the class of dependency the project fought to remove from its
`deno compile` output — `CLAUDE.md` documents the 428 MB → 94 MB reduction achieved by
excluding exactly this kind of package.

§7.1 addresses what to do instead, and the answer is not "reimplement ripgrep".

---

## 3. Goals & non-goals

### Goals

1. Find text across the project's files without leaving the app.
2. Show matches with enough context to judge relevance.
3. Open a match directly at its line.
4. Respect the user's ignore rules.
5. Add no native or platform-specific dependency.

### Non-goals

- **Conversation search.** P08.
- **Symbol or definition search.** Requires language intelligence.
- **Search and replace.** Editing is `FILE-03`, deferred; write operations are out of scope.
- **Indexing.** No persistent index, for the same reasons P08 §3 rejects one.
- **Regex as the default interface.** See §5 — supported, but not the default.

---

## 4. Personas & user stories

**Priya — unfamiliar codebase.**

> As someone new to a repository, I want to search for a function name, so that I can find
> where it is defined without asking Claude.

**Marcus — checking blast radius.**

> As a user about to rename something, I want to find every reference, so that I know how big
> the change is before starting.

**Devon — tracing a string.**

> As a user, I want to find where an error message is produced, so that I can point Claude at
> the right file rather than describing the symptom.

Devon's story is the most valuable: searching *cheaply* so the expensive model turn can be
targeted is the core economic argument for this feature.

---

## 5. Functional requirements

### Query

- **FR-1** A user **MUST** be able to search file contents across the active project.
- **FR-2** Matching **MUST** be case-insensitive by default, with case-sensitivity available.
- **FR-3** Literal substring search **MUST** be the default.
- **FR-4** Regex search **SHOULD** be available as an explicit option.
- **FR-5** Results **MUST** be filterable by file glob.
- **FR-6** Ignored files (`.gitignore`, `node_modules`, `.git`) **MUST** be excluded by
  default.
- **FR-7** Binary files **MUST** be skipped.

### Results

- **FR-8** Each match **MUST** show file path, line number, and the matching line.
- **FR-9** Surrounding context lines **SHOULD** be available.
- **FR-10** Matched text **MUST** be visually distinguished within the line.
- **FR-11** Results **MUST** be grouped by file.
- **FR-12** Total match and file counts **MUST** be shown.
- **FR-13** Results **MUST** be capped, with truncation indicated.
- **FR-14** Selecting a match **MUST** open the file at that line in P07's viewer.

### Behaviour

- **FR-15** Search **MUST** be explicitly invoked, not fired per keystroke.
- **FR-16** A running search **MUST** be cancellable.
- **FR-17** A superseded search's results **MUST** be discarded.
- **FR-18** Long-running searches **MUST NOT** block the UI.
- **FR-19** An unreadable file **MUST** be skipped, not fail the search.

### Safety

- **FR-20** Search **MUST** be confined to the project root.
- **FR-21** A regex from the user **MUST NOT** be able to hang the server (§9).
- **FR-22** Search **MUST** have a hard time limit.

### Accessibility

- **FR-23** The input **MUST** be labelled.
- **FR-24** Result counts **MUST** be announced politely.
- **FR-25** Results **MUST** be keyboard-navigable and activatable.
- **FR-26** Match highlighting **MUST NOT** rely on colour alone.

---

## 6. UX & interaction specification

### Placement

Inside P07's panel, as a third section alongside the tree and git panel — consistent with the
progressive-disclosure decision in `04-uiux-workflow-comparison.md` §6, which explicitly rules
out new top-level navigation.

Also registrable as a **P17 palette source**, so search is reachable from anywhere once the
palette exists. Same relationship P08 and P20 have to P17.

```
┌──────────────────────────────────────┐
│  🔍 resolvePermissionMode      [ Go ]│
│  Aa  .*  *.ts                        │
├──────────────────────────────────────┤
│  4 matches in 3 files                │
│                                      │
│  backend/utils/permissions.ts        │
│    46  export function resolve…      │
│                                      │
│  backend/handlers/chat.ts            │
│    10  import { resolvePermission…   │
│   120  const permissionMode = res…   │
│                                      │
│  backend/utils/permissions.test.ts   │
│    12  Deno.test("resolvePermiss…    │
└──────────────────────────────────────┘
```

- `Aa` toggles case sensitivity, `.*` toggles regex, the third field is a glob (FR-5).
- Grouped by file (FR-11), with line numbers.
- Matched text emphasised by weight or underline, not colour alone (FR-26).

### Explicit invocation

FR-15 is deliberate and differs from P08's debounced conversation search. Code search is
expensive — a full filesystem walk of a large repository — and firing it per keystroke would
be wasteful and slow. An explicit `Enter` or button is the right model, and it is what every
editor does.

### States

| State | Behaviour |
| --- | --- |
| Not searched | Empty panel with a hint |
| Searching | Progress indicator with a **cancel** control (FR-16) |
| Results | Grouped list |
| No results | "No matches for *query*" |
| Truncated | Results plus "showing first N of M" |
| Timed out | Partial results plus a clear note (§7.5) |
| Invalid regex | Inline error; **do not** run the search |
| Some files skipped | Results plus a count of skipped files (FR-19) |

The timeout state matters: returning partial results with an explanation is far better than
returning nothing after 30 seconds.

---

## 7. Technical design

### 7.1 How to search without ripgrep

The honest options, given §2's dependency constraint:

| Option | Assessment |
| --- | --- |
| **Shell out to `rg` if present, fall back otherwise** | Best of both: fast where available, works everywhere. But two code paths and two result formats to parse |
| **Shell out to `git grep`** | Git is already a hard dependency (`projectSetup.ts`, P15, P22). Fast, respects the index, handles binary detection. **But only searches tracked files** |
| **Pure-TypeScript walk and scan** | No dependency, one code path, works everywhere. Slower, and must reimplement ignore rules and binary detection |
| `@vscode/ripgrep` | **Rejected** — native, platform-specific, breaks `deno compile` (§2) |

**Recommendation: `git grep` where the project is a repository, with a pure-TypeScript fallback
otherwise.**

Reasoning:

- Git is already required by the app (`git clone` at `backend/handlers/projectSetup.ts:193`),
  so it is not a new dependency.
- `git grep` respects `.gitignore` by construction, satisfying FR-6 without reimplementing
  ignore parsing — the same argument P22 §7.2 makes for `git ls-files`.
- It handles binary detection (FR-7) natively.
- Most projects opened in this app will be git repositories.

The limitation is real and must be stated in the UI: **`git grep` searches tracked files
only.** A newly created, uncommitted file will not be found. Adding `--untracked` covers that,
and should be the default here since agent-created files are exactly the ones a user will look
for.

The fallback path for non-repositories is where the pure-TypeScript walk lives, reusing P22's
ignore set.

### 7.2 Endpoint

```
POST /api/projects/:encodedProjectName/search
{ query, isRegex, caseSensitive, glob?, maxResults, contextLines }
```

`POST` rather than `GET` because a regex query in a URL is awkward to encode and can be long.

> **Route ordering.** Same constraint as P06, P08, P15, P20, P22 — this parameterised route
> must not precede `create`, `clone`, or `recent` (`CLAUDE.md`).

```ts
export interface SearchMatchLine {
  lineNumber: number;
  content: string;
  ranges: Array<{ start: number; end: number }>;  // offsets within content
}

export interface FileSearchResult {
  path: string;                 // project-relative
  matches: SearchMatchLine[];
}

export interface CodeSearchResponse {
  results: FileSearchResult[];
  totalMatches: number;
  totalFiles: number;
  truncated: boolean;
  timedOut: boolean;
  skipped: number;
}
```

Returning **offset ranges** rather than pre-marked markup keeps the server out of presentation
and removes any injection surface — the same decision P08 §7.2 makes and for the same reason.

### 7.3 Confinement

FR-20 reuses **`resolveWithinRoot`** from P07 §7.3. The search root comes from the route's
project, not from client input, so the primary containment is structural.

The **glob** (FR-5) is client-supplied and must not be able to escape — a glob containing
`../` must be rejected rather than passed to `git grep`.

As everywhere in this pack, `git` is invoked with an **argv array** and a `--` terminator
before user-supplied values, following `backend/handlers/projectSetup.ts:193`. A query
beginning with `-` must not become a flag.

### 7.4 Regex safety

FR-21 is the genuine risk. A user-supplied regex can be catastrophically slow — the classic
ReDoS pattern — and P08 §9 avoided the issue entirely by not supporting regex.

Here regex is a real requirement (FR-4), so it needs handling:

- **Delegating to `git grep` helps substantially.** Its regex engine runs in a subprocess that
  can be killed, and it does not share the server's event loop. That is a much better position
  than running an untrusted regex in-process.
- **The subprocess must have a hard timeout** (FR-22) and be terminated on expiry.
- The **fallback path** runs regex in-process and is the dangerous one. It should either use a
  conservative subset, or chunk the work and check elapsed time between files so a
  pathological pattern cannot pin the loop indefinitely.

**Invalid regex must be rejected before execution** with a clear message, not surfaced as a
failed search.

### 7.5 Timeouts and cancellation

- Hard server-side timeout (FR-22), returning partial results with `timedOut: true` rather
  than an error.
- Client-side cancellation (FR-16) via `AbortController`, following
  `frontend/src/hooks/chat/useAbortController.ts` — and the server must actually kill the
  subprocess when the request aborts, not merely stop reading it.

That last point is easy to miss: an abandoned `git grep` on a huge repository will keep
running otherwise.

### 7.6 Components

| Item | Purpose |
| --- | --- |
| New `backend/search/gitGrep.ts` | `git grep` invocation and output parsing |
| New `backend/search/fallback.ts` | Walk-and-scan for non-repositories |
| New `backend/handlers/search.ts` | Endpoint, validation, timeout |
| New `frontend/src/hooks/files/useCodeSearch.ts` | State, cancellation |
| New `frontend/src/components/files/SearchPanel.tsx` | Input and options |
| New `frontend/src/components/files/SearchResults.tsx` | Grouped results |

### 7.7 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Safe git invocation | `runtime.runCommand` argv | `backend/handlers/projectSetup.ts` |
| Path confinement | `resolveWithinRoot` (P07) | `backend/utils/paths.ts` |
| Ignore set for the fallback | P22's list | `backend/` |
| Open-at-line | P07 / P19's panel entry point | `frontend/src/components/files/` |
| Cancellation | `AbortController` pattern | `frontend/src/hooks/chat/useAbortController.ts` |
| Offset-range highlighting | P08's approach | `frontend/src/components/SearchResults.tsx` |
| Palette source contract | `PaletteSource` (P17) | `frontend/src/hooks/palette/` |

---

## 8. Data model & persistence

**None.** Searches run on demand; results live in component state.

Recent queries would be a reasonable `AppSettings` addition, but the settings-migration
coordination already spans five PRDs (P24 §7.3), and this is not worth being the sixth.
Session-local recents are sufficient.

---

## 9. Security implications

| Threat | Mitigation |
| --- | --- |
| Path traversal via glob | §7.3 — reject `../` in globs; root from the route |
| Query treated as a flag | argv array with `--` terminator |
| **ReDoS hanging the server** | §7.4 — subprocess delegation, hard timeout, killable |
| Resource exhaustion on a huge repo | FR-13 result cap, FR-22 timeout |
| Abandoned subprocess | §7.5 — kill on abort |
| Content rendered as markup | Offset ranges, never markup (§7.2) |
| **Secrets surfaced in results** | `.gitignore` respected via `git grep`, so `.env` and similar are excluded by default — the same benefit P22 §9 notes |
| **No authentication** | Unchanged until P14 |

The unauthenticated note is heavier here than for P07. A file *viewer* requires knowing a path;
**search is a discovery tool.** An unauthenticated caller with search can locate credentials
across an entire project in one request. It changes the practical exploitability of the same
underlying exposure, and it is another entry in the case for P14.

---

## 10. Performance & scale

- `git grep` on a large repository is fast — it is optimised for exactly this and avoids
  walking ignored trees entirely.
- The fallback walk is the slow path and is where FR-13, FR-22, and the ignore set matter most.
- Cap results server-side, not client-side — a search matching 100,000 lines must not build a
  100,000-entry response before truncating.
- Stream or chunk if response size becomes a problem; the response shape supports adding a
  cursor later.
- Do not render all matches at once for a file with thousands of hits — cap per file as well as
  overall.

---

## 11. Telemetry & observability

Via `backend/utils/logger.ts`:

- `logger.api.debug` with duration, files scanned, and match count — the practical way to know
  whether §7.1's approach is fast enough.
- `logger.api.warn` on timeout, on `git grep` failure and fallback, and on rejected globs.

No client analytics.

---

## 12. Test plan

### Backend — `make test-backend`

New `backend/search/gitGrep.test.ts`:

| Test | Asserts |
| --- | --- |
| Literal query finds matches with correct line numbers | FR-1, FR-8 |
| Case-insensitive by default; case-sensitive when requested | FR-2 |
| Regex mode matches | FR-4 |
| **Invalid regex rejected before execution** | §7.4 |
| Glob filters results | FR-5 |
| **Glob containing `../` rejected** | §7.3 |
| `.gitignore`d files excluded | FR-6 |
| Untracked files included | §7.1 |
| Binary files skipped | FR-7 |
| **Query beginning with `-` not treated as a flag** | §7.3 |
| Offset ranges align with returned line content | FR-10 |
| Results capped with `truncated: true` | FR-13 |
| Timeout returns partial results with `timedOut: true` | FR-22, §6 |
| Unreadable file skipped and counted | FR-19 |

New `backend/search/fallback.test.ts`:

| Test | Asserts |
| --- | --- |
| Non-repository project searched successfully | §7.1 |
| Ignore set applied | FR-6 |
| Binary detection works | FR-7 |
| **Pathological regex does not run unbounded** | **§7.4** |

### Frontend — `make test-frontend`

New `frontend/src/hooks/files/useCodeSearch.test.ts`:

| Test | Asserts |
| --- | --- |
| Search runs only on explicit invocation | FR-15 |
| Cancellation aborts the request | FR-16 |
| Superseded results discarded | FR-17 |
| Error state does not clear prior results destructively | §6 |

New `frontend/src/components/files/SearchResults.test.tsx`:

| Test | Asserts |
| --- | --- |
| Results grouped by file with line numbers | FR-11, FR-8 |
| Matches emphasised, not colour-only | FR-10, FR-26 |
| Counts shown and announced politely | FR-12, FR-24 |
| Truncation and timeout states distinguishable | FR-13, §6 |
| Keyboard-navigable and activatable | FR-25 |
| Selecting a match opens the file at that line | FR-14 |
| **Content rendered as text, never markup** | §9 |

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Search this repository for `resolvePermissionMode` → finds the definition and both usages.
2. Search for a term in an untracked file → found.
3. Search with a `*.ts` glob → filtered.
4. Search a term present in `node_modules` → **not** returned.
5. Enter an invalid regex → clear inline error, no search runs.
6. Enter a pathological regex on a large repo → times out with partial results, **server stays
   responsive**.
7. Cancel a running search → stops promptly; confirm no orphaned `git grep` process remains.
8. Search a non-git directory → fallback works.
9. Select a match → opens at the correct line.
10. Keyboard-only end to end.

Checks 6 and 7 are the ones that matter most.

---

## 13. Rollout & migration

Additive: one endpoint, one panel section. No persistence, no migration, no wire change to
existing endpoints. Minor release.

**After P07.** Registers as a P17 palette source when that lands.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **User regex hangs the server** | **Medium** | **High** | §7.4 subprocess delegation, hard timeout, killable; fallback bounded |
| 2 | Abandoned subprocess keeps running | Medium | Medium | §7.5 kill on abort; manual check 7 |
| 3 | Two code paths (git / fallback) diverge in behaviour | **Medium** | Medium | Shared result shape; parallel test suites |
| 4 | `git grep` misses untracked agent-created files | **Medium** | **High** | §7.1 `--untracked` by default |
| 5 | Huge result sets exhaust memory | Medium | High | §10 server-side cap, per-file cap |
| 6 | **Search makes an unauthenticated API materially more exploitable** | **Certain** | Medium | §9 acknowledged; strengthens P14 |
| 7 | Glob escapes the project root | Low | High | §7.3 rejection; test |
| 8 | A native search dependency is added later | Low | Medium | §2, §7.1 rationale recorded |

---

## 15. Acceptance criteria

- [ ] Literal search across the project, case-insensitive by default
- [ ] Case-sensitivity and regex available as explicit options
- [ ] **Invalid regex rejected before execution**
- [ ] Glob filtering, with `../` globs rejected
- [ ] `.gitignore`d and ignored directories excluded; **untracked files included**
- [ ] Binary files skipped
- [ ] Results grouped by file with line numbers and highlighted matches
- [ ] Match counts shown; results capped with truncation indicated
- [ ] Selecting a match opens the file at that line
- [ ] Search explicitly invoked, cancellable, non-blocking
- [ ] **Hard server-side timeout returning partial results**
- [ ] **Subprocess killed on client abort**
- [ ] Confined to the project root; argv arrays with `--` terminator
- [ ] Non-repository projects work via the fallback
- [ ] Match emphasis not colour-only; results keyboard-navigable; counts announced
- [ ] **No native or platform-specific search dependency**
- [ ] `make check` passes under both runtimes

---

## 16. Open questions

1. **Is `git grep` fast enough, and is the two-path design worth it?** A single
   pure-TypeScript implementation would be simpler and would behave identically everywhere, at
   the cost of speed and reimplemented ignore handling. Measure before committing.
2. **Should `rg` be used opportunistically when present on PATH?** It would be faster still,
   costs nothing when absent, but adds a third code path. Probably not worth it.
3. **What is the right timeout?** Long enough for a large repository, short enough that a
   pathological pattern does not tie up the server. 10 seconds is a reasonable starting point,
   needing measurement.
4. **Should search results be openable in the diff view** when the file has uncommitted
   changes? A natural link to P16 and genuinely useful during review.
5. **Should the fallback support regex at all?** Restricting the non-git path to literal search
   would remove the in-process ReDoS risk entirely, at the cost of an inconsistent feature set
   between project types. Arguably worth it.

Question 5 is the cleanest available answer to risk 1 and deserves serious consideration.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| `git grep` invocation and output parsing | 5 h |
| Fallback walk-and-scan | 5 h |
| Timeout, cancellation, subprocess kill | 4 h |
| Endpoint, validation, glob safety | 3 h |
| Shared types | 1 h |
| `useCodeSearch` hook | 3 h |
| `SearchPanel` + `SearchResults` | 6 h |
| Open-at-line integration | 1.5 h |
| Backend tests, both paths | 6 h |
| Frontend tests | 4 h |
| Manual verification incl. ReDoS and orphan checks | 3 h |
| **Total** | **≈41.5 h — 5–6 days** |

The two-path design (§16.1) is roughly a quarter of the effort. Collapsing to one
implementation would save meaningfully and is worth deciding before starting.

---

## 18. References

- `backend/handlers/projectSetup.ts:193` — argv-array git invocation with `--`
- `backend/utils/paths.ts` — `resolveWithinRoot` (P07 §7.3)
- `frontend/src/hooks/chat/useAbortController.ts` — cancellation pattern
- `CLAUDE.md` § "Single Binary Distribution" — why `@vscode/ripgrep` is rejected
- `CLAUDE.md` § "Backend" — route-ordering constraint
- `../01-claudecodeui-deep-scan.md` §3.3, §3.5 — competitor's ripgrep-based search
- `../03-feature-comparison-matrix.md` — `FILE-05`
- `../04-uiux-workflow-comparison.md` §2 Journey B, §6
- `P07-file-tree-read-only-file-viewer.md` §7.3 — confinement
- `P08-cross-session-conversation-search.md` §7.2, §9 — offset-range approach and ReDoS avoidance
- `P22-at-mention-file-references.md` §7.2 — the `git ls-files` precedent for ignore handling
