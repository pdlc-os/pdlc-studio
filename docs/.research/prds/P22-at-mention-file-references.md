# P22 — `@`-Mention File References

| Field | Value |
| --- | --- |
| **Priority** | **P22** of 30 |
| **Score** | **9.0** |
| **Inputs** | Value 4 · Reach 3 · GapWeight ×1.5 · Effort 2 |
| **Category** | Agent Configuration & Extensibility |
| **Matrix features** | `EXT-04` (`@`-mention file references) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui UNVERIFIED |
| **Effort** | **2** |
| **Depends on** | **P07** (file tree data) — hard dependency |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

To point Claude at a specific file today, the user types its path from memory. There is no
completion, no validation, and no feedback until the response comes back — at which point a
typo has cost a round trip, and Claude may have guessed at what was meant or gone looking.

This is the mirror image of P19. P19 makes paths *in Claude's output* clickable; P22 makes
paths *in the user's input* completable. Together they close the loop in both directions.

The friction is small per occurrence and constant in aggregate. Referring to files is one of
the most common things anyone does when talking to a coding agent, and PDLC Studio offers no
assistance with it whatsoever.

There is also a precision benefit. A completed path is a path that exists, spelled correctly,
relative to the right root. A hand-typed one may be any of: misspelled, relative to the wrong
directory, or referring to a file that has since moved.

### Why P22 rather than higher

Reach is 3 rather than 4 — plenty of users will describe files in prose rather than reach for
a completion affordance, and the feature is invisible until discovered. It is also strictly
downstream of P07, which supplies the file data.

Its matrix note is honest about the dependency: *"Cheap once FILE-01 exists."* Before P07,
there is nothing to complete from.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui's `@`-mention support is **UNVERIFIED** — the scan did not read its chat input
components. It has the necessary ingredients (a `file-tree` module, `fuse.js` for fuzzy
matching, `cmdk`) but whether they combine into file mentions in the composer is unknown.

**This PRD's priority does not rest on the competitor.** It rests on the convention: `@` for
entity completion is near-universal in modern editors and chat tools, and Claude Code's own
CLI supports `@` file references — so users arriving from the terminal will *expect* it and
find its absence surprising.

That last point is worth weighing. This is less "add a feature" than "match the behaviour of
the tool this is a front end for."

---

## 3. Goals & non-goals

### Goals

1. Typing `@` in the composer offers file completion.
2. Completion is fuzzy enough to be useful without exact paths.
3. The inserted reference is one Claude interprets as a file reference.
4. It works without leaving the keyboard.
5. It degrades harmlessly when file data is unavailable.

### Non-goals

- **The file tree itself.** P07.
- **Mentioning symbols, functions, or classes.** Requires language intelligence.
- **Mentioning conversations or commands.** P08 and P20 cover those, via P17.
- **Reading file contents into the prompt.** The reference is a path; Claude decides whether
  to read it.
- **Validating that the file still exists at send time.** See §16.3.

---

## 4. Personas & user stories

**Marcus — knows roughly where the file is.**

> As a user, I want to type `@session` and get `src/auth/session.ts`, so that I do not have to
> remember the full path.

**Priya — coming from the CLI.**

> As someone who uses `@` references in the Claude Code terminal, I want the same thing here,
> because its absence makes the web UI feel like a downgrade.

**Devon — referring to several files.**

> As a user, I want to reference three files in one message quickly, so that I can ask about
> their interaction without typing three paths.

---

## 5. Functional requirements

### Trigger and completion

- **FR-1** Typing `@` in the composer **MUST** offer file completion.
- **FR-2** The trigger **MUST** be conservative — it **MUST NOT** fire inside a word or in
  contexts where `@` is ordinary text (email addresses, npm scopes).
- **FR-3** Typing after `@` **MUST** filter candidates.
- **FR-4** Matching **MUST** be fuzzy — a subsequence of the path, not just a prefix.
- **FR-5** Matching **MUST** consider the whole path, so `auth/sess` and `session` both work.
- **FR-6** Results **MUST** be ranked, with filename matches above directory matches.
- **FR-7** Results **MUST** be capped.
- **FR-8** Directories **SHOULD** be completable as well as files.

### Insertion

