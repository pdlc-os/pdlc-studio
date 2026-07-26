# P04 — Token Usage & Cost Visibility

| Field | Value |
| --- | --- |
| **Priority** | **P04** of 30 |
| **Score** | **20.0** |
| **Inputs** | Value 4 · Reach 5 · GapWeight ×2.0 · Effort 2 |
| **Category** | Model, Cost & Usage Observability |
| **Matrix features** | `COST-02` (token usage display), `COST-03` (cost estimation), `SESS-05` (per-session token accounting) |
| **Maturity** | PDLC Studio **0** → target **4** · claudecodeui **4** |
| **Effort** | **2** |
| **Depends on** | Nothing |
| **Blocks** | P23 (context pressure) reuses this plumbing; `COST-06` (analytics) builds on it |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio never shows the user what a conversation costs — not in tokens, not in money,
not per turn, not per session. An agent session that quietly consumes a large amount of
context and budget looks exactly like one that consumed almost none.

This is unusual, because **the data is already flowing through the application**. The Agent
SDK attaches usage to assistant messages and to the terminal `result` message. The codebase
demonstrably knows about these shapes: `frontend/src/utils/sdkFixtures.ts` exports
`makeUsage` and `makeResultUsage` factories precisely because, per `CLAUDE.md`,
constructing them by hand "requires a lot of required bookkeeping (`cache_creation`,
`iterations`, `citations`, `stop_details`, …)".

So the usage fields are typed, tested, and present in every stream — and then dropped on the
floor. `UnifiedMessageProcessor` builds display messages without surfacing them, and no
component renders them.

The cost of this absence is concrete:

- A user cannot tell whether "summarise this repo" cost 5k tokens or 500k.
- A user hitting rate limits (P02) or context compaction (P23) has no leading indicator.
- A user on a metered plan has no feedback loop at all, and therefore no way to develop
  intuition about which prompts are expensive.

### Why P04 rather than lower

Reach is 5 — this affects every session of every user — and effort is 2, because no new
endpoint, dependency, or wire change is required. The plumbing is a display problem, not a
data problem.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui treats usage as **first-class persisted data**:

- Its SQLite `session` table carries `tokens_input` and `tokens_output` columns
  (`server/index.js`).
- It exposes `/api/projects/:projectId/sessions/:sessionId/token-usage`.

That is a heavier approach than this PRD proposes, and deliberately so — their persistence
serves a multi-user, multi-provider product with a paid tier. PDLC Studio has **no
database** (`02-pdlc-studio-baseline.md` §2.1), and adding one is explicitly rejected in
`06-prioritization-and-roadmap.md` §4 (`SESS-04`).

**The lesson taken is the display, not the storage.** Live per-turn and per-session totals
computed in the client deliver most of the value at a fraction of the cost. Historical
cross-session totals are deferred to `COST-06`.

---

## 3. Goals & non-goals

### Goals

1. Show tokens consumed by the current turn as it completes.
2. Show cumulative tokens for the current session.
3. Show an estimated monetary cost where a reliable basis exists.
4. Distinguish cache reads from fresh input, since the cost difference is large.
5. Keep all of it out of the transcript — this is chrome, not conversation.
6. Introduce no new dependency, endpoint, or persistence.

### Non-goals

- **Cross-session or historical totals.** Requires persistence; deferred to `COST-06`.
- **A model selector.** That is P09, though the two are natural companions.
- **Context-window pressure.** That is P23, which reuses this plumbing.
- **Budgets, caps, or alerts.** Out of scope.
- **Server-side accounting.** All computation is client-side from streamed messages.
- **Billing accuracy guarantees.** See §9 — estimates are explicitly estimates.

---

## 4. Personas & user stories

**Marcus — heavy daily user on a metered plan.**

> As a daily user, I want to see what a session has cost so far, so that I can decide
> whether to keep iterating or start a fresh, cheaper session.

**Priya — evaluating.** Wants to know if this is affordable at her team's scale.

> As an evaluator, I want per-turn token counts, so that I can estimate what adopting this
> would cost across a team.

**Devon — tuning prompts.**

