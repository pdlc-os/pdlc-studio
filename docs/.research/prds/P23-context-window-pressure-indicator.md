# P23 — Context-Window Pressure Indicator

| Field | Value |
| --- | --- |
| **Priority** | **P23** of 30 |
| **Score** | **9.0** |
| **Inputs** | Value 3 · Reach 4 · GapWeight ×1.5 · Effort 2 |
| **Category** | Model, Cost & Usage Observability |
| **Matrix features** | `COST-07` (context-window pressure indicator) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui UNVERIFIED |
| **Effort** | **2** |
| **Depends on** | **P04** (usage plumbing) — reuses its extraction |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

When a Claude Code session approaches its context limit, the conversation is **compacted** —
earlier turns are summarised and replaced. This is a significant event: the model's memory of
the session changes shape, and details the user assumed were still in play may no longer be.

**PDLC Studio never tells the user any of this.** Not that context is filling, not that
compaction happened, not that it is about to.

The suppression is deliberate and documented. `CLAUDE.md` explains that `type: "system"` is a
wide union and that "compaction boundaries, status updates, hook progress, task notifications
and much more all arrive as `type: "system"` with a different `subtype`". The app filters
several of these through `NON_DISPLAYED_SYSTEM_SUBTYPES` in
`frontend/src/utils/UnifiedMessageProcessor.ts`, including **`thinking_tokens`**.

The reasoning — keep the transcript clean — is correct. `04-uiux-workflow-comparison.md` §3
observes that it has simply been applied slightly too broadly:

> This is a coherent design philosophy — *keep the transcript clean* — that has been applied
> slightly too broadly. Filtering `hook_progress` is right; filtering the only signal that
> explains a 60-second stall is not.

The same argument applies here. The user experiences the symptoms of context pressure —
responses that lose track of earlier detail, sudden shifts in what the model remembers — with
no explanation available anywhere in the interface.

### Relationship to P02 and P04

This is the third of three "system legibility" PRDs and the last to ship:

| PRD | Hidden signal | Symptom without it |
| --- | --- | --- |
| **P02** | `rate_limit_event` | Unexplained stall |
| **P04** | Usage / cost | No idea what a session costs |
| **P23** | Context pressure, compaction | Model "forgets" with no explanation |

P23 reuses P04's usage extraction directly (§7.2), which is why it is effort 2 rather than 3
and why it must ship after it.

### Why P23 rather than higher

Value 3 — this is explanatory rather than enabling. A user who understands context pressure
can act on it (start a fresh session, be more targeted); a user who does not is merely
confused rather than blocked.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui's context handling is **UNVERIFIED** — the scan did not read its chat
components. It does persist per-session `tokens_input` and `tokens_output` in SQLite and
expose `/api/projects/:projectId/sessions/:sessionId/token-usage`, so it has the raw material.
Whether it renders context pressure specifically is unknown.

**This PRD does not rest on the competitor.** It rests on the same internal-coherence argument
as P02: the app receives a signal, deliberately discards it, and leaves the user without an
explanation for observable behaviour.

---

## 3. Goals & non-goals

### Goals

1. Show how full the context window is.
2. Warn before compaction becomes likely.
3. Make compaction visible when it happens.
4. Keep all of it out of the transcript.
5. Add no dependency, no endpoint, and no persistence.

### Non-goals

- **Preventing or triggering compaction.** Claude Code owns that. `/compact` exists and P20
  makes it discoverable.
- **Automatic session splitting.** Too opinionated; users should decide.
- **Cost or token totals.** P04 — though the two share plumbing and adjacent UI.
- **Rate limits.** P02.
- **Rendering every `system` subtype.** The blocklist stays; this PRD surfaces exactly two
  things.

---

## 4. Personas & user stories

**Marcus — long refactoring session.**

> As a user forty turns into a session, I want to know context is filling, so that I can
> compact deliberately rather than discover it by the model losing the thread.

**Priya — confused by a regression in quality.**

> As a user, I want to know when compaction happened, so that I understand why Claude no
> longer remembers something I said earlier.

**Devon — planning a large task.**

> As a user starting something big, I want to see context consumption as I go, so that I can
> decide when to break the work into a fresh session.

---

## 5. Functional requirements

### Signal

- **FR-1** Context consumption **MUST** be estimated from streamed usage data.
- **FR-2** The estimate **MUST** be expressed against the active model's context window.
- **FR-3** Where the window size for the model is unknown, pressure **MUST NOT** be shown
  rather than shown wrongly.
