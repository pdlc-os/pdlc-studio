# P07 — File Tree & Read-Only File Viewer

| Field | Value |
| --- | --- |
| **Priority** | **P07** of 30 |
| **Score** | **16.7** |
| **Inputs** | Value 5 · Reach 5 · GapWeight ×2.0 · Effort 3 |
| **Category** | Code & File Interaction |
| **Matrix features** | `FILE-01` (file tree browser), `FILE-02` (read-only file viewer) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui **5** |
| **Effort** | **3** |
| **Depends on** | Nothing technically. **Interacts with P01** — see §9 |
| **Blocks** | P16 (diff viewer), P19 (jump to file), P22 (`@`-mentions), P25 (code search) |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio scores **0 across the entire Code & File Interaction category**. There is no
file tree, no file viewer, no way to look at a file the agent is discussing without leaving
the application.

The absence is architectural, not accidental. `GET /api/directories` returns **directories
only** — `shared/types.ts:79` states it plainly: *"Subdirectories of `path`, name-sorted.
Files are omitted."* The endpoint exists to serve the launch screen's folder picker, and it
was scoped precisely to that job.

The consequence, from `04-uiux-workflow-comparison.md` §2 Journey B:

> PDLC Studio makes every file access a round-trip through the model — slow, token-expensive,
> and lossy. The transcript is the **only** view of the filesystem.

To see a file, the user asks Claude to print it. To see a different part, they ask again. To
see a file Claude has not mentioned, they ask. Each round trip costs tokens, latency, and
context budget — and the result is a snapshot in a transcript rather than a view of the file
as it is now.

This is the largest single capability gap between the two products, and it is the one that
most directly limits what a user can accomplish without switching to a terminal.

### Why P07 rather than higher

Value 5 and reach 5 — the maximum on both — but effort 3, which is what holds it to rank 7
behind a run of effort-1 items. It is the highest-value item in the pack and the anchor of
Milestone 3 in `06-prioritization-and-roadmap.md` §6.

It is also the **most load-bearing** PRD: four other PRDs (P16, P19, P22, P25) build
directly on the endpoint and rendering component it introduces. Getting its interfaces right
matters more than getting its UI polished.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. **No code may
> be copied.** This section describes observable capability only; the design in §7 is
> independently specified.

claudecodeui scores 5 here, with:

- A **`file-tree`** component module; the README describes an "interactive file tree with
  syntax highlighting and live editing".
- Full **CodeMirror 6** (`@uiw/react-codemirror ^4.23.13`) with language support for CSS,
  HTML, JavaScript, JSON, Markdown, and Python, plus `@codemirror/theme-one-dark` and
  `@replit/codemirror-minimap`.
- Complete file CRUD over HTTP: read/write, list/delete, create, rename, upload, and binary
  serving.
- `chokidar` file watching for live refresh *(inferred)*.

**PDLC Studio should take a strict subset.** The roadmap rejects `FILE-06` (manual file
CRUD) on the grounds that the agent already does it and a parallel manual write path doubles
the write surface; rejects `FILE-09` (live watch) as needing server→client push that NDJSON
cannot provide; rejects `FILE-10` (minimap) as chrome; and defers `FILE-03` (editing)
pending evidence anyone wants it.

**This PRD is read-only by design.** That is not timidity — it is what keeps effort at 3
instead of 5, keeps the security surface at "read" instead of "write", and lets the viewer
ship before the question of editing is settled.

---

## 3. Goals & non-goals

### Goals

1. Browse the project's file tree without leaving the app.
2. View a file's contents with syntax highlighting.
3. Do both without spending model tokens.
4. Confine all access to the project's working directory.
5. Provide a stable file-content endpoint and a reusable render component for P16, P19, P22
   and P25.
6. Preserve the single-surface UX identity — progressive disclosure, not a new IDE.

### Non-goals

- **Editing, saving, creating, renaming, deleting.** `FILE-03` deferred; `FILE-06` rejected.
- **Live file-watch refresh.** `FILE-09` rejected — needs a transport PDLC Studio lacks.
- **Minimap.** `FILE-10` rejected.
- **Binary/image rendering.** `FILE-08`, deferred; this PRD detects and refuses binaries.
- **Full-text search.** That is P25, which will consume this PRD's endpoint.
- **Diff rendering.** That is P16.
- **A tabbed IDE layout.** Explicitly rejected — see §6.

