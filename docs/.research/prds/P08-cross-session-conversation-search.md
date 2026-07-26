# P08 — Cross-Session Conversation Search

| Field | Value |
| --- | --- |
| **Priority** | **P08** of 30 |
| **Score** | **16.0** |
| **Inputs** | Value 4 · Reach 4 · GapWeight ×2.0 · Effort 2 |
| **Category** | Session & Conversation Management |
| **Matrix features** | `SESS-03` (search across conversations) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui **4** |
| **Effort** | **2** |
| **Depends on** | Nothing. Surfaces best inside P17 (command palette) |
| **Blocks** | `SESS-11` (cross-project session view) |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio can list conversations but cannot search them. `HistoryView` shows a list of
sessions for the current project, each with a `lastMessagePreview` truncated to 50
characters (`MESSAGE_CONSTANTS.SUMMARY_MAX_LENGTH`, `frontend/src/utils/constants.ts:18`).
That is the entire retrieval mechanism: scan a list of 50-character previews by eye.

There is no search within a conversation, none across conversations, and none across
projects.

From `04-uiux-workflow-comparison.md` §2 Journey D:

> PDLC Studio's history browsing degrades badly with use. It is fine at 10 conversations and
> unusable at 300 — and the users who like the product most will hit 300 fastest.

That last clause is the argument for this PRD. The failure mode scales with engagement: the
more valuable the product is to someone, the worse this gets for them. A user with two years
of sessions has a genuinely large personal archive of solved problems and no way to reach
into it.

The data is all there. `backend/history/` contains a substantial parsing stack —
`parser.ts` (206 lines), `conversationLoader.ts` (144), `timestampRestore.ts` (123),
`grouping.ts` (117), `pathUtils.ts` (65) — that already reads Claude Code's JSONL
transcripts and turns them into structured conversations. Search is a consumer of
machinery that exists.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui uses two mechanisms:

- **`fuse.js ^7.0.0`** — fuzzy matching *(inferred scope: sessions and/or files)*
- **`@vscode/ripgrep ^1.17.1`** — full-text search at ripgrep speed

Both are backed by a **SQLite session index** whose `session` table carries `id`, `provider`,
`provider_session_id`, `jsonl_path`, and token columns. The index is what makes search over a
large archive fast: it does not re-parse JSONL on every query.

**PDLC Studio must not adopt SQLite.** `SESS-04` is explicitly rejected in
`06-prioritization-and-roadmap.md` §4 — a database contradicts single-binary distribution,
and `01-claudecodeui-deep-scan.md` §9 argues the same. The note in the matrix is explicit:
*"P08 delivers search without one."*

`@vscode/ripgrep` is also unattractive here: it ships platform-specific native binaries,
which is precisely the class of dependency the project fought to remove from its
`deno compile` output (the 428 MB → 94 MB reduction documented in `CLAUDE.md`).

**So this PRD specifies search that re-reads JSONL on demand**, with bounded scope and a
lightweight in-memory index built lazily. §10 addresses whether that is fast enough.

---

## 3. Goals & non-goals

### Goals

1. Find a past conversation by content, not just by scanning previews.
2. Search across all conversations in the current project.
3. Show enough context in results to identify the right conversation without opening each.
4. Open a result directly at the matching point.
5. Introduce no database and no native dependency.

### Non-goals

- **Cross-project search.** `SESS-11`, deferred. This PRD scopes to the current project; the
  endpoint shape should not preclude widening later.
- **A persistent index.** Deferred with `SESS-04`. See §16 for when this becomes necessary.
- **Semantic or embedding-based search.** Would require a model call per query.
- **Search over file contents.** That is P25.
- **Regex search.** Considered and deferred to §16 — substring plus token matching covers
  the common case at a fraction of the complexity.
- **Replacing `HistoryView`.** Search augments the existing list.

---

## 4. Personas & user stories

**Marcus — remembers solving this before.**

> As a returning user, I want to search my conversations for "websocket reconnect", so that
> I can find the session where I already worked this out.

**Priya — looking for a command.**

> As a user, I want to find the session where Claude gave me a working `ffmpeg` invocation,
> so that I do not have to re-derive it.

**Devon — auditing.**

> As someone reviewing what an agent did, I want to find every session that touched
> `auth/session.ts`, so that I can trace a change back to its conversation.

---

## 5. Functional requirements

### Query

- **FR-1** A user **MUST** be able to search conversations in the current project by free
  text.
- **FR-2** Matching **MUST** be case-insensitive by default.
- **FR-3** Multi-word queries **MUST** match conversations containing all terms, not
  necessarily adjacent.
