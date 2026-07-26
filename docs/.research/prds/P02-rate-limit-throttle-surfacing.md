# P02 — Rate-Limit & Throttle Surfacing

| Field | Value |
| --- | --- |
| **Priority** | **P02** of 30 |
| **Score** | **24.0** |
| **Inputs** | Value 4 · Reach 4 · GapWeight ×1.5 · Effort 1 |
| **Category** | Model, Cost & Usage Observability |
| **Matrix features** | `COST-05` (rate-limit surfacing) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui UNVERIFIED |
| **Effort** | **1** — one filter list, one message component, one hook branch |
| **Depends on** | Nothing |
| **Blocks** | Nothing, but shares plumbing with P04 and P23 |
| **Status** | Proposed |

---

## 1. Context & problem statement

When a user hits an Anthropic rate limit, **PDLC Studio shows them nothing at all.** The
interface simply stops producing output. There is no spinner change, no message, no
explanation, and no indication of when it might resume. From the user's side it is
indistinguishable from a hang, a crash, or a very slow tool call.

This is not an oversight in the sense of "nobody built it." It is an active, deliberate
suppression. `frontend/src/hooks/streaming/useStreamParser.ts` maintains
`IGNORED_SDK_MESSAGE_TYPES`, and `CLAUDE.md` explains the reasoning:

> The SDK's union is much wider than the four types this app renders, and some of the rest
> arrive constantly — `rate_limit_event` comes once per turn. Listing them there keeps them
> silent.

The reasoning is sound and the outcome is wrong. `rate_limit_event` arriving *once per turn*
is exactly why it must not be rendered as a transcript message — it would flood the
conversation. But that argues for rendering it **somewhere other than the transcript**, not
for discarding it. The current design throws away the only signal that explains the app's
most confusing failure mode.

There is a second, related suppression. `NON_DISPLAYED_SYSTEM_SUBTYPES` in
`frontend/src/utils/UnifiedMessageProcessor.ts` filters `thinking_tokens` and other
telemetry subtypes. Together these two blocklists implement a coherent philosophy — *keep
the transcript clean* — that has simply been applied one step too far.

### Why this is P02

Effort 1, and it converts the single most confusing user-facing behaviour in the product
into an explained one. It requires no new endpoint, no new dependency, and no change to the
wire contract. The data already arrives; it is being deliberately dropped three lines from
where it would be useful.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui's specific rate-limit handling is **UNVERIFIED** — the scan did not read its
chat view components. What *is* verified is that it surfaces adjacent system state that
PDLC Studio hides: per-session token accounting persisted in SQLite (`tokens_input`,
`tokens_output`) and exposed at
`/api/projects/:projectId/sessions/:sessionId/token-usage`.

The priority of this PRD therefore does **not** rest on a competitor claim. It rests on the
observation in `04-uiux-workflow-comparison.md` §3 that PDLC Studio hides four distinct
categories of system state — rate limits, context pressure, cost, and model identity — and
that rate limits are the one whose absence produces an apparent malfunction rather than
merely missing information.

---

## 3. Goals & non-goals

### Goals

1. A rate-limited user **must** see that they are rate-limited.
2. The indication **must not** pollute the transcript, given once-per-turn frequency.
3. Where the SDK provides a reset time, it **must** be shown.
4. The signal **must** clear automatically when generation resumes.
5. The change **must** preserve the existing "warn once per page load" discipline for
   genuinely unknown message types.

### Non-goals

- **Cost or token display.** That is P04, though it shares the plumbing.
- **Context-window pressure.** That is P23.
- **Retry or backoff logic.** The SDK and CLI own retry behaviour; this PRD only reports.
- **Rate-limit prediction or quota dashboards.** Deferred (`COST-06`).
- **Changing what the transcript renders.** Rate-limit state belongs in chrome, not history.

---

## 4. Personas & user stories

**Priya — evaluating the tool.** Asks a large refactoring question, watches nothing happen
for 90 seconds, concludes the app is broken, and closes the tab.

> As a new user, I want to know when the model is rate-limited rather than stalled, so that
> I do not mistake a quota limit for a bug.

**Marcus — heavy daily user.** Runs long agent sessions and hits limits regularly.

> As a heavy user, I want to see when my limit resets, so that I can decide whether to wait
> or stop for the day.

**Devon — debugging a report.** A colleague says "it just froze."

> As someone triaging, I want the UI to distinguish rate-limiting from a hang, so that I am
> not chasing a bug that does not exist.

---

## 5. Functional requirements

- **FR-1** `rate_limit_event` **MUST** be removed from `IGNORED_SDK_MESSAGE_TYPES` and
  routed to a handler instead of being discarded.