---

## 4. Personas & user stories

**Marcus — following along.** Claude says it modified `src/auth/session.ts`.

> As a user, I want to open that file and read it myself, so that I can verify the change
> without asking Claude to print it back to me.

**Priya — orienting in an unfamiliar repo.**

> As someone new to a codebase, I want to browse its structure, so that I can understand the
> project layout before asking questions about it.

**Devon — cost-conscious.**

> As a user, I want to read files without spending tokens, so that browsing does not consume
> the context budget I need for the actual task.

**Sam — checking the agent's claim.**

> As a reviewer, I want to see the current contents of a file, so that I can confirm what
> the agent says it did is what is actually on disk.

---

## 5. Functional requirements

### Tree

- **FR-1** The tree **MUST** list files and directories within the active project's working
  directory.
- **FR-2** It **MUST** be lazily loaded — expanding a directory fetches its children.
- **FR-3** Entries **MUST** be sorted directories-first, then name-ascending.
- **FR-4** Dot-files and dot-directories **MUST** be hidden by default with an option to
  show them.
- **FR-5** Directories known to be large and uninteresting (`node_modules`, `.git`, `dist`,
  `target`) **MUST NOT** be expanded eagerly. They **MUST** remain expandable on request.
- **FR-6** The tree **MUST** indicate loading state per-directory, not globally.
- **FR-7** It **MUST** offer explicit refresh, since there is no live watching.

### Viewer

- **FR-8** Selecting a file **MUST** display its contents.
- **FR-9** Contents **MUST** be syntax-highlighted where the language is recognised.
- **FR-10** Unrecognised types **MUST** render as plain text, not an error.
- **FR-11** Binary files **MUST** be detected and **MUST NOT** be rendered as text.
- **FR-12** Files above a size threshold **MUST** be truncated with a clear indication,
  never loaded whole.
- **FR-13** Line numbers **MUST** be displayed.
- **FR-14** The viewer **MUST** support deep-linking to a line.

### Access confinement

- **FR-15** The endpoint **MUST** reject any path resolving outside the project's working
  directory.
- **FR-16** Confinement **MUST** be enforced after full path resolution, so `..`, absolute
  paths, and symlinks escaping the root are all caught.
- **FR-17** Symlinks pointing outside the root **MUST** be refused, not followed.
- **FR-18** The working directory **MUST** be supplied per request and validated
  server-side; the client **MUST NOT** be trusted to confine itself.

### Errors

- **FR-19** Missing file → 404 with a clear message; deleted-since-listing is expected.
- **FR-20** Permission denied → 403, distinct from 404.
- **FR-21** Path outside root → 403, and **MUST NOT** reveal whether the target exists.

### Accessibility

- **FR-22** The tree **MUST** use `role="tree"` / `treeitem` with correct `aria-expanded`
  and `aria-level`.
- **FR-23** It **MUST** be navigable by arrow keys per the ARIA tree pattern.
- **FR-24** The viewer **MUST** be scrollable and focusable by keyboard.
- **FR-25** The selected file **MUST** be announced on change.

---

## 6. UX & interaction specification

### The layout question — and why the answer is "not tabs"

claudecodeui solves this with an IDE shell: sidebar plus tab strip. PDLC Studio should
**not** copy that, and this is a deliberate product decision rather than a scoping
convenience.

`04-uiux-workflow-comparison.md` §6 identifies "time to value" and "no navigation to learn"
as two of the product's three core identity properties, and states:

> Nothing in the roadmap should trade them away — which is the explicit reason the top 30
> contains no tabbed-IDE restructuring: the file tree, git panel, and diff viewer are all
> specified as *progressive disclosure from the chat surface*.

So: **a dismissible side panel on `/projects/*`**, not a route, not a tab.