- **FR-9** Selecting a candidate **MUST** insert its **project-relative** path.
- **FR-10** Insertion **MUST NOT** send the message.
- **FR-11** The inserted form **MUST** be one Claude interprets as a file reference.
- **FR-12** `Escape` **MUST** dismiss without altering the composer.
- **FR-13** Multiple mentions per message **MUST** be supported.

### Data

- **FR-14** Candidates **MUST** come from the active project.
- **FR-15** Ignored directories (`node_modules`, `.git`, build output) **MUST** be excluded.
- **FR-16** Where file data is unavailable, the feature **MUST** degrade silently — `@`
  remains ordinary text.

### Accessibility

- **FR-17** The list **MUST** follow the ARIA combobox/listbox pattern with
  `aria-activedescendant`.
- **FR-18** Arrow keys navigate; `Enter` inserts.
- **FR-19** Focus **MUST** remain in the composer.
- **FR-20** Appearance of the list **MUST** be announced.

FR-19 is the same constraint as P20 §FR-18 and fails the same way if broken: an autocomplete
that moves focus out of a textarea makes continued typing impossible.

---

## 6. UX & interaction specification

```
┌──────────────────────────────────────────┐
│  Why does @sess                          │
│  ┌────────────────────────────────────┐  │
│  │ src/auth/session.ts                │  │
│  │ src/auth/session.test.ts           │  │
│  │ src/api/sessionStore.ts            │  │
│  │ tests/fixtures/sessions/           │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [ Send ]                                │
└──────────────────────────────────────────┘
```

- Filename emphasised, containing directory secondary — the filename is what the user is
  thinking of.
- Directories shown with a trailing separator (FR-8).
- Appears above the composer, as P20's slash list does. **The two must not be able to appear
  simultaneously** — see §7.5.

### Trigger conditions

Deliberately narrow (FR-2):

| Context | Triggers? |
| --- | --- |
| `@` at the start of the composer | **Yes** |
| `@` after whitespace | **Yes** |
| `@` immediately after a word character (`user@host`) | No |
| `@` inside an already-inserted path | No |

Excluding the after-word-character case handles email addresses and npm scopes
(`@astryxdesign/core`), which would otherwise trigger constantly in a codebase that uses
scoped packages — as this one does.

### What gets inserted

**Recommendation: the bare project-relative path**, e.g. `src/auth/session.ts`, with the `@`
removed.

The alternative — keeping `@src/auth/session.ts` — matches the Claude Code CLI's own syntax
and may carry meaning to it. **Which is correct depends on how the Agent SDK handles `@`
references**, and that is §16.1. The distinction matters: if `@` is semantically meaningful
to Claude Code, stripping it loses information; if it is not, keeping it adds noise.

### States

| State | Behaviour |
| --- | --- |
| No `@` | Nothing |
| `@` typed, data loading | Brief affordance; typing not blocked |
| Candidates available | Filtered, ranked list |
| No match | List hides — no empty box over the composer |
| File data unavailable | Nothing; `@` is ordinary text (FR-16) |
| Selected | Path inserted, list dismissed, cursor after the path |

---

## 7. Technical design

### 7.1 Where candidates come from

P07 provides the file tree, but **lazily** — it fetches children on expansion (P07 FR-2), so
at any moment the client knows only the parts of the tree the user has opened. That is
insufficient for completion, which must match against files the user has never browsed to.

Two options:

| Option | Assessment |
| --- | --- |
| Reuse P07's lazily-loaded tree | No new endpoint. But only completes already-visited paths — **fails the primary use case** |
| **A flat file-list endpoint** | One request returns all candidate paths; completion is then instant and complete |

**Recommendation: a flat list endpoint.** Completion that only knows about folders you have
already opened is worse than useless — it would be unpredictable.

```
GET /api/projects/:encodedProjectName/files/list?limit=<n>
```

> **Route ordering.** Same constraint as P06, P08, P15, P20 — this parameterised route sits
> with `histories` and must not precede `create`, `clone`, or `recent` (`CLAUDE.md`).

```ts
export interface FileListResponse {
  paths: string[];      // project-relative, directories suffixed with "/"
  truncated: boolean;
  total: number;
}
```