> As someone refining a workflow, I want to compare the cost of two phrasings, so that I can
> tell whether being more specific actually saves tokens.

**Sam — hit a rate limit yesterday.**

> As a user who has been throttled, I want a running total, so that heavy usage is visible
> before it becomes a limit.

---

## 5. Functional requirements

### Data capture

- **FR-1** Usage **MUST** be read from the SDK's assistant and `result` messages as they
  stream.
- **FR-2** Fields **MUST** be narrowed defensively per `CLAUDE.md`'s guidance on `Beta*`
  types; a missing or renamed field **MUST NOT** throw.
- **FR-3** Input, output, cache-creation, and cache-read tokens **MUST** be captured
  separately where the SDK provides them.
- **FR-4** Session totals **MUST** accumulate across turns within a browser session.
- **FR-5** Totals **MUST** reset when a new session starts and **MUST NOT** carry across
  projects.
- **FR-6** When a historical conversation is loaded from `HistoryView`, totals **MUST**
  either reflect that conversation or be clearly absent — they **MUST NOT** show the
  previous session's numbers.

### Display

- **FR-7** A compact session-total indicator **MUST** be visible in the chat surface without
  interaction.
- **FR-8** Expanding it **MUST** reveal the breakdown by token class (FR-3).
- **FR-9** Per-turn usage **SHOULD** be available on each assistant message, revealed on
  demand rather than always visible.
- **FR-10** Token counts **MUST** be formatted for readability (`12.4k`, not `12437`), with
  the exact value available on hover or via an accessible label.
- **FR-11** None of this **MUST** appear as a transcript message.

### Cost estimation

- **FR-12** Where a price basis is available for the active model, an estimated cost
  **MUST** be shown alongside token counts.
- **FR-13** It **MUST** be visibly marked an estimate.
- **FR-14** Where the model is unknown or unpriced, cost **MUST** be omitted entirely —
  never shown as `$0.00`, which reads as "free" rather than "unknown".
- **FR-15** Cache-read tokens **MUST** be priced separately from fresh input tokens where
  the basis distinguishes them.
- **FR-16** The price basis **MUST** live in one clearly-marked module with a comment
  stating it requires manual maintenance.

### Accessibility

- **FR-17** The indicator **MUST** have an accessible name conveying what the number is.
- **FR-18** Abbreviated counts **MUST** expose the exact value to assistive technology.
- **FR-19** The expandable breakdown **MUST** be keyboard-operable with correct
  `aria-expanded`.
- **FR-20** Live-updating totals **MUST NOT** be an assertive live region — they would
  interrupt continuously during streaming.

---

## 6. UX & interaction specification

### Session indicator

Lives in the chat header, near the existing app mark and controls.

```
┌────────────────────────────────────────────────────┐
│ ◈ PDLC Studio    my-project      ⛁ 47.2k · ~$0.31 ▾│
└────────────────────────────────────────────────────┘
```

Collapsed: total tokens and estimated cost. Expanded:

```
┌──────────────────────────────┐
│ This session                 │
│                              │
│ Input           12,431       │
│ Output           8,204       │
│ Cache write      4,000       │
│ Cache read      22,610       │
│ ─────────────────────────    │
│ Total           47,245       │
│ Estimated       ~$0.31       │
│                              │
│ Estimate only — not billing. │
└──────────────────────────────┘
```

Compose from Astryx popover/disclosure primitives. **No new CSS classes.**

### Per-message usage

On demand, not always visible — always-on per-message counts would clutter the transcript
and undermine the "clean transcript" philosophy documented in `CLAUDE.md`.

Reuse `frontend/src/components/messages/CollapsibleDetails.tsx`, which already exists for
exactly this kind of progressive disclosure.

### Number formatting

| Raw | Displayed | Accessible label |
| --- | --- | --- |
| 847 | `847` | "847 tokens" |
| 12,437 | `12.4k` | "12,437 tokens" |
| 1,204,000 | `1.2M` | "1,204,000 tokens" |

### Cost presentation

- Always prefixed `~` and labelled "Estimated".
- Below `$0.01`, show `<$0.01` rather than `$0.00` — the latter reads as free.
- If the model is unknown or unpriced, **omit the cost entirely** (FR-14). Tokens still show.