```
┌──────────────┬───────────────────────────────────┐
│ ▾ src        │  Assistant                        │
│   ▾ auth     │  I've updated the session handler │
│     session… │  to expire tokens after 24h.      │
│     login.ts │                                   │
│   ▸ utils    │  ┌─────────────────────────────┐  │
│ ▸ tests      │  │ …                           │  │
│   README.md  │  └─────────────────────────────┘  │
│              │                                   │
│              │  [ composer                    ]  │
└──────────────┴───────────────────────────────────┘
        ↑ toggleable, collapsed by default
```

- Collapsed by default so the first-run experience is unchanged.
- Toggle in the chat header, plus a keyboard shortcut (coordinate with P12).
- Panel state persists per browser via the existing settings mechanism.

**On narrow viewports** the panel **must** overlay rather than compress the chat — a
squeezed chat column is worse than a temporarily hidden one.

### Viewer placement

Selecting a file opens it in a panel adjacent to the tree, or replacing it on narrow
viewports. It does **not** open in the transcript — the transcript is conversation history
and a file view is neither a message nor part of the record.

### States

| State | Behaviour |
| --- | --- |
| Panel collapsed | No fetching at all — zero cost when unused |
| Panel opening, first time | Fetch root listing; skeleton while loading |
| Directory expanding | Per-node spinner (FR-6) |
| File selected, loading | Skeleton in the viewer region |
| File too large | Truncated view with an explicit banner (FR-12) |
| Binary file | "Cannot preview binary file", with size and type (FR-11) |
| File missing | 404 message with a refresh affordance (FR-19) |
| Permission denied | Distinct message (FR-20) |
| Empty directory | "Empty" — not a spinner that never resolves |

### Keyboard

Per the ARIA tree pattern (FR-23): `↑`/`↓` move, `→` expands or descends, `←` collapses or
ascends, `Enter` opens, `Home`/`End` jump. This is a well-specified pattern; implement it
properly rather than approximately, because a half-implemented tree is worse for keyboard
users than a list.

---

## 7. Technical design

### 7.1 Extending the directory endpoint, or adding one

`GET /api/directories` deliberately omits files (`shared/types.ts:79`). Two options:

| Option | Assessment |
| --- | --- |
| Add `?includeFiles=true` | Reuses `resolveBrowsePath` and existing tests. But the endpoint is **deliberately unconfined** (see §9) — the launch screen must browse anywhere. Overloading it with a confined mode risks confusion about which rules apply. |
| **New `GET /api/projects/:encoded/tree`** | Confinement is structural: the project root comes from the route, not a query parameter. Different security contract, different endpoint. |

**Recommendation: a new endpoint.** The two use cases have genuinely different security
contracts — one must browse the whole filesystem, the other must never leave one directory.
Encoding that difference in the URL is clearer than a flag, and it makes FR-15/16/17
enforceable in one place.

### 7.2 New endpoints

```
GET /api/projects/:encodedProjectName/tree?path=<relative>
GET /api/projects/:encodedProjectName/file?path=<relative>&maxBytes=<n>
```

New shared types:

```ts
export interface FileEntryInfo {
  name: string;
  path: string;          // relative to project root
  type: "file" | "directory";
  size?: number;         // files only
}

export interface ProjectTreeResponse {
  path: string;          // relative; "" is the root
  entries: FileEntryInfo[];
}

export interface FileContentResponse {
  path: string;
  content: string;
  encoding: "utf-8";
  truncated: boolean;
  totalBytes: number;
  language?: string;     // hint for highlighting
}
```

> **Route ordering.** `CLAUDE.md` requires literal `/api/projects/*` segments to register
> before `/api/projects/:encodedProjectName/...`. These are *parameterised* routes so they
> sit with `histories`, but they must not be added above `create`, `clone`, or `recent`.

### 7.3 Path confinement — the security core

This is the part that must be right. FR-15/16/17 require:

1. Resolve the project root to an absolute, canonical path.
2. Join the requested relative path.
3. **Fully resolve the result**, including symlinks.
4. Verify the resolved path is the root or a descendant — by path-segment comparison, **not**
   `startsWith`, which matches `/home/user/project-evil` against `/home/user/project`.
5. Reject otherwise with 403, revealing nothing about existence (FR-21).

