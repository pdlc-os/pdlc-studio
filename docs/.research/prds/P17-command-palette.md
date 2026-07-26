# P17 — Command Palette

| Field | Value |
| --- | --- |
| **Priority** | **P17** of 30 |
| **Score** | **12.0** |
| **Inputs** | Value 4 · Reach 3 · GapWeight ×2.0 · Effort 2 |
| **Category** | Agent Configuration & Extensibility |
| **Matrix features** | `EXT-02` (command palette) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui **4** |
| **Effort** | **2** — **revised down; Astryx ships `CommandPalette`** (§2.1) |
| **Depends on** | P12 (shortcut registry) for action metadata |
| **Blocks** | Nothing, but hosts P08 (search) and P20 (slash commands) |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio's capabilities are hard to find. `04-uiux-workflow-comparison.md` §3 identifies
discoverability as **"PDLC Studio's weakest interaction property"** and gives three concrete
examples:

1. **Slash commands** work — `backend/handlers/chat.ts:39-44` strips a leading `/` and
   forwards the rest — but nothing in the UI lists them, hints at arguments, or indicates
   they exist. It is an invisible feature.
2. **Permission modes** cycle via a footer control and `Ctrl+Shift+M`, documented in
   `README.md:288` and `CLAUDE.md` — not in the app.
3. **`allowedTools`** is a first-class wire field (`shared/types.ts:11`) backed by 139 lines
   of command parsing and 171 lines of tests, and **no UI writes it**. The capability is
   fully built and completely unreachable.

A command palette is the standard answer to this class of problem: one memorable entry point
that makes every action findable by typing what you want, rather than by remembering where it
lives or which chord invokes it.

It also becomes the natural home for capabilities landing in adjacent PRDs.
`06-prioritization-and-roadmap.md` §3 records the dependency edges: **P08** (conversation
search) and **P12** (keyboard shortcuts) both surface here, and P20 (slash-command discovery)
is a natural fit.

### Why P17 rather than higher

Reach is 3 rather than 5 — a palette is disproportionately used by keyboard-first users, and
a casual user may never open it. Its value compounds with the PRDs that mount into it, which
is why it sits mid-table alone but is worth sequencing early in Milestone 4.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui depends on **`cmdk ^1.1.1`** — the de facto React command-palette library — and
ships a dedicated `command-palette` component module. It also has `fuse.js ^7.0.0` for fuzzy
matching and `@vscode/ripgrep` for content search, all of which plausibly surface through the
same interface.

The signal is simply that a mainstream product in this category concluded a palette was the
right answer for breadth. **PDLC Studio has less breadth to expose**, which is why this PRD
scopes to actions plus the two search sources from P08 and P20, rather than a universal
launcher.

### 2.1 Astryx ships `CommandPalette` — this changes the estimate

Querying the design system directly resolved the largest scoping question before it was
asked. **Astryx provides a `CommandPalette` component:**

> *Root component. Manages open state, search, keyboard navigation, and composition slots.*

| Prop | Type | Role |
| --- | --- | --- |
| `isOpen` | `boolean` | required — controlled open state |
| `onOpenChange` | `(isOpen: boolean) => void` | required |
| `searchSource` | `SearchSource<T>` | **required — the extension point** |
| `value` | `string` | controlled query |
| `label` | `string` | accessible name |

Consequences:

- **No `cmdk` dependency.** `CLAUDE.md` forbids hand-rolled equivalents of design-system
  components, and the `deno compile` size discipline argues against the dependency anyway.
- **Keyboard navigation and open-state management come for free**, which was the bulk of the
  original estimate.
- **`searchSource` is the architecture.** The design work becomes "what sources exist and how
  do they compose", not "how does a palette work".

Effort drops from a nominal 3 to **2**. §17 reflects this.

The `SearchSource<T>` contract must be read before designing §7.2 — whether it supports
multiple concurrent sources, async results, and grouping determines how P08 and P20 mount.
That is §16.1.

---

## 3. Goals & non-goals

### Goals

1. One keyboard entry point that reaches every application action.
2. Make existing-but-invisible capabilities discoverable by typing.
3. Show each action's keyboard shortcut, so the palette teaches the chords.
4. Provide an extension point that P08 and P20 mount into without restructuring.
5. Add no dependency.

### Non-goals