- **FR-4** Quoted phrases **SHOULD** match as exact substrings.
- **FR-5** Search **MUST** cover user messages and assistant text content.
- **FR-6** It **SHOULD** cover tool inputs and results — this is what makes Devon's
  file-path query work — but **MUST** be able to exclude them, since tool output is verbose
  and can drown user-authored text.

### Results

- **FR-7** Results **MUST** be ranked, most relevant first.
- **FR-8** Each result **MUST** show the session identity, timestamp, and a **matching
  excerpt** — not the generic `lastMessagePreview`.
- **FR-9** Matched terms **MUST** be visually highlighted in the excerpt.
- **FR-10** Results **MUST** be capped, with an indication when more exist.
- **FR-11** Selecting a result **MUST** open that conversation and scroll to the matching
  message.
- **FR-12** Zero results **MUST** produce an explicit empty state, distinguishable from a
  not-yet-searched state.

### Behaviour

- **FR-13** Search **MUST** be debounced; it **MUST NOT** issue a request per keystroke.
- **FR-14** A query superseded by a newer one **MUST** be cancelled or its result discarded —
  results **MUST NOT** arrive out of order.
- **FR-15** Search **MUST** show a loading state and **MUST NOT** block the UI.
- **FR-16** A corrupt or unparseable transcript **MUST** be skipped with a warning, not fail
  the whole search.

### Accessibility

- **FR-17** The input **MUST** have an associated label.
- **FR-18** Result count **MUST** be announced via a polite live region.
- **FR-19** Results **MUST** be keyboard-navigable and activatable.
- **FR-20** Highlighting **MUST NOT** rely on colour alone.

---

## 6. UX & interaction specification

### Where it lives

Two surfaces, one implementation:

1. **Inside `HistoryView`** — a search input above the conversation list, filtering it in
   place. This is the natural home and works without P17.
2. **Inside the command palette** (P17) — once that ships, the same search becomes reachable
   from anywhere.

`06-prioritization-and-roadmap.md` §3 notes P17 as the natural home. **P08 should ship the
`HistoryView` surface first**, keeping the search logic in a hook so P17 can mount it
unchanged.

### Result presentation

```
┌──────────────────────────────────────────────────┐
│  🔍 websocket reconnect                     ✕    │
├──────────────────────────────────────────────────┤
│  8 results                                       │
│                                                  │
│  ▸ 3 days ago · 42 messages                      │
│    …the **websocket** will **reconnect** with    │
│    exponential backoff, capped at 30s…           │
│                                                  │
│  ▸ 2 weeks ago · 17 messages                     │
│    …why does the **websocket** not               │
│    **reconnect** after a laptop sleep?…          │
│                                                  │
└──────────────────────────────────────────────────┘
```

- Excerpt centred on the match with surrounding context (FR-8).
- Matched terms emphasised — with weight or an underline, not colour alone (FR-20).
- Relative timestamps via `frontend/src/utils/time.ts`.

### States

| State | Behaviour |
| --- | --- |
| Not searched | Normal conversation list |
| Typing, below minimum length | List unchanged; no request |
| Searching | Loading indicator; previous results dimmed but visible |
| Results | Ranked list with excerpts |
| No results | "No conversations match *query*" + a hint to broaden |
| Error | Error message with retry; list still reachable |
| Partial failure | Results shown, plus "some conversations could not be read" (FR-16) |

The partial-failure state matters: a single malformed JSONL file must degrade one result,
not the feature.

---

## 7. Technical design

### 7.1 Server-side, not client-side

Search must run on the server. The client would otherwise have to download every transcript
in the project to search them, which is prohibitive for a large archive and wasteful for a
single query.

### 7.2 Endpoint

```
GET /api/projects/:encodedProjectName/histories/search
      ?q=<query>&limit=<n>&includeTools=<bool>
```

> **Route ordering.** `CLAUDE.md` requires literal segments to register before parameterised
> ones. `search` must be registered **before**
> `/api/projects/:encodedProjectName/histories/:sessionId`, or it will be captured as a
> session id. This is the same class of bug the `create`/`clone` ordering note already
> guards against, and it is easy to miss because both routes live under `histories`.

New shared types:

```ts
export interface SearchMatch {
  messageIndex: number;
  excerpt: string;
  ranges: Array<{ start: number; end: number }>;  // offsets within excerpt
}

export interface SearchResult {
  sessionId: string;
  startTime: string;
  lastTime: string;
  messageCount: number;
  score: number;
  matches: SearchMatch[];
}

export interface SearchResponse {
  results: SearchResult[];
  truncated: boolean;
  skipped: number;   // FR-16: transcripts that failed to parse
}
```