### States

| State | Behaviour |
| --- | --- |
| New session, no turns | Indicator hidden — nothing to report yet |
| Mid-stream | Tokens update on message completion, not per chunk |
| Turn complete | Totals update from the `result` message |
| Historical conversation loaded | Show that conversation's totals if derivable, else hide (FR-6) |
| Model unknown | Tokens shown, cost omitted |

---

## 7. Technical design

### 7.1 Read the SDK types first

Before implementation, read the installed SDK's type definitions:

```
frontend/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts
```

`CLAUDE.md` warns that assistant payloads use Anthropic API `Beta*` types, that
`SDKAssistantMessage["message"]` is a `BetaMessage`, and that these resolve through the
`@anthropic-ai/sdk` peer dependency and **are enforced** — so narrow rather than assume.
`makeUsage` and `makeResultUsage` in `frontend/src/utils/sdkFixtures.ts` already encode the
required shape and are the fastest way to see what fields exist.

### 7.2 Usage extraction

New: `frontend/src/utils/usage.ts`.

```ts
export interface TurnUsage {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
}

export interface SessionUsage extends TurnUsage {
  turns: number;
}

export function extractUsage(message: unknown): TurnUsage | null;
export function addUsage(a: SessionUsage, b: TurnUsage): SessionUsage;
export function totalTokens(u: TurnUsage): number;
```

`extractUsage` returns `null` rather than throwing on an unexpected shape (FR-2). Every
field defaults to `0` when absent.

### 7.3 Accumulation

`useClaudeStreaming` (`frontend/src/hooks/useClaudeStreaming.ts`) is the composition point,
as it is for P02. It already sees assistant and `result` messages.

Add to its returned state:

```ts
sessionUsage: SessionUsage | null;
```

Reset semantics (FR-5, FR-6) belong in `useChatState`
(`frontend/src/hooks/chat/useChatState.ts`), which already owns session identity and is
where a project or session change is observable.

**Double-counting is the main correctness risk.** Usage may appear on both streamed
assistant messages *and* the terminal `result`. Determine empirically whether `result`
usage is a per-turn total or a cumulative session total, and accumulate from exactly one
source. Getting this wrong produces numbers that are roughly double, which is plausible
enough to ship unnoticed. A test with a realistic multi-turn fixture is the guard.

### 7.4 Pricing

New: `frontend/src/utils/pricing.ts`.

```ts
/**
 * Price basis for cost estimation, in USD per million tokens.
 *
 * MANUALLY MAINTAINED. These figures are not fetched and will drift as
 * pricing changes. A model absent from this table renders no cost estimate
 * rather than a wrong one (see FR-14).
 */
export interface ModelPricing {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = { /* … */ };

export function estimateCost(
  usage: TurnUsage,
  model: string | undefined,
): number | null;
```

`estimateCost` returns `null` for an unknown model — never `0` (FR-14).

The model identity comes from the `system` `init` message, which carries `model`
(`CLAUDE.md`, "Claude Agent SDK Types Reference"). Note that `init` is **filtered from
display but still processed** — `processSystemMessage` runs its side effects before
filtering — so the model is available without changing the filter behaviour.

### 7.5 Components

| Component | Purpose |
| --- | --- |
| New `frontend/src/components/chat/UsageIndicator.tsx` | Header indicator + expandable breakdown |
| New `frontend/src/utils/formatTokens.ts` | FR-10 formatting, or fold into `usage.ts` |
| Modify `frontend/src/components/ChatPage.tsx` | Mount the indicator |
| Modify `frontend/src/components/chat/ChatMessages.tsx` | Per-message disclosure (FR-9) |

### 7.6 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| SDK usage shapes | `makeUsage`, `makeResultUsage` | `frontend/src/utils/sdkFixtures.ts` |
| Progressive disclosure | `CollapsibleDetails` | `frontend/src/components/messages/CollapsibleDetails.tsx` |
| Stream composition | `useClaudeStreaming` | `frontend/src/hooks/useClaudeStreaming.ts` |
| Session identity / reset | `useChatState` | `frontend/src/hooks/chat/useChatState.ts` |
| Model identity | `init` side-effect path | `UnifiedMessageProcessor.ts` |

