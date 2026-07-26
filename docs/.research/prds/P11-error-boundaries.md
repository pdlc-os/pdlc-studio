# P11 — Error Boundaries

| Field | Value |
| --- | --- |
| **Priority** | **P11** of 30 |
| **Score** | **13.5** |
| **Inputs** | Value 3 · Reach 3 · GapWeight ×1.5 · Effort 1 |
| **Category** | Design System, Theming & Accessibility |
| **Matrix features** | `UX-07` (error boundaries) |
| **Maturity** | PDLC Studio UNVERIFIED, assumed **0–1** → target **4** · claudecodeui **4** |
| **Effort** | **1** |
| **Depends on** | Nothing |
| **Blocks** | Nothing, but protects every subsequent PRD's new UI |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio has no visible error-boundary strategy. A search of `frontend/src/` for
`ErrorBoundary`, `componentDidCatch`, and `react-error-boundary` returns nothing, and
`frontend/src/App.tsx` (43 lines) wraps its routes in `SettingsProvider`, `Router`, and
`AstryxProvider` with no error boundary anywhere in the tree.

The consequence: **any render-time throw anywhere in the component tree unmounts the entire
application and leaves a blank page.** React's default behaviour on an uncaught error is to
unmount the whole root.

That risk is not theoretical here, because the app renders **untrusted, evolving, external
data** on its hottest path. `CLAUDE.md` documents this in unusual detail:

- The SDK's message union is "much wider than the four types this app renders."
- `type: "system"` is "a wide union" whose subtypes must be narrowed before reading
  `init`-only fields.
- A tool_use block's `input` is typed `unknown`.
- `SDKUserMessage`'s `content` "may be a plain string rather than a block array."
- New noisy subtypes have appeared in practice and were found "by watching a live session
  rather than by reading the types."

`UnifiedMessageProcessor.ts` is 590 lines of exactly this narrowing. It is careful code —
but it is parsing a moving target, and a single unhandled shape in a future SDK release
turns "one message renders oddly" into "the application is a white screen."

The existing defences are good and insufficient in different ways:

- `IGNORED_SDK_MESSAGE_TYPES` and `NON_DISPLAYED_SYSTEM_SUBTYPES` prevent *rendering* of
  unknown things — but only ones already known to be unknown.
- The once-per-page-load warning surfaces genuinely new types in the console — where a
  normal user will never look.

Neither catches a throw. That is what an error boundary is for.

### Why P11 rather than lower

Effort 1, and it converts the worst possible failure mode (blank page, no explanation, work
apparently lost) into a contained one. Its value also compounds: **every PRD after this one
adds new UI that this boundary will protect** — the file viewer (P07), git panel (P15), diff
viewer (P16), and command palette (P17) all render new classes of data.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui depends on **`react-error-boundary ^4.1.2`** and ships a dedicated
`ErrorBoundary.tsx` in `src/components/main-content/view/`.

Its placement is instructive: the boundary sits at the **main content** level, not at the
app root. In a tabbed workbench that means a crash in one tool leaves the shell, sidebar,
and other tabs alive. The user loses a panel, not the application.

PDLC Studio has no tabs, so the equivalent design is different — but the principle
transfers directly: **catch below the shell, not at the root**, so that whatever survives is
still useful. §6 applies this.

---

## 3. Goals & non-goals

### Goals

1. A render error in the transcript must not blank the entire application.
2. The user must be told something useful and offered a way forward.
3. Recovery must not require losing the whole session where that is avoidable.
4. Developers must get the error and component stack, not a swallowed exception.
5. Boundaries must be placed so that new UI from later PRDs inherits protection.

### Non-goals

- **Error reporting to a remote service.** PDLC Studio has no telemetry and this PRD adds
  none.
- **Catching async or event-handler errors.** React error boundaries do not catch those by
  design; see §7.4 for what is and is not covered.
- **Replacing the existing message-type filters.** They solve a different problem and stay.
- **A general retry framework.** Out of scope.
- **Fixing any specific parsing bug.** This is a containment layer, not a correction.

---

## 4. Personas & user stories

**Marcus — mid-session, long conversation.**

> As a user thirty messages into a session, I want a rendering bug to cost me one message,
> not the whole conversation, because re-establishing that context is expensive.

**Priya — evaluating.**