- **Conversation search itself.** That is P08; this PRD provides the surface.
- **Slash-command discovery itself.** That is P20; same relationship.
- **File search.** P25, later.
- **Replacing existing UI.** The palette is an additional path, never the only path.
- **AI-powered or natural-language command interpretation.** Out of scope.
- **A universal launcher** spanning files, symbols, and settings. Scope to actions plus
  registered sources.

---

## 4. Personas & user stories

**Devon — keyboard-first.**

> As a keyboard user, I want one shortcut that reaches everything, so that I do not have to
> memorise a chord per action.

**Marcus — did not know `Ctrl+Shift+M` existed.**

> As an experienced user, I want to discover capabilities by typing what I want, because I
> only learned about permission-mode cycling by reading the source.

**Priya — new user.**

> As a new user, I want a way to see what this application can do, without reading a README.

**Sam — after P08 ships.**

> As a user looking for a past conversation, I want to search from wherever I am, rather than
> navigating to a history screen first.

---

## 5. Functional requirements

### Invocation

- **FR-1** The palette **MUST** open via a keyboard shortcut registered in P12's registry.
- **FR-2** The shortcut **MUST** be `Ctrl/Cmd+K` — the near-universal convention.
- **FR-3** It **MUST** be dismissible with `Escape` and by clicking outside.
- **FR-4** It **MUST** be reachable by pointer as well, so it is not keyboard-only.
- **FR-5** Opening **MUST** focus the query field immediately.

### Actions

- **FR-6** All actions from P12's shortcut registry **MUST** appear.
- **FR-7** Each **MUST** display its keyboard shortcut where it has one.
- **FR-8** Actions unavailable in the current context **MUST** be omitted or clearly
  disabled — never silently no-op when chosen.
- **FR-9** Choosing an action **MUST** close the palette and perform it.
- **FR-10** Actions **MUST** be grouped by the category already present in P12's registry.

### Search & sources

- **FR-11** Typing **MUST** filter results.
- **FR-12** Matching **MUST** be forgiving — substring at minimum, ideally subsequence, so
  "cmp" reaches "Focus composer".
- **FR-13** The palette **MUST** support multiple result sources, so P08 and P20 mount without
  restructuring.
- **FR-14** Sources **MUST** be able to return results asynchronously without blocking the
  action list.
- **FR-15** Results from different sources **MUST** be visually grouped and labelled.
- **FR-16** An empty query **MUST** show useful default content, not a blank panel.
- **FR-17** No results **MUST** produce an explicit empty state.

### Accessibility

- **FR-18** The palette **MUST** follow the ARIA combobox/listbox pattern, with
  `aria-activedescendant` tracking the highlighted option.
- **FR-19** Arrow keys **MUST** move the selection; `Enter` **MUST** activate.
- **FR-20** Focus **MUST** be trapped while open and **MUST** return to its origin on close.
- **FR-21** Result counts **MUST** be announced politely.
- **FR-22** Shortcut hints **MUST** be exposed as text, not styled glyphs alone.

Most of FR-18 to FR-21 are expected to be satisfied by Astryx's component (§2.1); they are
stated as requirements so they are **verified rather than assumed**.

---

## 6. UX & interaction specification

```
┌──────────────────────────────────────────────┐
│  🔍  focus                                    │
├──────────────────────────────────────────────┤
│  Chat                                         │
│    Focus composer                      ⌘⇧I   │
│    Cycle permission mode               ⌘⇧M   │
│                                               │
│  Navigation                                   │
│    Back to projects                    ⌘⇧P   │
│                                               │
│  Conversations                    (from P08)  │
│    "…websocket reconnect with backoff…"       │
│    3 days ago · 42 messages                   │
└──────────────────────────────────────────────┘
```

- Groups are labelled (FR-15) so a result's origin is obvious.
- Shortcuts sit right-aligned (FR-7) — **this is how the palette teaches chords**, and it is
  the main reason P12 and P17 are worth doing in sequence.

### Empty query (FR-16)

Not blank. Show recent or common actions — the most valuable default is a short list of
actions the user has recently invoked, which requires only local state.

### States

| State | Behaviour |
| --- | --- |
| Closed | Nothing rendered |
| Open, empty query | Default action list (FR-16) |
| Typing | Actions filter instantly; async sources fill in as they resolve |
| Async source pending | Its group shows a loading affordance; **actions remain usable** |
| No results | Explicit empty state (FR-17) |
| Action chosen | Palette closes, action runs, focus returns (FR-20) |