- **FR-2** Removing it **MUST NOT** cause it to render as a transcript message. It **MUST**
  be handled as chrome state.
- **FR-3** When a rate-limit event is active, a persistent, non-modal indicator **MUST** be
  visible in the chat surface.
- **FR-4** The indicator **MUST** state that generation is rate-limited, in plain language,
  without SDK jargon.
- **FR-5** Where the event carries a reset timestamp, the indicator **MUST** show it as a
  human-readable relative time ("resets in about 4 minutes"), reusing
  `frontend/src/utils/time.ts`.
- **FR-6** Where no reset time is available, the indicator **MUST** omit the timing clause
  rather than showing a placeholder.
- **FR-7** The indicator **MUST** clear on the next successfully streamed assistant content,
  on `result`, on `aborted`, or on a new user message.
- **FR-8** Repeated `rate_limit_event`s within one turn **MUST** update the existing
  indicator, never stack.
- **FR-9** Unknown SDK message types **MUST** continue to warn once per page load, not once
  per occurrence.
- **FR-10** The rate-limit state **MUST** be exposed by the streaming hook so any component
  can consume it, rather than being local to one component.
- **FR-11** `CLAUDE.md`'s description of `IGNORED_SDK_MESSAGE_TYPES` **MUST** be updated —
  it currently names `rate_limit_event` as the canonical example of a silenced type.

---

## 6. UX & interaction specification

### Placement

**Not in the transcript.** A slim status strip between the message list and the composer —
the same region that already hosts `PermissionInputPanel` and `PlanPermissionInputPanel`,
which is the established location for transient, action-adjacent state.

```
┌──────────────────────────────────────────────────┐
│  … transcript …                                  │
│                                                  │
├──────────────────────────────────────────────────┤
│  ⏳  Rate limited — resets in about 4 minutes     │
├──────────────────────────────────────────────────┤
│  [ composer                                   ]  │
└──────────────────────────────────────────────────┘
```

Compose from an Astryx status/callout component. Do not hand-roll — `CLAUDE.md` restricts
app CSS to the existing app-shell classes. Discover the component with
`npx @astryxdesign/cli component --list`.

### Copy

| Condition | Text |
| --- | --- |
| Reset time known | "Rate limited — resets in about {relative time}" |
| Reset time unknown | "Rate limited — waiting for capacity" |

Avoid "429", "quota exceeded", and `rate_limit_event`. The user needs to know the app is
working and waiting, not which SDK field fired.

### States

| State | Behaviour |
| --- | --- |
| No rate limit | Strip absent. No layout reservation — it must not leave a gap. |
| Rate limit, first event | Strip appears. Does not steal focus. |
| Rate limit, subsequent events same turn | Strip updates in place (FR-8). |
| Content resumes | Strip disappears (FR-7). |
| User aborts | Strip disappears. |
| User sends a new message | Strip disappears; the new turn may re-raise it. |

### Accessibility

- The strip **MUST** be an ARIA live region with `aria-live="polite"` — it is meaningful
  status a screen-reader user would otherwise miss entirely, and `polite` avoids
  interrupting streamed content.
- It **MUST NOT** take focus.
- The relative time **SHOULD** carry a `title` or visually-hidden absolute timestamp, since
  "about 4 minutes" is ambiguous when read out of context.
- Colour **MUST NOT** be the only signal — pair with the icon and the text.

---

## 7. Technical design

### 7.1 The SDK message shape

`rate_limit_event` is part of the Agent SDK's wide top-level union. Its exact payload
**must be confirmed against the installed SDK's `sdk.d.ts`** before implementation:

```
frontend/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts
```

`CLAUDE.md` is explicit that this union is wider than the four types the app renders and
that fields must be narrowed rather than assumed. Do not guess at a `resetsAt` field name —
read it. If no reset timestamp is present in the installed version, FR-5 degrades to FR-6
and the PRD still delivers its core value.

### 7.2 Frontend — the parser

`frontend/src/hooks/streaming/useStreamParser.ts` currently filters by membership in
`IGNORED_SDK_MESSAGE_TYPES`. The change is to route rather than drop:

- Remove `"rate_limit_event"` from the ignore list (FR-1).
- Add an explicit branch that narrows the message and calls a new
  `onRateLimit(info | null)` callback.
- The message **must not** fall through to the display pipeline (FR-2).

The existing once-per-page-load warning for unrecognised types must be untouched (FR-9).
`useStreamParser.test.ts` already covers that behaviour and is the regression guard.

### 7.3 Frontend — state

`useClaudeStreaming` (`frontend/src/hooks/useClaudeStreaming.ts`) is the composition point
and should own the state, exposing:

```ts
rateLimit: { active: boolean; resetsAt?: string } | null;
```