A flat string array is deliberately minimal — for 10,000 files it is far smaller than a
structured tree, and completion needs nothing else.

### 7.2 Building the list

Walk the project directory, excluding FR-15's ignored set.

- **`.gitignore` should be respected** where the project is a git repository. That is the
  user's own statement of what is not interesting, and it is far better than a hard-coded
  list. `git ls-files --cached --others --exclude-standard` gives exactly this in one
  command, and P15 §7.1 already establishes shelling out to git as the pattern here.
- **Where the project is not a repository**, fall back to a walk with the hard-coded ignore
  set.
- Cap the result (FR-7 / `truncated`), because a repo with a vendored dependency tree can
  contain hundreds of thousands of paths.

Using `git ls-files` is the single best decision available in this PRD: it is fast, it
respects the user's ignore rules, and it avoids walking `node_modules` entirely rather than
walking it and discarding.

### 7.3 Caching

The list changes as the agent creates and deletes files. Options:

- Cache per project with a short TTL, refreshed when the composer opens the list.
- Invalidate on chat-turn completion, the same signal P15 §FR-8 uses for git status.

The second is better and costs nothing extra — the signal already exists in
`useClaudeStreaming`.

Stale entries are low-harm: completing a deleted file produces a path Claude reports as
missing, which is recoverable. Missing a newly created file is more annoying, which is why
turn-completion invalidation matters.

### 7.4 Matching

Subsequence matching over the whole path (FR-4, FR-5), scored by:

- match in the filename over match in a directory (FR-6)
- contiguity of matched characters
- shorter paths over longer ones
- shallower paths over deeper ones

**No `fuse.js` or equivalent.** A subsequence scorer over a string array is well under 100
lines, and adding a dependency for it contradicts the size discipline documented in
`CLAUDE.md` and applied in P14 §7.2 and P17 §7.1. If matching quality proves inadequate,
that is the point to reconsider — with evidence.

### 7.5 Coexistence with P20

Both P20 (slash commands) and P22 render an autocomplete above the composer, and both bind
arrow keys and `Enter`.

**They must share one mechanism**, not two competing listeners. The composer should own a
single "active completion" concept with at most one provider active at a time:

| Trigger | Provider |
| --- | --- |
| `/` at start of empty composer | Slash commands (P20) |
| `@` at start or after whitespace | File mentions (P22) |

Whichever PRD lands first should build the shared completion surface; the second adds a
provider. Building two independent autocompletes would produce conflicting `Enter` handling —
the exact risk P20 §14.1 already flags — and would be difficult to untangle later.

**This is the most important cross-PRD note here** and should be agreed before either starts.

### 7.6 Components

| Item | Purpose |
| --- | --- |
| New `frontend/src/hooks/chat/useFileMentions.ts` | Fetch, cache, match |
| New `frontend/src/utils/fuzzyMatch.ts` | Subsequence scorer |
| Modify the shared completion surface (§7.5) | Register the provider |
| New `backend/handlers/fileList.ts` | The flat list endpoint |

### 7.7 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Safe git invocation | `runtime.runCommand` argv pattern | `backend/handlers/projectSetup.ts` |
| Path confinement | `resolveWithinRoot` (P07) | `backend/utils/paths.ts` |
| Turn-completion signal | `useClaudeStreaming` | `frontend/src/hooks/` |
| Completion surface | Shared with P20 | `frontend/src/components/chat/` |
| Combobox pattern | Astryx | design system |
| Encoded project name | `getEncodedProjectName` | `backend/history/pathUtils.ts` |

---

## 8. Data model & persistence

**None persisted.** The file list is fetched and cached in memory per session.

| Datum | Store | Lifetime |
| --- | --- | --- |
| File path list | React state / short-lived server cache | Until invalidated |
| Active completion state | React state | Until dismissed |

---

## 9. Security implications

Modest.

**Path disclosure.** The flat list endpoint returns every non-ignored path in the project.
That is more comprehensive than P07's lazy tree, though not different in kind — P07's
endpoint would return the same information to anyone who walked it. On an unauthenticated
API (until P14) this is one more read surface.

Respecting `.gitignore` (§7.2) has a **security benefit** beyond convenience: it excludes
`.env` files and similar secrets from completion, which a naive walk would happily list.
That is a good reason to prefer `git ls-files` even where performance would not require it.