> As a new user, I want an error to explain itself, because a blank white page reads as
> "this project is broken" and I will not try again.

**Devon — filing a bug.**

> As someone reporting a problem, I want the error message and stack visible, so that my
> report is actionable rather than "it went blank."

**Sam — after an SDK upgrade.**

> As a user on a new Claude Code version, I want unrecognised data to degrade gracefully,
> because the SDK will keep changing underneath this app.

---

## 5. Functional requirements

### Containment

- **FR-1** A render error anywhere in the routed application **MUST NOT** produce a blank
  page.
- **FR-2** There **MUST** be a root-level boundary as a last resort.
- **FR-3** There **MUST** be a boundary around the message transcript, so a message-rendering
  error does not take down the chat shell (composer, header, controls).
- **FR-4** Individual messages **SHOULD** be independently bounded, so one malformed message
  does not blank the entire transcript.
- **FR-5** Boundaries **MUST** be placed inside `AstryxProvider`, so fallback UI can use
  design-system components and the active theme.

### Fallback UI

- **FR-6** A fallback **MUST** state that something went wrong, in plain language.
- **FR-7** It **MUST** offer at least one recovery action appropriate to its scope.
- **FR-8** The message-level fallback **MUST** identify which message failed and allow the
  rest of the transcript to render.
- **FR-9** The error message and component stack **MUST** be available on demand — not shown
  by default, not hidden entirely.
- **FR-10** Fallbacks **MUST NOT** attempt to render any part of the data that caused the
  failure.

FR-10 is the subtle one: a fallback that tries to show "the message that failed" by
rendering fields of that message can throw inside the fallback, which React treats as an
error in the parent boundary — escalating exactly the failure being contained.

### Recovery

- **FR-11** The root fallback **MUST** offer a full reload.
- **FR-12** The transcript fallback **SHOULD** offer a retry that re-mounts the subtree
  without a page reload.
- **FR-13** Retry **MUST** be bounded — repeated immediate failure **MUST** stop offering
  retry and escalate, rather than loop.

### Developer signal

- **FR-14** Errors **MUST** be logged to the console with the component stack.
- **FR-15** Logging **MUST NOT** be suppressed in production builds — the console is the
  only diagnostic channel this app has.

### Accessibility

- **FR-16** Fallbacks **MUST** be announced — `role="alert"` for the root, polite for
  message-level ones, which may be numerous.
- **FR-17** Recovery actions **MUST** be real, keyboard-reachable buttons.
- **FR-18** The fallback **MUST NOT** steal focus at message level; a transcript that yanks
  focus while streaming is worse than the error.

---

## 6. UX & interaction specification

### Boundary placement

Three levels, following claudecodeui's "catch below the shell" principle adapted to a
single-surface app:

```
<SettingsProvider>
  <Router>
    <AstryxProvider>
      ┌─ RootErrorBoundary ────────────────── FR-2, last resort
      │   <Routes>
      │     /projects/*  →  ChatPage
      │        header · controls · composer   ← survive FR-3
      │        ┌─ TranscriptErrorBoundary ─── FR-3
      │        │   ChatMessages
      │        │     ┌─ MessageErrorBoundary ─ FR-4
      │        │     │   one message
      │        │     └───────────────────────
      │        └───────────────────────────
      └────────────────────────────────────
```

Boundaries sit **inside** `AstryxProvider` (FR-5) so fallbacks can use Astryx components and
render in the correct theme. A fallback outside the provider would be unstyled and
would ignore dark mode — precisely when the user is already confused.

### Message-level fallback

```
┌──────────────────────────────────────┐
│ ⚠  This message could not be displayed│
│    Show details ▾                     │
└──────────────────────────────────────┘
```

Inline, compact, in the transcript flow. The rest of the conversation renders normally.
"Show details" reveals the error and stack (FR-9), reusing
`frontend/src/components/messages/CollapsibleDetails.tsx`, which already exists for
progressive disclosure in the transcript.

### Transcript-level fallback

```
┌──────────────────────────────────────────┐
│  ⚠  The conversation could not be shown   │
│                                           │
│  Something went wrong rendering this      │
│  transcript. Your session is not lost —   │
│  reloading will restore it from history.  │
│                                           │
│  [ Try again ]   [ Reload ]  Show details ▾│
└──────────────────────────────────────────┘
```