`backend/utils/paths.ts` (135 lines, with `paths.test.ts` at 98 lines) already owns path
resolution and is the right home. `resolveBrowsePath` handles `~` and absolute paths for the
*unconfined* case; this needs a sibling, e.g. `resolveWithinRoot(root, relative)`, with its
own tests.

**Do not** reimplement this per-endpoint. One function, one test file, used by P07, P16,
P19, P22 and P25.

### 7.4 Binary detection & size limits

- **Binary (FR-11)**: read the first ~8 KB and check for a NUL byte, plus a UTF-8 validity
  check. Extension-based detection alone is insufficient — an extensionless file may be
  either.
- **Size (FR-12)**: `stat` before reading. Above the threshold (suggest 1 MB default), read
  only `maxBytes` and set `truncated: true`. **Never read the whole file into memory first
  and then truncate** — that defeats the purpose on a multi-gigabyte file.

Both use `stat` and read helpers already in `backend/utils/fs.ts`.

### 7.5 Runtime abstraction

`CLAUDE.md`: business logic must not import `Deno.*` or `node:*` directly; it goes through
`backend/runtime/`. If reading a byte range is not currently on the `Runtime` interface
(`backend/runtime/types.ts`, 37 lines), it must be added there and implemented in **both**
`runtime/deno.ts` and `runtime/node.ts`. Adding it to only one is the classic failure here
and will pass tests under one runtime while breaking the other.

### 7.6 Frontend

| Component | Purpose |
| --- | --- |
| New `frontend/src/components/files/FileTree.tsx` | Thin wrapper over Astryx `TreeList` |
| New `frontend/src/components/files/FileViewer.tsx` | Wraps `CodeBlock` — **reused by P16, P19** |
| New `frontend/src/components/files/FilePanel.tsx` | Panel shell + collapse |
| New `frontend/src/hooks/files/useFileTree.ts` | Tree state, lazy loading, caching |
| New `frontend/src/hooks/files/useFileContent.ts` | Fetch + cache file contents |
| Modify `frontend/src/components/ChatPage.tsx` | Mount the panel |

### 7.6a Astryx `TreeList` — and the one real tension

**Astryx ships `TreeList`, documented explicitly for file explorers**, with a `startContent`
slot for folder/document icons and branch connector lines. There is also a `useTreeFocus`
hook implementing the **full WAI-ARIA tree keyboard model**: `↑`/`↓`/`Home`/`End` roam
visible treeitems skipping disabled ones, `→`/`←` carry expand/collapse and
first-child/parent semantics, `Enter`/`Space` activate, and printable characters trigger
typeahead.

**This removes almost all of FR-22 and FR-23's work.** Hand-rolling an ARIA tree was the
largest single risk in the original estimate and it is now a wrapper job.

**But there is a genuine conflict with FR-2 (lazy loading).** Astryx documents `TreeList` as
taking a complete recursive `items: TreeListItemData[]` array, with *"Expansion state is
managed internally"* — and the published prop list exposes **no `onExpand` callback**. Lazy
loading needs exactly that signal: "this node just opened, go fetch its children."

Three ways out, in order of preference:

1. **Check for an unpublished expansion callback.** The prop list may be abridged; inspect
   `TreeListItemData` and the component's types directly before designing around the gap.
2. **Fetch on `onClick` of directory nodes.** `TreeListItemData` does carry `onClick` (the
   Astryx example uses it on leaves). If a directory's `onClick` fires alongside internal
   expansion, that is the hook — populate `children` and let the component re-render.
3. **Depth-limited eager loading.** Fetch two or three levels at once and load deeper on
   demand. Weakens FR-2 but stays within the component's contract.

**Option 3 is the fallback that must not be chosen silently** — on a repo with
`node_modules`, eager loading is exactly the FR-5 hazard. If neither 1 nor 2 works,
FR-2's lazy requirement and Astryx `TreeList` are in real conflict, and the choice is between
a custom tree built on `useTreeFocus` (keeping the ARIA work) or accepting depth limits.

Note also Astryx's own guidance against nesting *"more than 4–5 levels deep"*. Source trees
routinely exceed that. Worth checking how the component behaves at depth 8 before committing.