**Path confinement** reuses P07's `resolveWithinRoot`. The list is generated server-side from
the project root, so client-supplied paths are not involved in generating it.

**Inserted text is user input**, not model output — it goes into the composer and is sent as
part of the message, subject to the same handling as any typed text. No new rendering path.

---

## 10. Performance & scale

- `git ls-files` on a large repository is fast — it reads the index rather than walking the
  filesystem. This is the main performance argument for §7.2.
- A non-git project requires a real walk, which is slower and is where FR-15's exclusions and
  the cap matter most.
- The response for a large repo can still be substantial — 20,000 paths at ~40 bytes is
  ~800 KB. The cap (FR-7) should be set with that in mind, and the endpoint should return
  `truncated: true` rather than silently sending everything.
- Matching runs client-side over an array; scoring 20,000 short strings per keystroke is
  feasible but should be measured, and debounced if not.

---

## 11. Telemetry & observability

Via `backend/utils/logger.ts`:

- `logger.api.debug` with path count and duration under `--debug`.
- `logger.api.warn` if `git ls-files` fails and the walk fallback is used.

No client analytics.

---

## 12. Test plan

### Backend — `make test-backend`

New `backend/handlers/fileList.test.ts`:

| Test | Asserts |
| --- | --- |
| Returns project-relative paths | FR-14 |
| Directories suffixed with a separator | FR-8 |
| **`.gitignore`d files excluded in a git repo** | §7.2, §9 |
| Hard-coded ignores applied in a non-git project | FR-15 |
| Result capped with `truncated: true` | FR-7 |
| Non-repository project still returns a list | §7.2 fallback |
| `git ls-files` failure falls back without erroring | §11 |
| Route not captured as a project name | §7.1 |

### Frontend — `make test-frontend`

New `frontend/src/utils/fuzzyMatch.test.ts`:

| Test | Asserts |
| --- | --- |
| Subsequence match on filename | FR-4 |
| Match across directory boundary (`auth/sess`) | FR-5 |
| Filename matches rank above directory matches | FR-6 |
| Contiguous matches rank above scattered | §7.4 |
| Shorter paths rank above longer | §7.4 |
| No match returns empty, not everything | Boundary |

New `frontend/src/hooks/chat/useFileMentions.test.ts`:

| Test | Asserts |
| --- | --- |
| `@` at start triggers | FR-1 |
| `@` after whitespace triggers | §6 |
| **`user@host` does not trigger** | **FR-2** |
| **`@astryxdesign/core` does not trigger** | **FR-2** |
| Insertion places the project-relative path | FR-9 |
| Multiple mentions supported | FR-13 |
| Unavailable file data degrades silently | FR-16 |
| List invalidated on turn completion | §7.3 |

Shared completion surface tests (§7.5):

| Test | Asserts |
| --- | --- |
| `Enter` inserts rather than sending while a list is open | §7.5 |
| **Slash and mention lists never open simultaneously** | **§7.5** |
| Focus stays in the composer | FR-19 |
| `Escape` dismisses without altering text | FR-12 |
| `aria-activedescendant` tracks selection | FR-17 |

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Type `@sess` in a real project → relevant files ranked sensibly.
2. Type an email address → no completion.
3. Type `@astryxdesign/core` → no completion.
4. Insert a mention, then another → both present.
5. Have the agent create a file, then complete it → appears after the turn.
6. Open a project with a large `node_modules` → excluded, and the list returns promptly.
7. Open a non-git directory → completion still works.
8. Keyboard-only end to end.
9. Confirm `.env` is not offered in a repo where it is gitignored.

Check 9 is worth doing explicitly — it is the security-relevant consequence of §7.2.

---

## 13. Rollout & migration

Additive: one endpoint, one provider on the shared completion surface. No persistence, no
migration, no wire change to `/api/chat`. Minor release.