Returning **offset ranges** rather than pre-marked HTML keeps the server out of the
presentation layer and avoids any injection surface (§9).

### 7.3 Search implementation

Reuse the existing parsing stack rather than reading JSONL directly:

| Need | Existing thing | Path |
| --- | --- | --- |
| Enumerate a project's sessions | conversation loading | `backend/history/conversationLoader.ts` |
| Parse a transcript | parser | `backend/history/parser.ts` |
| Encoded name → history dir | `pathUtils` | `backend/history/pathUtils.ts` |
| Grouping/summarising | `grouping.ts` | `backend/history/` |

Algorithm:

1. List session files for the project.
2. **Sort newest-first** and process in that order, so an early exit under `limit` returns
   the most likely-relevant results.
3. For each: parse, extract searchable text per message, test the query.
4. Score, collect excerpts with offsets, stop at `limit`.

**Scoring** should stay simple and explainable: term frequency, plus a bonus for matches in
user messages over tool output, plus a recency tiebreak. Resist a relevance algorithm nobody
can debug.

### 7.4 Content extraction

Per `CLAUDE.md`, assistant content is `BetaMessage` content blocks under `message.content`,
user content is a `MessageParam` whose `content` may be a **plain string rather than a block
array**, and a `tool_use` block's `input` is typed `unknown`.

So extraction must handle: string content, text blocks, thinking blocks, tool-use inputs
(arbitrary JSON), and tool results. `frontend/src/utils/contentUtils.ts` does the analogous
job client-side, but this is server-side and must be written against the same rules —
narrowing rather than assuming.

### 7.5 Caching

No persistent index (§3). But re-parsing every transcript per keystroke would be
unacceptable even with debouncing.

**An in-memory, per-process cache** of extracted searchable text, keyed by session file path
and invalidated by mtime:

```ts
Map<string, { mtimeMs: number; text: string[] }>
```

- First search in a project pays the parse cost.
- Subsequent searches are string operations over memory.
- A modified transcript re-parses on mtime change.
- The cache **must be bounded** — an LRU capped by total characters, not entry count, since
  transcripts vary enormously in size.

This is the design's main bet, and §10 sizes it.

### 7.6 Frontend

| Component | Purpose |
| --- | --- |
| New `frontend/src/hooks/useConversationSearch.ts` | Query state, debounce, cancellation |
| New `frontend/src/components/SearchResults.tsx` | Ranked results with excerpts |
| Modify `frontend/src/components/HistoryView.tsx` | Mount the input and results |

Cancellation (FR-14) via `AbortController` — the same pattern as
`frontend/src/hooks/chat/useAbortController.ts`.

Highlighting renders from the returned offset ranges by splitting the excerpt string and
wrapping matched segments in an Astryx emphasis component. **Never** by injecting HTML.

---

## 8. Data model & persistence

**No persistence.** The cache is process memory and is lost on restart, which is acceptable —
the first search after a restart is slower and every subsequent one is fast.

| Datum | Store | Lifetime |
| --- | --- | --- |
| Extracted searchable text | Bounded in-memory LRU | Process |
| Query and results | React state | Component |
| Recent queries | Not persisted (see §16) | — |

---

## 9. Security implications

Modest, but three things are worth stating.

1. **No new read surface, but a much more efficient one.** The API already exposes
   conversation contents at `/api/projects/:encoded/histories/:sessionId`. Search does not
   expose anything new — but it does turn "read one conversation you know the id of" into
   "grep everything", which is materially more useful to an unauthenticated attacker.
   Conversations routinely contain source code, file paths, and sometimes secrets. This is
   another argument for P14, not against P08 — but it should be stated rather than glossed.

2. **No injection surface.** Offsets, not markup (§7.2). The client wraps segments in
   components; nothing is `dangerouslySetInnerHTML`-ed. PDLC Studio has no `rehype-raw`
   equivalent, so there is no existing raw-HTML path to fall into.

3. **ReDoS is avoided by construction.** FR-4 specifies substring and token matching, not
   user-supplied regex. If regex is ever added (§16), it needs a timeout or a safe engine.

Resource exhaustion: an unbounded query over a huge archive could pin CPU. Mitigated by
`limit`, newest-first early exit, and the bounded cache.

---

## 10. Performance & scale

The design's viability rests on this section.

**Rough sizing.** A busy user might have 500 sessions averaging 200 KB of JSONL — about
100 MB total.