**Syntax highlighting** must come from Astryx's `CodeBlock`, which already renders
highlighted code in the transcript (`CLAUDE.md`, "Chat UI"). Adding a second highlighting
library would be a direct violation of the design-system rule and would ship two syntax
themes that drift apart.

**Astryx investigation — completed.** `CodeBlock` covers the viewer's requirements outright:

| Requirement | Astryx prop | Status |
| --- | --- | --- |
| FR-13 line numbers | `hasLineNumbers: boolean` (default `false`) | **Satisfied** |
| FR-14 line anchoring | `highlightLines: number[]` (1-indexed) | **Satisfied** |
| FR-9 highlighting | `language: string` | **Satisfied** |
| FR-10 plain-text fallback | `language="plaintext"` | **Satisfied** |
| FR-12 scroll bounding | `maxHeight: number \| string` | **Satisfied** |
| Filename header | `title: string` | Bonus — use it |
| Copy the file | `hasCopyButton` (default `true`) | Bonus — P03 for free |
| Unsupported languages | `tokenizer` override | Escape hatch |
| Full-width layout | `width="100%"` (default is `fit-content`) | **Must set explicitly** |
| Embedded presentation | `container="section"` | Use inside the panel |

Two things to note. `width` defaults to `fit-content`, which is wrong for a file viewer and
must be set to `100%`. And `container="section"` drops the border and radius so the block
blends into the panel rather than looking like a card inside a card.

**Open question 2 in §16 is resolved by this table.**

### 7.7 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Path resolution + tests | `paths.ts` / `paths.test.ts` | `backend/utils/` |
| fs primitives | `exists`, `readDir`, `stat` | `backend/utils/fs.ts` |
| Runtime abstraction | `Runtime` interface | `backend/runtime/types.ts` |
| **Tree rendering** | **Astryx `TreeList`** | design system |
| **ARIA tree keyboard model** | **Astryx `useTreeFocus`** | design system |
| **Highlighted code render** | **Astryx `CodeBlock`** | design system |
| Panel/disclosure primitives | Astryx `Collapsible` | design system |
| Encoded project name | `getEncodedProjectName` | `backend/history/pathUtils.ts` |
| Settings persistence | `useSettings` | `frontend/src/hooks/useSettings.ts` |

---

## 8. Data model & persistence

**No persistence of file content.** Files are read on demand and cached in memory for the
session only.

| Datum | Store | Lifetime |
| --- | --- | --- |
| Tree expansion state | React state | Until panel close |
| File content cache | React state, bounded | Session |
| Panel open/closed | `AppSettings` in `localStorage` | Until cleared |
| Last viewed file | Not persisted | — |

The content cache **must** be bounded — an unbounded cache in a long session browsing a
large repo is a memory leak. An LRU of ~20 files is ample.

---

## 9. Security implications

**This is the most security-sensitive PRD in the top ten, and it deserves a careful reading
of the existing position.**

### The existing justification, and how P01 changes it

`backend/handlers/directories.ts:1-14` documents why unconfined browsing is acceptable
today:

> This endpoint is read-only and deliberately unconfined — the whole point is choosing an
> arbitrary directory. It is not an escalation of what the API can already do: `/api/chat`
> defaults to `bypassPermissions` and can run arbitrary shell commands, so anything that can
> reach this port can already read the filesystem.

That reasoning is sound **today**. But **P01 changes its premise.** Once the default
permission mode is `default`, `/api/chat` no longer runs shell commands without approval, so
"the API can already read anything" stops being true by default.

The consequence for this PRD: a new file-content endpoint **cannot** lean on that
justification. It must be confined on its own merits, which is exactly what FR-15/16/17
require. This is why §7.1 recommends a separate, structurally-confined endpoint rather than
a flag on the unconfined one.

**It is also worth raising as a follow-up**: after P01 ships, `directories.ts`'s header
comment should be revisited, and the unconfined browse endpoint reconsidered. That is out of
scope here but should be filed.

### Threat model for this PRD