- **FR-4** Compaction events **MUST** be detected from the SDK's `system` message stream.
- **FR-5** Detection **MUST** narrow on `subtype` before reading fields, per `CLAUDE.md`.
- **FR-6** An unrecognised or renamed compaction subtype **MUST** degrade silently, never
  throw.

### Display

- **FR-7** A compact indicator **MUST** show current context pressure.
- **FR-8** It **MUST** be unobtrusive below a threshold and more prominent above one.
- **FR-9** Exact numbers **MUST** be available on demand, not always visible.
- **FR-10** Compaction **MUST** produce a visible, one-time marker.
- **FR-11** The compaction marker **MAY** appear in the transcript — it is a genuine event in
  the conversation's history, unlike rate limits or cost.
- **FR-12** Pressure **MUST** reset appropriately after compaction.
- **FR-13** The indicator **MUST** be hidden when there is no session or no data.

### Accessibility

- **FR-14** The indicator **MUST** have an accessible name conveying the value, not just a
  visual bar.
- **FR-15** Pressure **MUST NOT** be conveyed by colour alone.
- **FR-16** Crossing the warning threshold **SHOULD** be announced politely, once.
- **FR-17** The indicator **MUST NOT** be a live region that updates continuously during
  streaming.

FR-11 is the one deliberate departure from the "keep it out of the transcript" rule that P02
and P04 both follow — see §6.

---

## 6. UX & interaction specification

### Where it lives

Two distinct surfaces, because the two signals are different in kind.

**Context pressure → chat header**, alongside P04's usage indicator. It is ambient state, not
an event.

```
◈ PDLC Studio   my-project   ⛁ 47.2k · ~$0.31   ▓▓▓▓▓▓░░░░ 62%   Sonnet 5 ▾
```

**Compaction → the transcript** (FR-11):

```
        ─────── Conversation compacted ───────
         Earlier turns summarised to free context
```

This is the exception to the rule P02 §FR-2 and P04 §FR-11 both establish, and it is
deliberate. Rate limits and cost are *about* the conversation; compaction is *part of* it. A
user scrolling back needs to see where the boundary fell, because it explains why the model's
memory changes at that point. Putting it anywhere else loses the positional information that
makes it useful.

It is a divider, not a message — no avatar, no bubble, no role.

### Thresholds

| Pressure | Treatment |
| --- | --- |
| < 50% | Indicator present, minimal, unemphasised |
| 50–74% | Neutral, visible |
| 75–89% | **Warning treatment**, announced once (FR-16) |
| ≥ 90% | Prominent, with a hint that compaction is likely |

Above 75%, a hint pointing at `/compact` is worth showing — and it becomes genuinely
actionable once P20 makes slash commands discoverable.

### Header crowding — a three-way problem

P04 adds usage and cost. P09 adds the model. P23 adds a pressure bar. On a narrow viewport
these cannot all fit.

**P04 §6 already flags this and proposes a shared responsive strategy.** P23 must adopt the
same one rather than inventing a third:

| Width | Header shows |
| --- | --- |
| Wide | usage · cost · pressure · model |
| Medium | usage · pressure · model |
| Narrow | one overflow control containing all of it |

**This is now a three-PRD coordination point** and should be settled when P04 is built.

### States

| State | Behaviour |
| --- | --- |
| No session | Hidden (FR-13) |
| Session started, no usage yet | Hidden |
| Model unknown or window size unknown | **Hidden** (FR-3) — never guess |
| Normal | Ambient indicator |
| Above warning threshold | Emphasised, announced once |
| Compaction occurred | Transcript divider; pressure recalculates |
| History loaded | Show only if derivable; otherwise hidden |

---

## 7. Technical design

### 7.1 The two signals

They come from different places and need separate handling.

**Compaction** arrives as a `type: "system"` message with a compaction-related `subtype`.
`CLAUDE.md` states that compaction boundaries are among the subtypes arriving this way, but
**does not name the exact subtype string** — and `NON_DISPLAYED_SYSTEM_SUBTYPES` lists
`init`, `hook_started`, `hook_progress`, `hook_response`, `thinking_tokens`,
`background_tasks_changed`, `task_started`, none of which is obviously it.