### 7.7 Backend

**None.** The backend already forwards SDK messages verbatim
(`backend/handlers/chat.ts:75-78`).

---

## 8. Data model & persistence

**No persistence.** Deliberate, and worth stating explicitly because it is the main
divergence from claudecodeui.

| Datum | Store | Lifetime |
| --- | --- | --- |
| Session usage totals | React state | Until session change or reload |
| Per-turn usage | Derived from message data | Message lifetime |
| Price basis | Module constant | Build time |

**Consequence**: totals reset on reload. This is a real limitation, and the honest tradeoff
for avoiding a database. Historical accounting is `COST-06`; if it is ever built, a JSON
sidecar under `~/.claude` is the likely mechanism, not SQLite.

For historical conversations loaded from `HistoryView`, usage *may* be derivable by summing
the stored JSONL messages — `backend/history/parser.ts` already parses them. If it is, FR-6
is satisfied properly; if not, the indicator hides. **Investigate during implementation**;
do not assume.

---

## 9. Security implications

Minimal, with one honesty requirement.

**Cost estimates must never be presented as authoritative.** They are computed from a
hard-coded price table that will drift. A user making a billing decision on a wrong number
is a real harm, even if a small one. Hence FR-13's visible "estimate" marking, FR-14's
omission rather than zero, and FR-16's maintenance comment.

No new network calls. No new data leaves the machine. Usage data is already in the client.

---

## 10. Performance & scale

- Update on **message completion**, not per streamed chunk (FR-7 note). Re-rendering a
  header on every chunk would be wasteful during long generations.
- `extractUsage` is a handful of property reads; negligible.
- The per-message disclosure renders only when opened.

---

## 11. Telemetry & observability

None client-side. Server-side debug logging already captures full SDK messages under
`--debug` (`backend/handlers/chat.ts:73`), which includes usage.

---

## 12. Test plan

### Frontend — Vitest, `make test-frontend`

New `frontend/src/utils/usage.test.ts`:

| Test | Asserts |
| --- | --- |
| Extracts all four token classes from a `makeUsage` fixture | FR-3 |
| Returns `null` for a message with no usage | FR-2 |
| Returns `null` for a malformed shape without throwing | FR-2 |
| Missing sub-fields default to 0 | FR-2 |
| `addUsage` accumulates correctly | FR-4 |
| `totalTokens` sums all classes | — |

New `frontend/src/utils/pricing.test.ts`:

| Test | Asserts |
| --- | --- |
| Known model returns a positive estimate | FR-12 |
| **Unknown model returns `null`, not `0`** | **FR-14 — the important one** |
| Cache reads priced separately from input | FR-15 |
| Zero usage on a known model returns 0, not null | Boundary |

Extend `frontend/src/hooks/useClaudeStreaming.test.ts`:

| Test | Asserts |
| --- | --- |
| Session usage accumulates across turns | FR-4 |
| **A realistic multi-turn stream is not double-counted** | **§7.3 — the correctness risk** |
| Usage resets on session change | FR-5 |
| Missing usage does not corrupt the running total | FR-2 |

New `frontend/src/components/chat/UsageIndicator.test.tsx`:

| Test | Asserts |
| --- | --- |
| Hidden with no usage yet | States table |
| Shows abbreviated total with exact value accessible | FR-10, FR-18 |
| Breakdown expands via keyboard with `aria-expanded` | FR-19 |
| Cost omitted for unknown model | FR-14 |
| Cost marked as an estimate | FR-13 |
| Sub-cent shows `<$0.01` | UX spec |
| Not an assertive live region | FR-20 |

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Fresh session → indicator hidden.
2. One turn → tokens appear; breakdown matches.
3. Several turns → totals accumulate; **manually verify against `--debug` server logs that
   the number is not doubled**.
4. Load a historical conversation → totals reflect it or are hidden, never stale.
5. Switch projects → totals reset.
6. Demo mode `/demo` → indicator behaves sensibly with mock usage.

---

## 13. Rollout & migration

No migration, no persisted state, no wire change, no config. Minor release. Ships
independently.