| Threat | Mitigation |
| --- | --- |
| Path traversal via `..` | Full resolution then containment check (FR-16) |
| Absolute path injection | Same — resolution is relative to root |
| Symlink escape | Resolve symlinks before checking (FR-17) |
| Prefix confusion (`/project-evil` vs `/project`) | Segment-wise comparison, **never** `startsWith` (§7.3) |
| Existence probing via error differences | 403 for out-of-root regardless of existence (FR-21) |
| Memory exhaustion on huge files | `stat` first, bounded read (FR-12, §7.4) |
| Reading secrets (`.env`, keys) | Within the project root this is **intended** — the agent can read them too. Dot-files hidden by default (FR-4) reduces accidental exposure. |
| **No authentication** | Unchanged by this PRD, and unaddressed until P14. This endpoint is exactly as exposed as every other. |

That last row deserves emphasis: **this PRD adds a read surface to an unauthenticated API.**
It does not make things meaningfully worse — `/api/directories` and `/api/chat` are already
open — but it does add another reason P14 matters.

---

## 10. Performance & scale

- **Lazy loading (FR-2)** is what makes a large repo tractable. Never walk recursively.
- **FR-5**'s handling of `node_modules` matters: expanding it eagerly in a typical JS repo
  would return tens of thousands of entries.
- **Directory listings** should be capped with an indication when truncated; a directory with
  100k files must not produce a 100k-entry response.
- **File reads** bounded by `maxBytes` (FR-12).
- **Content cache** bounded (§8).

---

## 11. Telemetry & observability

Server-side, via `backend/utils/logger.ts`:

- `logger.api.warn` on any rejected out-of-root path — a genuine security signal worth
  seeing.
- `logger.api.debug` for tree and file requests under `--debug`.
- Errors through the existing patterns in `handlers/`.

No client analytics.

---

## 12. Test plan

### Backend — Deno test runner, `make test-backend`

New `backend/utils/paths.test.ts` additions for `resolveWithinRoot` — **the highest-value
tests in this PRD**:

| Test | Asserts |
| --- | --- |
| Simple relative path resolves inside root | FR-15 |
| `../` escape rejected | FR-16 |
| Deep `../../../` escape rejected | FR-16 |
| Absolute path rejected | FR-16 |
| **`/root-evil` not accepted for root `/root`** | §7.3 prefix confusion |
| Symlink pointing outside root rejected | FR-17 |
| Symlink pointing inside root allowed | FR-17 |
| Root itself resolves | Boundary |
| Empty relative path resolves to root | Boundary |

New `backend/handlers/files.test.ts`:

| Test | Asserts |
| --- | --- |
| Tree lists files and directories | FR-1 |
| Sorted directories-first then name | FR-3 |
| Dot-files hidden by default, shown on request | FR-4 |
| File content returned with correct encoding | FR-8 |
| Large file truncated with `truncated: true` | FR-12 |
| **Large file is not fully read into memory** | §7.4 |
| Binary file refused, not returned as text | FR-11 |
| Missing file → 404 | FR-19 |
| Permission denied → 403, distinct from 404 | FR-20 |
| Out-of-root → 403, identical for existing and non-existing targets | FR-21 |

**Runtime parity**: the byte-range read must be tested under both Deno and Node
implementations (§7.5).

### Frontend — Vitest, `make test-frontend`

New `frontend/src/components/files/FileTree.test.tsx`:

| Test | Asserts |
| --- | --- |
| Has `role="tree"`; nodes have `role="treeitem"` | FR-22 |
| `aria-expanded` reflects state | FR-22 |
| `aria-level` correct at depth | FR-22 |
| Arrow-key navigation per ARIA pattern | FR-23 |
| Expanding fetches children lazily | FR-2 |
| Per-node loading state, not global | FR-6 |
| Empty directory shows "Empty", not a spinner | States |
| Selected file announced | FR-25 |

New `frontend/src/components/files/FileViewer.test.tsx`:

| Test | Asserts |
| --- | --- |
| Renders content with line numbers | FR-13 |
| Unknown extension renders as plain text | FR-10 |
| Truncation banner shown when truncated | FR-12 |
| Binary message shown, content not rendered | FR-11 |
| Deep-link to line scrolls and highlights it | FR-14 |
| 404 and 403 render distinct messages | FR-19, FR-20 |