Clearing (FR-7) belongs here too, since this hook already sees assistant content, `result`,
and `aborted` — the three clearing triggers — in one place.

`useChatState` (`frontend/src/hooks/chat/useChatState.ts`) clears it on new user message.

### 7.4 Frontend — component

New: `frontend/src/components/chat/RateLimitNotice.tsx`, rendered by `ChatMessages` or
`ChatPage` in the same region as the permission panels.

Relative time formatting reuses `frontend/src/utils/time.ts` (52 lines) rather than adding
a formatting dependency.

### 7.5 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Relative time formatting | existing helpers | `frontend/src/utils/time.ts` |
| Panel placement precedent | permission panels | `frontend/src/components/chat/PermissionInputPanel.tsx` |
| Message-type filtering | `IGNORED_SDK_MESSAGE_TYPES` | `frontend/src/hooks/streaming/useStreamParser.ts` |
| Test fixtures for SDK messages | factories | `frontend/src/utils/sdkFixtures.ts` |

`sdkFixtures.ts` matters here: `CLAUDE.md` is explicit that constructing SDK shapes by hand
requires substantial bookkeeping and that fixtures must go through the factories. A
`makeRateLimitEvent` factory should be added there rather than casting in each test.

### 7.6 Backend

**No backend change.** The backend forwards SDK messages verbatim as
`{ type: "claude_json", data: sdkMessage }` (`backend/handlers/chat.ts:75-78`), so
`rate_limit_event` already reaches the client. This is entirely a frontend change — which
is why it is effort 1.

---

## 8. Data model & persistence

**None.** Rate-limit state is ephemeral, per-tab, and lives in React state for the duration
of a turn. Persisting it would be wrong — a stale "rate limited" strip after a reload would
be worse than no strip.

---

## 9. Security implications

Effectively none. One consideration: the reset timestamp comes from the SDK and is rendered
as text. It **must** be formatted through the existing time utilities and **must not** be
interpolated as HTML. PDLC Studio does not use `rehype-raw` or any raw-HTML path, so there
is no injection surface — but the general rule holds, and a test asserting the strip renders
as text is cheap insurance.

Minor positive: distinguishing "rate limited" from "hung" reduces the chance a user
force-quits mid-tool-call, which can leave a partially applied edit.

---

## 10. Performance & scale

Negligible. One additional narrow branch per streamed message, and one small component
mounted only while a limit is active. The relative-time display should update on a interval
no faster than **once per 15 seconds** — a per-second countdown would cause a re-render
every second for the whole rate-limit duration, which is wasteful for no user benefit.

---

## 11. Telemetry & observability

The backend already logs every SDK message at debug level
(`logger.chat.debug("Claude SDK Message: {sdkMessage}")`, `backend/handlers/chat.ts:73`), so
rate-limit events are already captured under `--debug`. No new server logging is required.

Client-side: no analytics. Optionally a single `console.info` on first rate-limit per page
load, consistent with the once-per-load discipline.

---

## 12. Test plan

### Frontend — Vitest, `make test-frontend`

Extend `frontend/src/hooks/streaming/useStreamParser.test.ts`:

| Test | Asserts |
| --- | --- |
| `rate_limit_event` no longer in `IGNORED_SDK_MESSAGE_TYPES` | FR-1 |
| `rate_limit_event` invokes `onRateLimit`, not the display pipeline | FR-1, FR-2 |
| Genuinely unknown type still warns **once** across many occurrences | FR-9 regression |
| Other ignored types remain silent | Regression |

Extend `frontend/src/hooks/useClaudeStreaming.test.ts`:

| Test | Asserts |
| --- | --- |
| Rate-limit event sets `rateLimit.active` | FR-3 |
| Reset timestamp is captured when present | FR-5 |
| Absent timestamp yields no timing clause | FR-6 |
| Assistant content clears the state | FR-7 |
| `result` clears the state | FR-7 |
| `aborted` clears the state | FR-7 |
| Two events in one turn do not stack | FR-8 |

New `frontend/src/components/chat/RateLimitNotice.test.tsx`:

| Test | Asserts |
| --- | --- |
| Renders nothing when inactive | FR-3 |
| Renders the plain-language message when active | FR-4 |
| Shows relative reset time when known | FR-5 |
| Omits timing clause when unknown | FR-6 |
| Has `aria-live="polite"` | A11y |
| Does not receive focus on mount | A11y |

Add `makeRateLimitEvent` to `frontend/src/utils/sdkFixtures.ts` per `CLAUDE.md`'s fixture
rule.

### Manual verification

Rate limits are hard to trigger on demand. Two practical approaches:

1. **Demo mode.** `frontend/src/utils/mockResponseGenerator.ts` (787 lines) already
   synthesises SDK messages for `/demo`. Add a rate-limit scenario there — this gives
   permanent, deterministic manual verification and improves the demo.
2. Temporarily inject a synthetic `rate_limit_event` in dev to confirm placement and live
   region behaviour.

Option 1 is strongly preferred and should be considered part of the work.

---

## 13. Rollout & migration

- No migration. No persisted state, no wire change, no config.
- Patch or minor release; no breaking change.
- Ships safely alongside P01 — they touch disjoint files.
- `CLAUDE.md` update (FR-11) must be in the same PR, since it currently cites
  `rate_limit_event` as the example of a deliberately silenced type and would otherwise
  contradict the code.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | The installed SDK's `rate_limit_event` carries no reset timestamp | **Medium** | Low | FR-6 degrades gracefully; core value is unaffected. Read `sdk.d.ts` first. |
| 2 | Removing the type from the ignore list leaks it into the transcript | Medium | Medium | FR-2 plus an explicit test that the display pipeline is not invoked |
| 3 | The event fires more often than "once per turn", causing flicker | Low | Medium | FR-8 updates in place; 15-second refresh cap in §10 |
| 4 | Field names change in a future SDK version | Medium | Low | Narrow explicitly per `CLAUDE.md`; the test fixture localises the fix |
| 5 | Live region is too chatty for screen readers | Low | Medium | `polite`, and the strip updates in place rather than remounting |
| 6 | Strip reserves layout space when inactive, causing a visible gap | Low | Low | Explicit test that nothing renders when inactive |

---

## 15. Acceptance criteria

- [ ] `rate_limit_event` removed from `IGNORED_SDK_MESSAGE_TYPES`
- [ ] It is routed to a handler, not the transcript
- [ ] An indicator appears in the panel region while rate-limited
- [ ] Copy is plain language with no SDK jargon
- [ ] Reset time shown as relative time when available
- [ ] Timing clause omitted when unavailable
- [ ] Indicator clears on content, `result`, `aborted`, and new user message
- [ ] Repeated events update in place
- [ ] Unknown types still warn once per page load
- [ ] `aria-live="polite"`, no focus steal
- [ ] Nothing renders and no space is reserved when inactive
- [ ] `makeRateLimitEvent` added to `sdkFixtures.ts`
- [ ] Demo mode includes a rate-limit scenario
- [ ] `CLAUDE.md` no longer cites `rate_limit_event` as silenced
- [ ] `make check` passes

---

## 16. Open questions

1. **Does the installed SDK's `rate_limit_event` include a reset time?** Blocking for FR-5.
   Resolve by reading `sdk.d.ts` before starting.
2. **Should the composer be disabled while rate-limited?** Arguably queuing a message is
   fine and the CLI will handle it. Recommendation: leave it enabled — disabling input on a
   condition the app cannot verify has ended is worse than a possible retry.
3. **Should this also surface `thinking_tokens`?** It is in the other blocklist and is
   arguably useful context-pressure signal. Recommendation: no — that is P23's scope, and
   bundling would push this past effort 1.
4. **Is the panel region the right home**, or should this be a header badge? The panel region
   is closer to the user's attention during generation; a header badge is less intrusive but
   more missable. Recommendation: panel region, revisit if it feels heavy.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Read `sdk.d.ts`, confirm payload shape | 0.5 h |
| Parser routing change | 1 h |
| State + clearing in `useClaudeStreaming` | 1.5 h |
| `RateLimitNotice` component | 1.5 h |
| `makeRateLimitEvent` fixture | 0.5 h |
| Demo-mode scenario | 1 h |
| Tests (parser, streaming, component) | 3 h |
| `CLAUDE.md` update | 0.5 h |
| **Total** | **≈9.5 h — 1.5 days** |

---

## 18. References

- `frontend/src/hooks/streaming/useStreamParser.ts` — `IGNORED_SDK_MESSAGE_TYPES`
- `frontend/src/utils/UnifiedMessageProcessor.ts` — `NON_DISPLAYED_SYSTEM_SUBTYPES`
- `frontend/src/hooks/useClaudeStreaming.ts` — composition point for stream state
- `frontend/src/utils/time.ts` — relative-time helpers
- `frontend/src/utils/sdkFixtures.ts` — required fixture factories
- `frontend/src/utils/mockResponseGenerator.ts` — demo-mode scenarios
- `backend/handlers/chat.ts:73-78` — verbatim SDK forwarding
- `CLAUDE.md` § "`type: \"system\"` is a wide union"
- `../03-feature-comparison-matrix.md` — `COST-05`
- `../04-uiux-workflow-comparison.md` §3 "Feedback and system legibility"