The composer and header remain usable, which is the point of FR-3.

The "your session is not lost" reassurance is **only true if it is** — conversation history
is read from Claude Code's JSONL transcripts (`backend/history/`), so a reload does restore
it. Worth confirming during implementation rather than asserting.

### Root-level fallback

Full-page, `role="alert"`, offering reload and details. Deliberately plain: if the boundary
below failed, the root fallback must depend on as little as possible.

### States

| State | Behaviour |
| --- | --- |
| No error | Nothing rendered; zero overhead |
| Message error | Inline fallback; transcript otherwise intact |
| Transcript error | Transcript region replaced; shell intact |
| Root error | Full-page fallback |
| Retry succeeds | Normal UI resumes |
| Retry fails repeatedly | Retry withdrawn, reload offered (FR-13) |

---

## 7. Technical design

### 7.1 Dependency or hand-rolled?

`react-error-boundary` is the conventional choice and what claudecodeui uses. But the whole
feature is one small class component:

```tsx
class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { /* FR-14 */ }
  render() { /* fallback or children */ }
}
```

**Recommendation: hand-roll it.** Reasons specific to this project:

- **Bundle discipline.** `CLAUDE.md` documents a hard-won fight to keep artefacts small —
  macOS arm64 from 428 MB to 94 MB. Adding a dependency for ~40 lines is against the grain.
- **`deno compile` embeds `node_modules`** into every binary; fewer dependencies is
  materially better here than in a typical web app.
- Error boundaries are one of React's most stable APIs.

The counter-argument is that `react-error-boundary` provides `useErrorBoundary` and reset
semantics for free. If FR-12's retry proves fiddly, revisit — but start hand-rolled.

Note this must be a **class component**. There is still no hook equivalent for
`componentDidCatch`, so this will be the only class component in an otherwise
function-component codebase. Worth a comment explaining why.

### 7.2 Components

| Item | Purpose |
| --- | --- |
| New `frontend/src/components/errors/ErrorBoundary.tsx` | The class component, generic over its fallback |
| New `frontend/src/components/errors/RootErrorFallback.tsx` | FR-2 |
| New `frontend/src/components/errors/TranscriptErrorFallback.tsx` | FR-3 |
| New `frontend/src/components/errors/MessageErrorFallback.tsx` | FR-4 |
| Modify `frontend/src/App.tsx` | Mount the root boundary inside `AstryxProvider` |
| Modify `frontend/src/components/chat/ChatMessages.tsx` | Transcript and per-message boundaries |

### 7.3 Retry semantics

FR-12's retry re-mounts the subtree by clearing the boundary's error state. FR-13's bound
prevents an infinite loop when the underlying data is permanently unrenderable — otherwise
"Try again" re-throws immediately and the user clicks forever.

Implement as a counter: after N (suggest 2) consecutive failures with no successful render
between, withdraw retry and offer reload only.

A `key` prop derived from the message id lets a per-message boundary reset naturally when
the underlying message changes.

### 7.4 What error boundaries do **not** catch

Must be documented so nobody assumes coverage that does not exist:

| Not caught | Where it matters here |
| --- | --- |
| Event handler errors | Composer submit, button clicks |
| Async / promise rejections | **The NDJSON stream read loop** — the hottest path in the app |
| `setTimeout` callbacks | Timers in hooks |
| Server-side rendering | N/A — this is a SPA |
| Errors thrown in the boundary's own fallback | Why FR-10 exists |

The async gap is the significant one. Stream parsing happens inside an async read loop in
`useClaudeStreaming` / `useStreamParser`, and **a throw there is a rejected promise, not a
render error**. This PRD does not cover it.

That is a genuine limitation and should be stated in the PR rather than left for someone to
discover. The existing stream pipeline does handle malformed data defensively, and the
backend already converts SDK failures into `{ type: "error" }` frames
(`backend/handlers/chat.ts:87-93`) — so the async path has its own, separate protection.
Strengthening it is a candidate follow-up, not part of this PRD.

### 7.5 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Progressive disclosure for stacks | `CollapsibleDetails` | `frontend/src/components/messages/CollapsibleDetails.tsx` |
| Alert/callout presentation | Astryx | design system |
| Buttons | Astryx | design system |
| Theme context | `AstryxProvider` | `frontend/src/components/AstryxProvider.tsx` |