So the exact subtype **must be determined from the installed SDK's `sdk.d.ts` or by observing
a live compaction**. `CLAUDE.md` notes that `background_tasks_changed` and `task_started`
were themselves "found exactly that way, by watching a live session rather than by reading the
types." That is the fallback here too. This is §16.1 and it is blocking for FR-4.

**Pressure** is computed, not received. There is no "context is 62% full" message; it must be
derived from cumulative usage against the model's window size.

### 7.2 Computing pressure

Reuse P04's extraction directly. P04 §7.2 defines:

```ts
export interface TurnUsage {
  input: number; output: number; cacheCreation: number; cacheRead: number;
}
export function extractUsage(message: unknown): TurnUsage | null;
```

**Pressure is not the same as P04's cumulative session total.** P04 sums everything ever
consumed; context pressure is *what is currently resident in the window*, which is roughly
the most recent turn's input plus its output.

Getting this wrong is the central correctness risk: summing all turns would produce a number
that exceeds 100% within a few exchanges and is meaningless.

The best available proxy is the **most recent turn's** `input + cacheRead + cacheCreation +
output`, since the input of turn *n* already contains the accumulated conversation. That is an
approximation, and §9 requires it be presented as one.

### 7.3 Window sizes

FR-2 needs a per-model context window size. Like P04's price table and P09's model list, this
is a **manually maintained constant**:

```ts
/**
 * Context window sizes per model, in tokens.
 *
 * MANUALLY MAINTAINED. A model absent from this table shows no pressure
 * indicator rather than a wrong one (FR-3).
 */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = { /* … */ };