Per `CLAUDE.md`, assert on roles and `aria-*` — never StyleX class names.

### Manual verification

1. Open the panel on a large repo (this one) → root lists quickly.
2. Expand `node_modules` → does not hang; capped or lazy.
3. Open a `.ts` file → highlighted, line-numbered.
4. Open a `.png` → binary refusal, no garbage.
5. Open a very large log → truncated with a banner; memory stable.
6. `curl` the endpoint with `?path=../../etc/passwd` → 403.
7. Create a symlink to `/etc` inside the project, browse it → refused.
8. Narrow the viewport → panel overlays rather than squeezing chat.
9. Keyboard-only: open panel, navigate, open a file, return to chat.
10. Verify under **both** `deno task dev` and `npm run dev` (§7.5).

---

## 13. Rollout & migration

- Additive: new endpoints, new components, new shared types. No existing behaviour changes.
- Panel collapsed by default, so the default experience is unchanged and the risk of
  regressing the launch-to-chat path is near zero.
- Minor release.
- **Ship before P16, P19, P22, P25**, which depend on it.
- Consider shipping the tree and viewer as one unit; a tree that cannot open anything is not
  useful.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Path traversal escapes confinement** | Medium | **Critical** | FR-15/16/17; one shared `resolveWithinRoot`; the nine tests in §12 including prefix-confusion and symlink cases |
| 2 | **Prefix-confusion bug** from `startsWith` | **Medium** | **Critical** | Explicitly called out in §7.3; dedicated test |
| 3 | Huge file read fully into memory before truncation | Medium | High | `stat` first; bounded read; explicit test |
| 4 | `node_modules` expansion hangs the UI | **High** if unhandled | Medium | FR-5; listing caps |
| 5 | Runtime abstraction implemented for Deno only | **Medium** | High | §7.5; parity tests under both runtimes |
| 6 | A second syntax-highlighting library gets introduced | Low | Medium | `CodeBlock` covers every viewer requirement (§7.6); `CLAUDE.md` design-system rule |
| 7 | Panel becomes a de facto IDE and erodes the single-surface identity | Medium | Medium | §6 decision; collapsed by default; no tabs, no route |
| 8 | Adds read surface to an unauthenticated API | **Certain** | Medium | Acknowledged in §9; argues for P14, not against P07 |
| 9 | ~~ARIA tree implemented approximately~~ | — | — | **Retired.** `useTreeFocus` implements the full WAI-ARIA tree model. |
| 10 | **`TreeList` cannot lazy-load, forcing eager fetches** | **Medium** | **High** | §7.6a three options; **option 3 (depth-limited eager) must not be chosen silently** — on a repo with `node_modules` it is the FR-5 hazard |
| 11 | `TreeList` degrades beyond 4–5 nesting levels | Medium | Medium | §16.2b; check at depth 8 before committing |
| 12 | `CodeBlock` left at default `width: fit-content` in the viewer | Medium | Low | §7.6 — must set `width="100%"` and `container="section"` |

---

## 15. Acceptance criteria

- [ ] Tree lists files and directories within the project root
- [ ] Lazy expansion; no recursive walk
- [ ] Directories first, then name-sorted
- [ ] Dot-files hidden by default, toggleable
- [ ] `node_modules`-class directories not eagerly expanded
- [ ] Per-directory loading state
- [ ] Manual refresh available
- [ ] Files render with syntax highlighting via **Astryx `CodeBlock`**
- [ ] Unknown types render as plain text
- [ ] Binary files refused with a clear message
- [ ] Large files truncated, with a banner, without full read into memory
- [ ] Line numbers displayed; deep-link to line works
- [ ] **All traversal, symlink, and prefix-confusion tests pass**
- [ ] Out-of-root returns 403 regardless of existence
- [ ] 404 and 403 are distinguishable
- [ ] `role="tree"`, correct `aria-expanded` / `aria-level`
- [ ] Full ARIA arrow-key navigation
- [ ] Panel collapsed by default; state persists
- [ ] Panel overlays on narrow viewports
- [ ] Byte-range read implemented in **both** Deno and Node runtimes
- [ ] No new syntax-highlighting dependency
- [ ] `make check` passes under both runtimes