**Must ship after P07** (path confinement) and **should coordinate with P20** on the shared
completion surface (§7.5).

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Two independent autocompletes conflict over `Enter`** | **Medium** | **High** | §7.5 shared surface, agreed before either PRD starts |
| 2 | `@` triggers on emails and scoped packages | **Medium** | Medium | FR-2 trigger rules; two explicit negative tests |
| 3 | Completion only knows already-browsed paths | Medium | **High** | §7.1 flat list endpoint, not P07's lazy tree |
| 4 | Large repo produces a huge response | Medium | Medium | §10 cap and `truncated`; `git ls-files` avoids the worst case |
| 5 | Secrets offered in completion | Medium | Medium | §7.2 `.gitignore` respected; explicit test |
| 6 | Stale list misses newly created files | Medium | Low | §7.3 invalidate on turn completion |
| 7 | Inserted form is wrong for Claude Code's `@` semantics | **Medium** | Medium | §16.1 — determine before choosing the insertion format |
| 8 | A fuzzy-match dependency is added unnecessarily | Low | Low | §7.4 rationale recorded |

---

## 15. Acceptance criteria

- [ ] `@` at start or after whitespace offers file completion
- [ ] Does **not** trigger after a word character
- [ ] Fuzzy subsequence matching across the whole path
- [ ] Filename matches ranked above directory matches
- [ ] Directories completable, shown with a trailing separator
- [ ] Results capped, with truncation indicated
- [ ] Candidates exclude `.gitignore`d files in git projects
- [ ] Hard-coded ignores applied in non-git projects
- [ ] Selecting inserts a project-relative path and does **not** send
- [ ] Multiple mentions per message supported
- [ ] `Escape` dismisses without altering the composer
- [ ] Unavailable file data degrades silently
- [ ] **Slash-command and mention completions share one surface and never co-open**
- [ ] Focus remains in the composer; combobox ARIA pattern followed
- [ ] No fuzzy-matching dependency added
- [ ] `make check` passes

---

## 16. Open questions

1. **Does Claude Code attach meaning to `@` in a prompt?** Determines whether §6 inserts a
   bare path or keeps the `@`. If `@path` is meaningful to the CLI, stripping it loses
   information. Check the CLI's documented behaviour before choosing.
2. **Should P07's tree endpoint and this flat list be one endpoint?** They serve different
   access patterns — lazy hierarchical versus complete flat — but share a walk. Worth
   considering whether one endpoint with a mode parameter is cleaner than two.
3. **Should insertion validate the file still exists at send time?** A file completed and
   then deleted before sending would produce a confusing response. Probably not worth the
   round trip; Claude reports the missing file clearly enough.
4. **Should mentions be visually marked in the composer** after insertion, as chips rather
   than plain text? Prettier and clearer, but complicates a plain textarea considerably.
   Recommendation: plain text.
5. **Should recently mentioned files rank higher?** Cheap session-local state, and likely a
   real improvement — users tend to discuss the same files repeatedly.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Resolve §16.1 insertion format | 1 h |
| Flat list endpoint with `git ls-files` + walk fallback | 4 h |
| Caching and turn-completion invalidation | 2 h |
| Fuzzy matcher and scorer | 3 h |
| `useFileMentions` hook | 3 h |
| Shared completion surface work (if P22 lands first) | 4 h |
| Backend tests | 3 h |
| Frontend tests | 4 h |
| Manual verification | 1.5 h |
| **Total** | **≈25.5 h — 3.5 days** |

Drops to roughly **21 h** if P20 has already built the shared completion surface.

---

## 18. References

- `backend/handlers/projectSetup.ts:193` — argv-array git invocation pattern
- `backend/utils/paths.ts` — `resolveWithinRoot` (P07 §7.3)
- `backend/history/pathUtils.ts` — `getEncodedProjectName`
- `frontend/src/components/chat/ChatInput.tsx` — composer
- `frontend/src/hooks/useClaudeStreaming.ts` — turn-completion signal
- `CLAUDE.md` § "Backend" — route-ordering constraint
- `CLAUDE.md` § "Single Binary Distribution" — dependency discipline behind §7.4
- `../03-feature-comparison-matrix.md` — `EXT-04`
- `P07-file-tree-read-only-file-viewer.md` §7.3 — path confinement and the lazy tree
- `P20-slash-command-discovery.md` §7.5 — the completion surface this must share
- `P19-jump-to-file-from-transcript.md` — the output-side mirror of this feature