The "actions remain usable while async sources load" rule is what keeps the palette feeling
instant even when P08's search is scanning a large archive.

---

## 7. Technical design

### 7.1 Use Astryx's component

Per §2.1, wrap `CommandPalette` rather than building one. Read the `SearchSource<T>`
contract first (§16.1) — it determines everything below.

**Do not add `cmdk`.** `CLAUDE.md` is explicit: prefer purpose-built design-system components
over hand-rolled equivalents, and app CSS is restricted to the existing app-shell classes.

### 7.2 The source model

The core design work. A source produces results for a query:

```ts
export interface PaletteResult {
  id: string;
  label: string;
  detail?: string;        // secondary line
  group: string;          // FR-15
  shortcut?: string;      // FR-7
  run: () => void;        // FR-9
}

export interface PaletteSource {
  id: string;
  label: string;
  priority: number;                  // group ordering
  isAsync: boolean;                  // FR-14
  query(q: string, signal: AbortSignal): PaletteResult[] | Promise<PaletteResult[]>;
}
```

Three sources at ship time and shortly after:

| Source | Owner | Sync? |
| --- | --- | --- |
| Actions | **P17** — from P12's registry | Sync |
| Conversations | **P08** | Async |
| Slash commands | **P20** | Sync |

The `AbortSignal` matters for FR-14: a superseded query must be cancellable, exactly as P08
§FR-14 requires for its own input. Reuse the `AbortController` pattern already established in
`frontend/src/hooks/chat/useAbortController.ts`.

If Astryx's `SearchSource<T>` supports only a single source, this model composes *into* it —
one adapter that fans out to the registered sources and merges results. That is the fallback
and it is not expensive.

### 7.3 Actions come from P12's registry

P12 §7.2 defines `ShortcutDefinition` with `id`, `label`, `category`, `key`, `modifiers`,
`scope`. Those fields were chosen so this PRD could consume them directly — `label` and
`category` map to `PaletteResult.label` and `group`, and the binding renders as `shortcut`.

**This is the reason the two PRDs must be designed together** (P12 §3.1). If P17 defines its
own action list, the palette and the shortcuts dialog will drift, and FR-7's shortcut hints
will go stale.

If P17 ships first, P12's registry should still be created here rather than a temporary
action list built and later replaced.

### 7.4 Components

| Item | Purpose |
| --- | --- |
| New `frontend/src/components/palette/CommandPalette.tsx` | Wrapper over Astryx |
| New `frontend/src/hooks/palette/usePaletteSources.ts` | Registration and fan-out |
| New `frontend/src/hooks/palette/usePaletteState.ts` | Open state, query, recents |
| New `frontend/src/utils/paletteActions.ts` | Registry → `PaletteResult[]` |
| Modify `frontend/src/App.tsx` | Mount once, above the routes |

Mounting at app level rather than per-route means the palette is available everywhere,
including the launch screen — where "Back to projects" is meaningless and must therefore be
context-filtered (FR-8) via P12's `scope`.

### 7.5 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Palette shell, keyboard nav, ARIA | **Astryx `CommandPalette`** | design system |
| Action metadata | P12 shortcut registry | `frontend/src/utils/constants.ts` |
| Shortcut registration | `useKeyboardShortcuts` (P12) | `frontend/src/hooks/` |
| Platform-correct shortcut display | `platform.ts` (P12) | `frontend/src/utils/` |
| Query cancellation | `AbortController` pattern | `frontend/src/hooks/chat/useAbortController.ts` |
| Conversation results | `useConversationSearch` (P08) | `frontend/src/hooks/` |

---

## 8. Data model & persistence

Almost none.

| Datum | Store | Lifetime |
| --- | --- | --- |
| Open state, query | React state | Session |
| Recently used actions (FR-16) | `AppSettings` in `localStorage` | Until cleared |
| Registered sources | Module registry | Build time |

Recents are the only persisted item, and they are optional. Note that P01, P09 and P10 all
bump `CURRENT_SETTINGS_VERSION`; if this adds a field, it extends **the same** migration
rather than writing a parallel one. That coordination point is now four PRDs wide and worth
tracking explicitly.

---