---

## 16. Open questions

1. **New endpoint or a flag on `/api/directories`?** §7.1 recommends new, on security-contract
   grounds. Confirm before starting — it shapes four downstream PRDs.
2. ~~Does Astryx `CodeBlock` support line numbers and line anchoring?~~ **Resolved** — yes,
   via `hasLineNumbers` and `highlightLines`. See the table in §7.6.
2a. **Can Astryx `TreeList` support lazy loading?** This replaces the question above as the
   blocking one. `TreeList` manages expansion internally and publishes no `onExpand`
   callback, which conflicts with FR-2. §7.6a sets out three options; resolve before
   estimating the frontend work. **This is now the single largest scoping risk in the PRD.**
2b. **How does `TreeList` behave beyond its recommended 4–5 nesting levels?** Source trees
   routinely go deeper. Check before committing.
3. **What is the right size threshold?** 1 MB is suggested. Too low frustrates on large
   source files; too high risks memory pressure.
4. **Should the panel remember the last-viewed file** across reloads? Convenient, but a
   deleted file would then error on load. Recommendation: no.
5. **How should the tree indicate files the agent has recently modified?** Very valuable
   (it directly serves Journey C) but arguably P15/P16 territory. Worth deciding jointly.
6. **Should `directories.ts`'s unconfined browsing be reconsidered after P01?** Out of scope
   here, but §9 shows its stated justification weakens. File a follow-up.

---

## 17. Effort breakdown

**Revised after the Astryx investigation** (§7.6, §7.6a). `TreeList`, `useTreeFocus` and
`CodeBlock` remove most of the frontend rendering and all of the ARIA work:

| Task | Estimate | Change |
| --- | --- | --- |
| **Resolve the `TreeList` lazy-loading question (§7.6a)** | 3 h | **new, blocking** |
| `resolveWithinRoot` + comprehensive tests | 4 h | — |
| Tree endpoint | 3 h | — |
| File content endpoint incl. binary + truncation | 4 h | — |
| Runtime interface extension, both implementations | 3 h | — |
| Shared types | 1 h | — |
| `useFileTree` hook incl. lazy load + cache | 4 h | — |
| `useFileContent` hook | 2 h | — |
| `FileTree` wrapper over `TreeList` | **2 h** | was 6 h (ARIA now free) |
| `FileViewer` wrapper over `CodeBlock` | **1.5 h** | was 4 h |
| `FilePanel` shell, collapse, responsive overlay | 3 h | — |
| `ChatPage` integration + settings persistence | 2 h | — |
| Backend tests | 5 h | — |
| Frontend tests | **4 h** | was 6 h (less bespoke behaviour to cover) |
| Manual verification incl. both runtimes and tree depth | 3 h | — |
| **Total** | **≈44.5 h — 5–6 days** | was ≈50 h |

Effort stays **3**. The saving is smaller than the component reuse suggests because the
blocking `TreeList` investigation partly offsets it — and because the security-critical path
handling, which is roughly a third of the work, is unchanged and must not be compressed.

---

## 18. References

- `shared/types.ts:63-83` — `DirectoryEntryInfo`, `BrowseDirectoriesResponse`, and the
  files-are-omitted note
- `backend/handlers/directories.ts:1-14` — the unconfined-reads justification P01 weakens
- `backend/utils/paths.ts` + `paths.test.ts` — path resolution home
- `backend/utils/fs.ts` — `exists`, `readDir`, `stat`
- `backend/runtime/types.ts` — the 37-line Runtime interface to extend
- `backend/history/pathUtils.ts` — `getEncodedProjectName`
- `CLAUDE.md` § "Chat UI" — `CodeBlock`, and the rule against hand-rolled equivalents
- `CLAUDE.md` § "Backend" — route-ordering constraint
- `CLAUDE.md` § "Key Design Decisions" — runtime abstraction
- `../01-claudecodeui-deep-scan.md` §3.5 — competitor capability
- `../03-feature-comparison-matrix.md` — `FILE-01`, `FILE-02`
- `../04-uiux-workflow-comparison.md` §2 Journey B, §6
- `../06-prioritization-and-roadmap.md` §3, §4, §6