---

## 8. Data model & persistence

**None.** Error state is ephemeral and per-mount. Persisting it would be actively wrong — a
stale error surviving a reload would be worse than the error.

---

## 9. Security implications

One consideration, and it is a real trade.

**Stack traces reveal internal structure.** FR-9 makes error messages and component stacks
available on demand. On an application with no authentication, anyone who can reach the port
could induce and read them.

The exposure is small — this is client-side React, its source is served to the browser
anyway, and the app is local-first. Against that, FR-15 keeps details available in
production precisely because the console is the only diagnostic channel this project has,
and `CLAUDE.md` shows the maintainers rely on exactly this kind of signal (the noisy-subtype
discoveries were made "by watching a live session").

**Recommendation: keep details available, behind a disclosure.** Reconsider only if PDLC
Studio ever ships a genuinely multi-tenant mode, which is not on this roadmap.

Second, smaller point: error text may embed fragments of the data that caused the failure —
which could include file contents or conversation text. Since the person seeing it is the
person who owns that data, this is acceptable.

---

## 10. Performance & scale

Error boundaries have **zero runtime cost when no error occurs** — no extra renders, no
subscriptions.

FR-4's per-message boundary adds one component instance per message. In a long transcript
that is a real but small increase in tree size. If it proves measurable, per-message
boundaries can be dropped while keeping FR-3, at the cost of an error blanking the whole
transcript instead of one message. Measure before optimising.

---

## 11. Telemetry & observability

Console only (FR-14, FR-15). No remote reporting, consistent with the product having no
analytics.

The console output should follow the discipline `CLAUDE.md` establishes for unknown SDK
message types — informative, and not repeated once per occurrence in a way that floods.

---

## 12. Test plan

### Frontend — Vitest + Testing Library, `make test-frontend`

New `frontend/src/components/errors/ErrorBoundary.test.tsx`:

| Test | Asserts |
| --- | --- |
| Renders children when no error | Baseline |
| Renders fallback when a child throws | FR-1 |
| Calls `componentDidCatch` with the component stack | FR-14 |
| Retry clears error state and re-mounts | FR-12 |
| **Retry withdrawn after N consecutive failures** | FR-13 |
| `key` change resets the boundary | §7.3 |

New `frontend/src/components/errors/MessageErrorFallback.test.tsx`:

| Test | Asserts |
| --- | --- |
| Identifies which message failed | FR-8 |
| Details hidden by default, revealable | FR-9 |
| **Does not render the offending message's fields** | **FR-10** |
| Does not steal focus | FR-18 |
| Announced politely, not assertively | FR-16 |

Extend `frontend/src/components/chat/ChatMessages.test.tsx`:

| Test | Asserts |
| --- | --- |
| One throwing message does not blank the transcript | FR-4 |
| Other messages still render around it | FR-4 |
| A throw in the list does not unmount the composer | FR-3 |

Extend `frontend/src/App.test.tsx`:

| Test | Asserts |
| --- | --- |
| Root boundary present inside `AstryxProvider` | FR-5 |
| Root fallback has `role="alert"` | FR-16 |
| Root fallback offers reload | FR-11 |

Testing a throwing component requires suppressing React's expected console error;
`frontend/src/test-setup.ts` (59 lines) is the right place for that helper.

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Temporarily throw in a message component → inline fallback; rest of transcript fine.
2. Temporarily throw in `ChatMessages` → transcript fallback; **composer still usable**.
3. Temporarily throw in `ChatPage` → root fallback, correctly themed.
4. Toggle dark mode with a fallback showing → fallback follows the theme (FR-5).
5. Click retry against a permanent failure → retry withdrawn after N (FR-13).
6. Confirm details show error text and component stack.
7. Confirm no boundary steals focus mid-stream.

---

## 13. Rollout & migration

Purely additive, no persisted state, no wire change, no config. Patch or minor release.