Pairs naturally with P09 (model selector), since knowing the model is what enables cost
estimation. Shipping P04 first is correct: cost visibility motivates model choice.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Double-counting usage from both assistant and `result` messages** | **High** | **High** | Determine the semantics empirically; accumulate from one source; multi-turn fixture test (§12) |
| 2 | Price table drifts and shows wrong costs | **High** (certain, over time) | Medium | FR-13 estimate marking, FR-16 maintenance comment, FR-14 omit-when-unknown |
| 3 | SDK renames usage fields on upgrade | Medium | Medium | Defensive narrowing (FR-2); `sdkFixtures.ts` localises the fix, as `CLAUDE.md` prescribes |
| 4 | Historical conversations show stale totals | Medium | Medium | FR-6 — show correct or show nothing |
| 5 | Header clutter on narrow viewports | Medium | Low | Collapse to tokens-only, or icon-only, below a breakpoint |
| 6 | Users read estimates as billing truth | Medium | Medium | Explicit "Estimate only — not billing" in the expanded view |
| 7 | Per-chunk re-render during long generations | Low | Medium | Update on message completion only |

---

## 15. Acceptance criteria

- [ ] Usage extracted from streamed messages without throwing on unexpected shapes
- [ ] Input, output, cache-write and cache-read captured separately
- [ ] Session totals accumulate and are **verified not double-counted**
- [ ] Totals reset on session and project change
- [ ] Historical conversations show correct totals or none
- [ ] Compact indicator visible without interaction
- [ ] Breakdown expands, keyboard-operable, correct `aria-expanded`
- [ ] Counts abbreviated with exact values accessible
- [ ] Nothing appears in the transcript
- [ ] Cost shown only for known models, marked as an estimate
- [ ] Unknown model omits cost entirely — never `$0.00`
- [ ] Sub-cent renders `<$0.01`
- [ ] Price table in one module with a maintenance comment
- [ ] Not an assertive live region
- [ ] `make check` passes

---

## 16. Open questions

1. **Is `result` usage per-turn or cumulative?** Blocking for §7.3. Resolve by inspecting a
   real multi-turn session with `--debug`.
2. **Can usage be derived for historical conversations** from the stored JSONL via
   `backend/history/parser.ts`? Determines whether FR-6 is satisfied properly or by hiding.
3. **Where does the price table live — frontend or shared?** Frontend keeps it a pure
   display concern. `shared/` would allow future server-side use. Recommendation: frontend
   until there is a second consumer.
4. **Should cost be opt-in?** Some users may find money framing unwelcome; a setting would
   respect that but adds surface. Recommendation: on by default, revisit if anyone objects.
5. **Should the indicator show a per-turn delta** as well as the session total? Useful for
   prompt tuning (Devon's story) but doubles the header content. Possibly better served by
   FR-9's per-message disclosure alone.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Read `sdk.d.ts`; determine `result` semantics | 1.5 h |
| `usage.ts` extraction + accumulation | 2 h |
| `pricing.ts` + price table | 1.5 h |
| Accumulation and reset wiring | 2 h |
| `UsageIndicator` component | 3 h |
| Per-message disclosure | 1.5 h |
| Historical-conversation investigation | 1.5 h |
| Tests | 4 h |
| Manual verification incl. double-count check | 1 h |
| **Total** | **≈18 h — 2.5 days** |

---

## 18. References

- `frontend/src/utils/sdkFixtures.ts` — `makeUsage`, `makeResultUsage`
- `CLAUDE.md` § "Assistant payloads use the Anthropic API `Beta*` types"
- `CLAUDE.md` § "`type: \"system\"` is a wide union" — `init` processed but not displayed
- `frontend/src/hooks/useClaudeStreaming.ts` — stream composition point
- `frontend/src/hooks/chat/useChatState.ts` — session identity
- `frontend/src/components/messages/CollapsibleDetails.tsx` — disclosure primitive
- `backend/history/parser.ts` — historical JSONL parsing
- `../01-claudecodeui-deep-scan.md` §3.9 — competitor's persisted token accounting
- `../03-feature-comparison-matrix.md` — `COST-02`, `COST-03`, `SESS-05`