## 9. Security implications

Minimal, with one requirement worth stating.

**The palette must not become a privilege escalation path.** Every action it exposes must be
an action already reachable through the UI, subject to the same conditions. Specifically:

- FR-8's context filtering is a correctness requirement, not just polish. An action that is
  unavailable must not be invocable merely because the palette listed it.
- If P24 (tool allowlist UI) or P27 (audit log) later register palette actions, those must
  respect the same permission checks their own surfaces apply.

**Result content is rendered as text.** P08's conversation excerpts contain arbitrary
conversation content, including code. As in P08 §9 and P16 §9, results must be built from
structured values, never interpolated as markup.

Standing caveat: unauthenticated until P14 — but the palette adds no endpoint of its own.

---

## 10. Performance & scale

- Action filtering is over a list of ~10–15 entries. Trivial.
- Async sources are the cost. FR-14's non-blocking requirement plus §7.2's `AbortSignal`
  keep a slow P08 search from making the palette feel slow.
- Debounce async sources; do not debounce the action list, which should filter on every
  keystroke.
- The palette should mount lazily or render nothing when closed, so it costs nothing in the
  common case.

---

## 11. Telemetry & observability

None. No analytics. Recents are local state, not telemetry.

---

## 12. Test plan

### Frontend — Vitest + Testing Library, `make test-frontend`

New `frontend/src/hooks/palette/usePaletteSources.test.ts`:

| Test | Asserts |
| --- | --- |
| Sync sources return results immediately | FR-13 |
| Async source resolves without blocking sync results | **FR-14** |
| Superseded query is aborted; stale results discarded | §7.2 |
| Sources ordered by priority | FR-15 |
| A throwing source does not break the palette | Robustness |

New `frontend/src/components/palette/CommandPalette.test.tsx`:

| Test | Asserts |
| --- | --- |
| Opens on `Ctrl/Cmd+K` | FR-1, FR-2 |
| `Escape` closes | FR-3 |
| Query field focused on open | FR-5 |
| **Every registry action appears** | FR-6 |
| Shortcuts displayed alongside actions | FR-7 |
| Shortcut hints exposed as text | FR-22 |
| Out-of-scope actions omitted | **FR-8** |
| Choosing an action closes and runs it | FR-9 |
| Grouped by category with labels | FR-10, FR-15 |
| Subsequence match: "cmp" finds "Focus composer" | FR-12 |
| Empty query shows defaults, not blank | FR-16 |
| No results shows an explicit empty state | FR-17 |
| Arrow keys move selection; `Enter` activates | FR-19 |
| `aria-activedescendant` tracks selection | FR-18 |
| Focus returns to origin on close | FR-20 |
| Result count announced politely | FR-21 |

Per `CLAUDE.md`, assert on roles and `aria-*`, **never** StyleX class names — which matters
more than usual here, since the component is Astryx's and its internals are not ours to
assert on.

### Manual verification

1. `Ctrl/Cmd+K` from chat and from the launch screen → opens in both.
2. On the launch screen, chat-scoped actions absent (FR-8).
3. Type a partial word → subsequence match works.
4. Choose an action → palette closes, action runs, focus returns.
5. With P08 present, type a conversation term → results appear in their own group while
   actions stay usable.
6. Screen reader: options announced, selection tracked, count announced.
7. Confirm shortcut hints match `Ctrl/Cmd+/`'s dialog (P12) exactly — any mismatch means the
   registry is not the single source.

---

## 13. Rollout & migration

Additive: one new surface, one shortcut, no endpoint, no wire change. Minor release.

**Sequencing**: after or alongside P12 (registry), before P08 and P20 mount their sources.
`06-prioritization-and-roadmap.md` §6 places all four in Milestone 4 for this reason.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Astryx's `SearchSource<T>` does not support multiple or async sources** | **Medium** | Medium | §16.1 read the contract first; §7.2 fan-out adapter is the fallback |
| 2 | Palette action list drifts from the shortcuts dialog | Medium | Medium | §7.3 — one registry; manual check 7 |
| 3 | `Ctrl/Cmd+K` collides with a browser or extension binding | Low | Medium | It is the convention; Firefox's search-bar binding is the known case — verify |
| 4 | A slow async source makes the palette feel sluggish | Medium | Medium | FR-14, debounce, abort (§10) |
| 5 | Context-inappropriate actions offered and silently no-op | Medium | Medium | FR-8 as a **correctness** requirement (§9) |
| 6 | `cmdk` added despite Astryx providing the component | Low | Medium | §2.1, §7.1; explicit acceptance criterion |
| 7 | Tests assert on Astryx internals and break on upgrade | Medium | Low | Assert on roles and `aria-*` only |
| 8 | Settings migration collides with P01/P09/P10 | Medium | Low | §8 — extend the shared migration |