```

This is the **third** such table in the pack (P04 pricing, P09 models, P23 windows), all
keyed by model identifier and all requiring the same maintenance. **They should be one module
with three fields per model**, not three parallel tables that drift apart.

That consolidation is worth doing when P09 lands, and this PRD should extend rather than add:

```ts
export interface ModelInfo {
  label: string;          // P09
  pricing?: ModelPricing; // P04
  contextWindow?: number; // P23
}
```

The model identity comes from the `system` `init` message, which `processSystemMessage`
already handles for its session-id side effect (`CLAUDE.md`) — the same path P04 §7.4 and
P09 §7.3 use.

### 7.4 Detecting compaction without unfiltering

FR-4 must not require adding a compaction subtype to the *displayed* set, because
`SystemMessageComponent` falls back to a JSON dump for subtypes it has no rendering for
(`CLAUDE.md`) — which would put SDK telemetry in the transcript.

The pattern P02 §7.2 establishes applies: **route, do not display.** Handle the subtype in
`processSystemMessage`'s side-effect path, emit a structured event, and render a purpose-built
divider (FR-10) rather than letting the raw message through the display pipeline.

`CLAUDE.md` documents the precedent precisely — `init` is "filtered from **display** only" and
still processed, because dropping it entirely would break session continuity. Compaction gets
the same treatment.

### 7.5 Components

| Item | Purpose |
| --- | --- |
| New `frontend/src/components/chat/ContextPressure.tsx` | Header indicator |
| New `frontend/src/components/chat/CompactionDivider.tsx` | Transcript marker |
| New `frontend/src/utils/contextWindow.ts` | Pressure calculation |
| Extend `frontend/src/utils/models.ts` (P09) | Window sizes (§7.3) |
| Modify `frontend/src/hooks/useClaudeStreaming.ts` | Expose pressure and compaction events |
| Modify `frontend/src/utils/UnifiedMessageProcessor.ts` | Route the compaction subtype |

### 7.6 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Usage extraction | `extractUsage` (P04) | `frontend/src/utils/usage.ts` |
| Model identity | `init` side-effect path | `frontend/src/utils/UnifiedMessageProcessor.ts` |
| Model metadata table | P09's module, extended | `frontend/src/utils/models.ts` |
| Route-don't-display pattern | P02's approach | `frontend/src/hooks/streaming/` |
| Header responsive strategy | P04 §6 | `frontend/src/components/ChatPage.tsx` |
| SDK fixtures | `sdkFixtures.ts` factories | `frontend/src/utils/` |
| Progress/meter primitive | Astryx | design system |

---

## 8. Data model & persistence

**None.** Pressure is derived per turn; compaction events are transient markers in the
rendered transcript.

For a conversation loaded from history, compaction markers could in principle be recovered
from the stored JSONL by `backend/history/parser.ts` — the same open question P04 §16.2
raises about historical usage. If not recoverable, the indicator hides (FR-13).

---

## 9. Security implications

Essentially none — no new endpoint, no new data leaving the machine, no new input.

One honesty requirement, mirroring P04 §9's stance on cost estimates:

**Pressure is an approximation** (§7.2). It is derived from token counts against a
manually-maintained window table, not reported by the model. A user who trusts it precisely —
and starts a fresh session at "89%" that would have been fine, or continues at "70%" that
compacts immediately — has been misled by our number.

The mitigations are FR-3 (hide rather than guess when the window is unknown), a visibly
approximate presentation (a bar with a rounded percentage rather than an exact token count as
the primary display), and FR-9 putting the raw numbers behind a disclosure where their
provenance can be explained.

---

## 10. Performance & scale

Negligible. One arithmetic operation per completed turn, reusing data P04 already extracts.

Two constraints inherited from P04 §10: update on **message completion**, not per streamed
chunk; and do not animate the indicator continuously, which would re-render the header
throughout generation for no benefit. FR-17's prohibition on a continuously-updating live
region follows the same reasoning for assistive technology.

---

## 11. Telemetry & observability

The backend already logs full SDK messages at debug level
(`backend/handlers/chat.ts:73`), so compaction events are already captured under `--debug`.
That is also the practical way to answer §16.1.

No client analytics.

---

## 12. Test plan

### Frontend — Vitest, `make test-frontend`

New `frontend/src/utils/contextWindow.test.ts`:

| Test | Asserts |
| --- | --- |
| Pressure computed from the latest turn's usage | FR-1, §7.2 |
| **Pressure does not accumulate across turns** | **§7.2 — the central correctness risk** |
| Unknown model returns `null`, not 0 or 100 | FR-3 |
| Model with no window size returns `null` | FR-3 |
| Threshold boundaries classify correctly | §6 |
| Missing usage does not throw | FR-6 |

Extend `frontend/src/hooks/useClaudeStreaming.test.ts`:

| Test | Asserts |
| --- | --- |
| Compaction subtype emits a compaction event | FR-4 |
| **Compaction message does not reach the display pipeline as raw JSON** | **§7.4** |
| Unknown/renamed subtype degrades silently | FR-6 |
| `NON_DISPLAYED_SYSTEM_SUBTYPES` behaviour otherwise unchanged | Regression |
| Pressure recalculates after compaction | FR-12 |

New `frontend/src/components/chat/ContextPressure.test.tsx`:

| Test | Asserts |
| --- | --- |
| Hidden with no session or no data | FR-13 |
| Hidden when the window size is unknown | FR-3 |
| Accessible name conveys the value | FR-14 |
| Not colour-only | FR-15 |
| Exact numbers behind a disclosure | FR-9 |
| Warning threshold announced once, not repeatedly | FR-16 |
| **Not a continuously-updating live region** | FR-17 |

New `frontend/src/components/chat/CompactionDivider.test.tsx`:

| Test | Asserts |
| --- | --- |
| Renders as a divider, not a message bubble | §6 |
| Has no role/avatar implying an author | §6 |
| Readable in transcript reading order | FR-14 |

Add a `makeCompactionMessage` factory to `frontend/src/utils/sdkFixtures.ts`, per
`CLAUDE.md`'s rule that SDK shapes be built via factories rather than cast.

### Manual verification

1. Run a long session; watch pressure rise turn by turn — **verify it does not exceed 100%
   after a few turns**, which is the symptom of the §7.2 accumulation bug.
2. Cross 75% → warning treatment, announced once.
3. Trigger `/compact` → divider appears at the right position; pressure drops.
4. Compare the indicator against `--debug` token logs for plausibility.
5. Use a model absent from the window table → indicator hidden, no wrong number.
6. Narrow the viewport with P04 and P09 present → header degrades per the shared strategy.
7. Screen reader: value conveyed; no continuous chatter during streaming.

---

## 13. Rollout & migration

Additive: no endpoint, no wire change, no persistence, no migration. Minor release.

**Ships after P04** (usage extraction) and ideally after **P09** (so §7.3's consolidated model
table exists rather than a third parallel one).

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Pressure accumulates across turns instead of reflecting the window** | **Medium** | **High** | §7.2; explicit test; manual check 1 |
| 2 | **Compaction subtype string unknown** | **Medium** | **High** | §16.1 blocking; observe a live session per `CLAUDE.md`'s own precedent |
| 3 | Raw compaction JSON leaks into the transcript | Medium | Medium | §7.4 route-don't-display; explicit test |
| 4 | Window-size table rots | **High** (certain) | Medium | FR-3 hide-when-unknown; §7.3 consolidation with P04/P09 |
| 5 | Three parallel model tables drift | **Medium** | Medium | §7.3 — one `ModelInfo` module |
| 6 | Users treat an approximation as exact | Medium | Medium | §9 — approximate presentation, numbers behind disclosure |
| 7 | Header overcrowds with P04 and P09 | **High** | Medium | §6 shared responsive strategy, settled at P04 |
| 8 | Continuous live-region updates flood screen readers | Medium | Medium | FR-17; test |

---

## 15. Acceptance criteria

- [ ] Context pressure shown in the chat header
- [ ] **Pressure reflects the current window, not cumulative session usage**
- [ ] Hidden when model or window size is unknown — never a wrong number
- [ ] Threshold treatments applied; warning announced once
- [ ] Exact numbers available on demand
- [ ] Compaction detected and rendered as a transcript divider
- [ ] Compaction message never reaches the display pipeline as raw JSON
- [ ] `NON_DISPLAYED_SYSTEM_SUBTYPES` behaviour otherwise unchanged
- [ ] Unknown or renamed subtypes degrade silently
- [ ] Pressure recalculates after compaction
- [ ] Accessible name conveys the value; not colour-only
- [ ] Not a continuously-updating live region
- [ ] Header degrades sensibly alongside P04 and P09
- [ ] Window sizes live in the **consolidated** model module, not a third table
- [ ] `make check` passes

---

## 16. Open questions

1. **What is the compaction `subtype` string in the installed SDK?** Blocking for FR-4. Read
   `sdk.d.ts`; if absent, observe a live compaction under `--debug`, which is how
   `background_tasks_changed` and `task_started` were found (`CLAUDE.md`).
2. **Is there a better pressure signal than derived token counts?** If the SDK reports
   remaining context directly — in `init`, in `result`, or in a system subtype — that would be
   authoritative and would remove §9's approximation caveat entirely. Worth checking before
   building §7.2.
3. **Should `thinking_tokens` be surfaced too?** It is in the blocklist and is arguably
   relevant context signal. P02 §16.3 deferred it here. Recommendation: still no — it is
   per-turn detail, not window state.
4. **Should compaction markers be recoverable from history?** Depends on what Claude Code
   writes to JSONL — the same question P04 §16.2 asks about usage. If recoverable, loaded
   conversations show their boundaries, which is genuinely useful.
5. **Should the app suggest `/compact` above the threshold?** Actionable and helpful, but
   only once P20 makes the command discoverable. Sequence accordingly.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| **Resolve §16.1 and §16.2 (subtype, better signal)** | 3 h |
| Pressure calculation reusing P04's extraction | 2 h |
| Consolidate model metadata table (§7.3) | 2 h |
| Compaction routing in the processor | 2.5 h |
| `ContextPressure` component | 3 h |
| `CompactionDivider` component | 1.5 h |
| Header integration with P04/P09 responsive strategy | 2 h |
| Fixtures | 1 h |
| Tests | 4 h |
| Manual verification incl. a live compaction | 2 h |
| **Total** | **≈23 h — 3 days** |

---

## 18. References

- `frontend/src/utils/UnifiedMessageProcessor.ts` — `NON_DISPLAYED_SYSTEM_SUBTYPES`, `processSystemMessage`
- `frontend/src/hooks/streaming/useStreamParser.ts` — `IGNORED_SDK_MESSAGE_TYPES`
- `frontend/src/utils/sdkFixtures.ts` — required fixture factories
- `backend/handlers/chat.ts:73` — debug logging of full SDK messages
- `backend/history/parser.ts` — historical JSONL parsing (§8)
- `CLAUDE.md` § "`type: \"system\"` is a wide union" — compaction boundaries, and the
  found-by-observation precedent
- `CLAUDE.md` § "Claude Agent SDK Types Reference" — `init` carries `model`
- `../03-feature-comparison-matrix.md` — `COST-07`
- `../04-uiux-workflow-comparison.md` §3 "Feedback and system legibility"
- `P02-rate-limit-throttle-surfacing.md` §7.2 — the route-don't-display pattern
- `P04-token-usage-cost-visibility.md` §7.2, §6 — usage extraction and the header strategy
- `P09-model-selector.md` §7.3 — the model table this consolidates with