**Worth shipping early in the sequence.** It is one of the cheapest items and it protects
every PRD that follows — P07, P15, P16 and P17 all render new classes of data into this
tree.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Fallback itself throws, escalating the failure** | Medium | **High** | FR-10 — never render the offending data; explicit test |
| 2 | Team assumes async stream errors are covered | **Medium** | Medium | §7.4 documents the gap explicitly; state it in the PR |
| 3 | Retry loops forever on a permanent failure | Medium | Medium | FR-13 bound; explicit test |
| 4 | Boundary placed outside `AstryxProvider`, fallback unstyled | Medium | Low | FR-5; test asserts placement |
| 5 | Per-message boundaries measurably bloat long transcripts | Low | Low | §10 — drop FR-4, keep FR-3, if measured |
| 6 | Errors silently swallowed, harming debuggability | Medium | Medium | FR-14, FR-15 — log in production too |
| 7 | The one class component in the codebase confuses future contributors | Low | Low | Comment explaining that no hook equivalent exists |
| 8 | Boundary hides a real bug that would otherwise be fixed | Low | Medium | Console logging preserved; fallback is visibly an error, not a silent skip |

Risk 8 deserves a word: a boundary can mask defects by making them survivable. The
mitigation is that the fallback is *visible and reported*, not a silent no-op — a masked bug
still shows the user a warning and the developer a stack.

---

## 15. Acceptance criteria

- [ ] No render error anywhere produces a blank page
- [ ] Root boundary present, inside `AstryxProvider`
- [ ] Transcript boundary keeps composer and header usable
- [ ] Per-message boundary keeps the rest of the transcript rendering
- [ ] Fallbacks state the problem in plain language
- [ ] Message fallback identifies which message failed
- [ ] **Fallbacks never render fields of the data that caused the failure**
- [ ] Error and component stack available on demand, hidden by default
- [ ] Retry re-mounts without a page reload
- [ ] Retry withdrawn after repeated immediate failure
- [ ] Errors logged with component stack, in production too
- [ ] Root fallback `role="alert"`; message fallbacks polite
- [ ] No fallback steals focus
- [ ] Fallbacks render correctly in both light and dark themes
- [ ] `§7.4`'s async limitation stated in the PR description
- [ ] No new runtime dependency
- [ ] `make check` passes

---

## 16. Open questions

1. **Is the "your session is not lost" claim in the transcript fallback true?** History comes
   from Claude Code's JSONL, so a reload should restore it — but the *in-flight* turn may not
   be flushed. Verify before writing reassuring copy, or soften it.
2. **Hand-rolled or `react-error-boundary`?** §7.1 recommends hand-rolled on bundle-discipline
   grounds. Revisit if FR-12/FR-13 reset semantics prove awkward.
3. **Should per-message boundaries (FR-4) ship in the first pass**, or only FR-2 and FR-3?
   FR-4 gives the best user experience and the most tree overhead. Suggestion: ship all
   three; drop FR-4 only if measured.
4. **Should the async stream path get equivalent protection** as a follow-up? §7.4 argues it
   already has partial protection. Worth filing rather than absorbing here.
5. **Should the fallback offer "copy error details"?** Would make Devon's bug reports much
   better, and P03 provides the control. Cheap addition if P03 has shipped.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| `ErrorBoundary` class component | 1.5 h |
| Three fallback components | 3 h |
| Placement in `App.tsx` and `ChatMessages.tsx` | 1 h |
| Retry bounding (FR-13) | 1 h |
| Test-setup helper for expected console errors | 0.5 h |
| Tests | 3 h |
| Manual verification across themes and levels | 1 h |
| **Total** | **≈11 h — 1.5 days** |

---

## 18. References

- `frontend/src/App.tsx` — provider tree with no boundary
- `frontend/src/components/chat/ChatMessages.tsx` — transcript rendering
- `frontend/src/components/messages/CollapsibleDetails.tsx` — disclosure primitive
- `frontend/src/components/AstryxProvider.tsx` — theme context boundaries must sit inside
- `frontend/src/utils/UnifiedMessageProcessor.ts` (590 lines) — the narrowing this protects
- `frontend/src/test-setup.ts` — global test setup
- `backend/handlers/chat.ts:87-93` — SDK errors already converted to `error` frames
- `CLAUDE.md` § "`type: \"system\"` is a wide union" — why unknown shapes keep arriving
- `CLAUDE.md` § "Single Binary Distribution" — bundle-size discipline behind §7.1
- `../01-claudecodeui-deep-scan.md` §3.12 — competitor's boundary placement
- `../03-feature-comparison-matrix.md` — `UX-07`