---

## 15. Acceptance criteria

- [ ] Opens on `Ctrl/Cmd+K`, closes on `Escape` and outside click
- [ ] Also reachable by pointer
- [ ] Query field focused on open
- [ ] **All actions sourced from P12's registry — no separate list**
- [ ] Shortcuts shown alongside actions, as text
- [ ] Out-of-scope actions omitted or disabled, never silently no-op
- [ ] Results grouped and labelled by category and source
- [ ] Forgiving matching, at least subsequence
- [ ] Multiple sources supported, including async, without blocking actions
- [ ] Superseded async queries aborted
- [ ] Empty query shows useful defaults; no results shows an explicit state
- [ ] ARIA combobox pattern with `aria-activedescendant`
- [ ] Focus trapped while open, returned on close
- [ ] Result count announced politely
- [ ] **Built on Astryx `CommandPalette`; no `cmdk` or equivalent added**
- [ ] Shortcut hints match P12's dialog exactly
- [ ] `make check` passes

---

## 16. Open questions

1. **What is Astryx's `SearchSource<T>` contract?** Blocking for §7.2. Determines whether
   multiple sources and async results are native or need the fan-out adapter. **Resolve
   first.**
2. **Does Astryx's `CommandPalette` handle grouping natively?** FR-15 and FR-10 depend on it;
   if not, grouping must be expressed within a single source's results.
3. **Should the palette also accept a message to send to Claude?** Tempting — type a prompt
   from anywhere. But it blurs the palette with the composer and risks sending prompts by
   accident. Recommendation: no.
4. **Should `Ctrl/Cmd+K` be reserved now in P12's registry** even if P17 ships later? Cheap,
   and prevents another PRD claiming it.
5. **Is "recently used actions" worth the settings field?** It is the best empty-query
   default, but it adds to the four-way settings-migration coordination noted in §8. A
   session-only list is a reasonable compromise.

---

## 17. Effort breakdown

**Revised after §2.1** — Astryx provides the palette shell, keyboard navigation, and ARIA:

| Task | Estimate | Note |
| --- | --- | --- |
| **Read `SearchSource<T>`; resolve §16.1** | 2 h | blocking |
| Source model and registry | 3 h | |
| Actions source from P12 registry | 2 h | |
| `CommandPalette` wrapper | 3 h | was ~8 h without Astryx |
| Open state, recents, context filtering | 3 h | |
| App-level mounting and shortcut registration | 1.5 h | |
| Tests | 5 h | |
| Manual verification incl. screen reader | 1.5 h | |
| **Total** | **≈21 h — 3 days** | |

Effort **2**. Without Astryx's component this would have been a comfortable 3.

---

## 18. References

- `backend/handlers/chat.ts:39-44` — slash commands stripped and forwarded, with no UI
- `shared/types.ts:11` — `allowedTools`, built and unreachable
- `frontend/src/utils/toolUtils.ts` — 139 lines of parsing behind that unreachable field
- `frontend/src/hooks/chat/useAbortController.ts` — cancellation pattern for §7.2
- `frontend/src/App.tsx` — app-level mount point
- `README.md:288` — where `Ctrl+Shift+M` is documented instead of in-app
- `CLAUDE.md` § "Chat UI" — prefer purpose-built components over hand-rolled equivalents
- `CLAUDE.md` § "Discovering component APIs" — use the Astryx CLI
- `../01-claudecodeui-deep-scan.md` §3.8 — competitor's `cmdk`-based palette
- `../03-feature-comparison-matrix.md` — `EXT-02`, `EXT-01`, `SESS-03`
- `../04-uiux-workflow-comparison.md` §3 "Discoverability"
- `../06-prioritization-and-roadmap.md` §3, §6 — dependency edges and Milestone 4
- `P12-keyboard-shortcut-expansion.md` §7.2 — the registry this PRD consumes