| Phase | Cost |
| --- | --- |
| Cold search (parse all) | Seconds. **Too slow for interactive use.** |
| Warm search (in-memory) | Tens of milliseconds. Fine. |

So the cold path needs handling:

- **Newest-first with early exit** (§7.3) means a query matching recent conversations
  returns without touching the archive's tail.
- **Warm the cache lazily in the background** when `HistoryView` opens, before the user has
  typed. By the time a query arrives, recent sessions are likely already parsed.
- **Stream or paginate** if cold-path latency proves unacceptable — the endpoint shape
  supports adding a cursor later.

**Memory**: extracted text is smaller than raw JSONL (structure and metadata dropped), but
still substantial. The LRU **must** be capped by total characters. A cap around 50 MB is a
reasonable starting point and must be tunable.

**If measured cold-path performance is unacceptable at realistic archive sizes, that is the
signal that `SESS-04` (a persistent index) needs revisiting** — see §16. This PRD should
include the measurement, not just the implementation.

---

## 11. Telemetry & observability

Server-side, via `backend/utils/logger.ts`:

- `logger.api.warn` per transcript that fails to parse (feeds FR-16's `skipped`).
- `logger.api.debug` with query duration, sessions scanned, cache hit rate — **this is how
  the §10 question gets answered in practice** rather than by estimate.

No client analytics.

---

## 12. Test plan

### Backend — Deno test runner, `make test-backend`

New `backend/history/search.test.ts`:

| Test | Asserts |
| --- | --- |
| Single term matches user message content | FR-1, FR-5 |
| Matching is case-insensitive | FR-2 |
| Multi-word matches non-adjacent terms | FR-3 |
| Quoted phrase matches exact substring only | FR-4 |
| Tool input matched when `includeTools=true` | FR-6 |
| Tool input **not** matched when false | FR-6 |
| Results ranked with user-message matches above tool output | FR-7 |
| Excerpt centres on the match | FR-8 |
| Offset ranges align with the returned excerpt | FR-9 |
| Results capped; `truncated` set | FR-10 |
| **Corrupt transcript skipped; others still returned; `skipped` incremented** | FR-16 |
| Empty query returns no results rather than everything | Boundary |
| User content as a plain string handled | §7.4 |
| User content as a block array handled | §7.4 |

New `backend/handlers/historySearch.test.ts`:

| Test | Asserts |
| --- | --- |
| Endpoint returns well-formed `SearchResponse` | §7.2 |
| **`/histories/search` is not captured as a session id** | §7.2 route ordering |
| Cache re-parses when mtime changes | §7.5 |
| Cache serves from memory when mtime unchanged | §7.5 |
| LRU evicts by total characters | §7.5 |

### Frontend — Vitest, `make test-frontend`

New `frontend/src/hooks/useConversationSearch.test.ts`:

| Test | Asserts |
| --- | --- |
| Debounces; one request for rapid typing | FR-13 |
| **Superseded request discarded; results never out of order** | FR-14 |
| Below minimum length issues no request | States |
| Error state exposed, list still reachable | States |

New `frontend/src/components/SearchResults.test.tsx`:

| Test | Asserts |
| --- | --- |
| Renders excerpts with matched segments emphasised | FR-9 |
| Emphasis is not colour-only | FR-20 |
| Result count announced politely | FR-18 |
| Keyboard navigable and activatable | FR-19 |
| Zero results distinguishable from not-yet-searched | FR-12 |
| Partial-failure notice shown when `skipped > 0` | FR-16 |
| Selecting a result opens the session at the match | FR-11 |

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Search a project with many sessions → results ranked sensibly.
2. **Measure cold and warm latency** and record it in the PR (§10, §11).
3. Search a term appearing only in tool output → toggling `includeTools` changes results.
4. Corrupt one JSONL file → search still works, notice shown.
5. Type quickly → one request, no flicker, no out-of-order results.
6. Select a result → opens at the right message.
7. Keyboard-only end to end.

---

## 13. Rollout & migration

Additive: one new endpoint, new shared types, new components. No existing behaviour changes.
No persistence, no migration. Minor release.

Ships independently of P17; when P17 lands, it mounts the same hook.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Cold-path search too slow on a large archive** | **Medium** | **High** | Newest-first early exit, background warming, measurement in §12; escalate to `SESS-04` if it fails |
| 2 | Memory growth from the cache | Medium | High | Character-capped LRU, not entry-capped |
| 3 | **`/histories/search` captured as a session id** | **Medium** | High | Route ordering; dedicated test |
| 4 | Content extraction misses a message shape | Medium | Medium | §7.4 narrowing; tests for string and block-array user content |
| 5 | Out-of-order results from racing requests | Medium | Medium | FR-14 cancellation; explicit test |
| 6 | Tool output drowns user-authored matches | **High** if unhandled | Medium | FR-6 toggle plus scoring bonus for user messages |
| 7 | Search makes an unauthenticated API more attractive to abuse | Certain | Medium | Acknowledged in §9; argues for P14 |
| 8 | One corrupt transcript fails the whole search | Medium | High | FR-16; explicit test |

---

## 15. Acceptance criteria

- [ ] Free-text search over the current project's conversations
- [ ] Case-insensitive; multi-word non-adjacent; quoted phrases exact
- [ ] Covers user and assistant text; tool content toggleable
- [ ] Results ranked, capped, with `truncated` indicated
- [ ] Excerpts centred on matches with offset ranges
- [ ] Matches emphasised without relying on colour
- [ ] Selecting a result opens the session at the matching message
- [ ] Zero results distinguishable from not-yet-searched
- [ ] Debounced; superseded results discarded
- [ ] Corrupt transcripts skipped and counted, not fatal
- [ ] `/histories/search` registered before `/histories/:sessionId`
- [ ] Cache invalidates on mtime and is bounded by total characters
- [ ] Result count announced politely; results keyboard-navigable
- [ ] **Cold and warm search latency measured and recorded**
- [ ] No database, no native dependency
- [ ] `make check` passes

---

## 16. Open questions

1. **Is the no-index design fast enough?** The central question. Resolve by measuring
   (§10, §12) against a realistically large archive. If cold-path latency is unacceptable,
   the honest response is to reopen `SESS-04` with data — a JSON or NDJSON sidecar index
   under `~/.claude`, not SQLite.
2. **Should tool content be searched by default?** Devon's story needs it; Marcus's is
   cleaner without it. Recommendation: **off by default, one toggle away**, since
   user-authored text is what people usually remember.
3. **Should recent queries be remembered?** Cheap via `AppSettings`, and genuinely useful.
   Deliberately left out to keep effort at 2.
4. **Regex support?** Powerful for Devon; adds ReDoS risk (§9) and UI complexity.
   Recommendation: defer until asked for.
5. **How far should cross-project search be anticipated?** `SESS-11` is deferred, but the
   endpoint could take an optional project list now. Recommendation: keep the route
   project-scoped; widening later is a new route, not a breaking change.
6. **Should search cover the *current* live conversation** as well as stored ones? The
   active session may not be flushed to JSONL yet, so results could omit what the user just
   discussed — a surprising gap. Worth checking Claude Code's flush behaviour.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Content extraction from parsed transcripts | 3 h |
| Search + scoring + excerpts with offsets | 4 h |
| mtime-keyed bounded LRU cache | 3 h |
| Endpoint + shared types + route ordering | 2 h |
| `useConversationSearch` hook with debounce + cancellation | 3 h |
| `SearchResults` component | 3 h |
| `HistoryView` integration + open-at-message | 3 h |
| Backend tests | 5 h |
| Frontend tests | 4 h |
| **Performance measurement on a large archive** | 2 h |
| **Total** | **≈32 h — 4 days** |

Slightly above effort 2's nominal 1–3 days; the measurement work and the cache are what push
it. Still well inside effort 3.

---

## 18. References

- `backend/history/parser.ts` (206 lines) — transcript parsing
- `backend/history/conversationLoader.ts` (144 lines) — session enumeration
- `backend/history/pathUtils.ts` — encoded name → history directory
- `backend/handlers/histories.ts` — existing history endpoints and their route registration
- `frontend/src/components/HistoryView.tsx` — the surface to extend
- `frontend/src/hooks/useHistoryLoader.ts` — existing loading pattern
- `frontend/src/hooks/chat/useAbortController.ts` — cancellation precedent
- `frontend/src/utils/constants.ts:18` — `SUMMARY_MAX_LENGTH`
- `frontend/src/utils/time.ts` — relative timestamps
- `CLAUDE.md` § "Assistant payloads use the Anthropic API `Beta*` types"
- `CLAUDE.md` § "Backend" — route-ordering constraint
- `../01-claudecodeui-deep-scan.md` §3.3 — competitor's SQLite index
- `../03-feature-comparison-matrix.md` — `SESS-03`, `SESS-04`
- `../04-uiux-workflow-comparison.md` §2 Journey D
- `../06-prioritization-and-roadmap.md` §4 — why SQLite is rejected
