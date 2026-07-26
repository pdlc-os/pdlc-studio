# P09 — Model Selector

| Field | Value |
| --- | --- |
| **Priority** | **P09** of 30 |
| **Score** | **16.0** |
| **Inputs** | Value 4 · Reach 4 · GapWeight ×2.0 · Effort 2 |
| **Category** | Model, Cost & Usage Observability |
| **Matrix features** | `COST-01` (model selector) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui **4** |
| **Effort** | **2** |
| **Depends on** | Nothing. Pairs with P04 (cost visibility) |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio gives the user no way to choose a model, and never tells them which one is
running.

`backend/handlers/chat.ts:50-70` calls the Agent SDK's `query()` with `abortController`,
`executable`, `pathToClaudeCodeExecutable`, `systemPrompt`, and conditionally `resume`,
`allowedTools`, `cwd`, and `permissionMode`. There is **no `model` option**. The CLI's own
default applies, whatever that happens to be for the user's configuration.

Two consequences:

1. **No choice.** A user who wants a faster, cheaper model for a mechanical task — or a more
   capable one for a hard design problem — cannot express that. They must exit the app and
   reconfigure the CLI.
2. **No visibility.** The model *is* reported: the `system` `init` message carries a `model`
   field (`CLAUDE.md`, "Claude Agent SDK Types Reference"). But `init` is in
   `NON_DISPLAYED_SYSTEM_SUBTYPES`, so it is processed for its session-id side effect and
   then dropped from display. The user never sees it.

This is part of the wider opacity pattern documented in
`04-uiux-workflow-comparison.md` §3: PDLC Studio hides rate limits (P02), cost and tokens
(P04), context pressure (P23), and model identity. Each is defensible alone; together they
make the system illegible.

**Model choice and cost visibility are complements.** P04 tells the user what a session
costs; P09 gives them the lever to change it. Shipping P04 first is right — cost visibility
creates the motivation — but shipping P04 *without* P09 leaves the user informed and
powerless.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui goes considerably further, supporting **four providers** — Claude
(`@anthropic-ai/claude-agent-sdk`), Codex/GPT (`@openai/codex-sdk`), Cursor CLI
(`/api/cursor`), and OpenCode — with `/api/providers` for configuration, a `provider-auth`
module for per-provider credentials, and `llm-logo-provider` for branding.

**PDLC Studio must not follow.** `COST-04` (multi-provider) is explicitly rejected in
`06-prioritization-and-roadmap.md` §4: *"Directly contradicts being a Claude Code front
end. This is the change that turned claudecodeui into CloudCLI."*

The lesson taken is the narrow one: **within Claude, let the user pick the model.** That is
a Claude Code capability the CLI already exposes and this app simply does not surface.

---

## 3. Goals & non-goals

### Goals

1. Show which model is running.
2. Let the user choose a model for a session.
3. Persist the choice across reloads.
4. Fail safely when a chosen model is unavailable.
5. Introduce no provider abstraction — this is Claude-only by design.

### Non-goals

- **Multi-provider support.** `COST-04`, rejected.
- **Per-message model switching.** Session-scoped is the right granularity; the SDK resumes
  sessions and mixing models mid-session has unclear semantics.
- **Cost display.** That is P04, though this PRD makes P04's estimates more accurate by
  making the model known and stable.
- **Model capability descriptions or recommendations.** Out of scope; the list should be
  factual.
- **Overriding CLAUDE.md or settings.json model configuration.** See §7.4 — the interaction
  needs care.

---

## 4. Personas & user stories

**Marcus — cost-conscious after seeing P04's numbers.**

> As a user who now sees what sessions cost, I want to pick a cheaper model for routine
> work, so that the information P04 gave me is actionable.

**Priya — hard architectural problem.**

> As a user facing a difficult design question, I want to select the most capable model, so
> that I am not silently getting a faster, weaker one.

**Devon — comparing.**

> As someone evaluating output quality, I want to run the same prompt on two models, so that
> I can judge whether the more expensive one is worth it.

**Sam — debugging.**

> As someone reporting a problem, I want to know which model produced the output, so that my
> bug report is actionable.

---

## 5. Functional requirements

### Display

- **FR-1** The active model **MUST** be visible in the chat surface without interaction.
- **FR-2** It **MUST** be sourced from the `system` `init` message, which is authoritative
  for what the CLI actually used — **not** from what the client requested.
- **FR-3** Where no model has been reported yet, the indicator **MUST** show an
  indeterminate state, not a guess.
- **FR-4** A model name **MUST** be displayed in a readable short form, with the full
  identifier available on demand.

### Selection

- **FR-5** The user **MUST** be able to select a model before starting a session.
- **FR-6** The selection **MUST** be sent to the backend and passed to the SDK.
- **FR-7** Omitting a selection **MUST** preserve today's behaviour exactly — the SDK
  receives no `model` option and the CLI's default applies.
- **FR-8** The selection **MUST** persist across reloads.
- **FR-9** Changing the model **MUST** apply from the next message; it **MUST NOT** silently
  alter an in-flight request.
- **FR-10** Where a session is being resumed, the UI **MUST** make clear whether the model
  can still be changed (see §16).

### Model list

- **FR-11** The list of selectable models **MUST** include a "Default" option meaning "send
  no `model`" (FR-7).
- **FR-12** The list **MUST** be maintainable in one place with a comment stating it requires
  manual updating.
- **FR-13** The UI **MUST** allow a model identifier not in the list to be used, since
  Anthropic ships new models faster than this list will be updated.
- **FR-14** An unrecognised model reported by `init` **MUST** still display (FR-2), even if
  absent from the list.

### Validation & errors

- **FR-15** The backend **MUST** validate the `model` field is a string of plausible shape
  and reject anything else with `400`, mirroring `resolvePermissionMode`'s posture.
- **FR-16** Where the CLI rejects a model, the error **MUST** surface to the user with the
  model name, not as a generic failure.
- **FR-17** A rejected model **MUST NOT** be silently persisted as the new default.

### Accessibility

- **FR-18** The control **MUST** be a labelled, keyboard-operable select or combobox.
- **FR-19** The indicator **MUST** expose the full model identifier to assistive technology.
- **FR-20** Model changes **SHOULD** be announced politely.

---

## 6. UX & interaction specification

### Indicator and control

The chat header already hosts the app mark and project name, and gains the usage indicator
in P04. The model belongs there too:

```
┌──────────────────────────────────────────────────────┐
│ ◈ PDLC Studio   my-project   ⛁ 47.2k · ~$0.31   Sonnet 5 ▾ │
└──────────────────────────────────────────────────────┘
```

Clicking opens the selector:

```
┌────────────────────────────────┐
│  Model                         │
│                                │
│  ○ Default (CLI setting)       │
│  ● Sonnet 5                    │
│  ○ Opus 5                      │
│  ○ Haiku 4.5                   │
│                                │
│  ○ Other…                      │
│    [ claude-…                ] │
│                                │
│  Applies from your next        │
│  message.                      │
└────────────────────────────────┘
```

- **"Default (CLI setting)"** is first and is the initial state (FR-7, FR-11). It must be
  clearly the do-nothing option, not a named model.
- **"Other…"** satisfies FR-13 with a free-text field.
- The "applies from your next message" note sets expectations for FR-9.

Compose from Astryx select/radio and popover primitives. **No new CSS classes** — app CSS is
restricted to the existing app-shell classes (`CLAUDE.md`).

### Header crowding

By the time P04 and P09 both ship, the header carries app mark, project name, usage, cost,
and model. On narrow viewports this will not fit. Both PRDs must degrade:

| Width | Header shows |
| --- | --- |
| Wide | Mark · project · usage · cost · model |
| Medium | Mark · project · usage · model |
| Narrow | Mark · project, with usage and model behind one overflow control |

**P04 and P09 should agree this behaviour rather than each solving it independently**, or the
header will end up with two competing responsive strategies.

### States

| State | Behaviour |
| --- | --- |
| No session yet | Shows the selected preference, or "Default" |
| Session started, `init` received | Shows the **actual** model from `init` (FR-2) |
| Selected ≠ reported | Show the reported one; this is the truth. Optionally flag the mismatch |
| Model changed mid-session | Indicator shows pending change; applies next message (FR-9) |
| CLI rejects the model | Error naming the model; selection not persisted (FR-16, FR-17) |
| Unknown model reported | Display the raw identifier (FR-14) |

The "selected ≠ reported" row matters: a `settings.json` or managed-policy model setting may
override the request, exactly as `permissions.disableBypassPermissionsMode` can override the
permission mode (`backend/utils/permissions.ts:20-23`). The UI must show reality.

---

## 7. Technical design

### 7.1 Wire contract

`shared/types.ts` — extend `ChatRequest`:

```ts
export interface ChatRequest {
  message: string;
  sessionId?: string;
  requestId: string;
  allowedTools?: string[];
  workingDirectory?: string;
  permissionMode?: "default" | "plan" | "acceptEdits" | "bypassPermissions";
  /**
   * Model identifier forwarded to the Claude CLI. Omitting it means no `model`
   * option is passed to the SDK and the CLI's own default applies — which is
   * the historical behaviour and remains the default.
   */
  model?: string;
}
```

Optional, so omitting it is exactly today's behaviour (FR-7).

### 7.2 Backend

**`backend/handlers/chat.ts`** — `executeClaudeCommand` gains a `model?: string` parameter,
spread conditionally alongside the existing options:

```ts
...(model ? { model } : {}),
```

This matches the established pattern at lines 66-69 and preserves FR-7 by construction.

**Validation** belongs in a new `backend/utils/model.ts`, mirroring
`backend/utils/permissions.ts`:

```ts
export function resolveModel(requested: string | undefined): string | null | undefined;
```

Returning `undefined` for "not specified", a string for valid, and `null` for invalid —
letting the handler return `400` exactly as it does for permission mode
(`backend/handlers/chat.ts:120-131`).

**Validation must be shape-based, not allowlist-based.** An allowlist would break every time
Anthropic ships a model (FR-13). Validate: non-empty, reasonable length, and characters
limited to `[A-Za-z0-9._-]`. That is enough to keep arbitrary strings off a CLI flag while
staying open to new identifiers.

> This is the same reasoning `backend/utils/permissions.ts:38-45` gives for
> `resolvePermissionMode`: *"the wire type is erased at runtime, so an untrusted body could
> otherwise put an arbitrary string on the CLI's flag."* The difference is that permission
> modes are a closed set and model names are not.

### 7.3 Frontend

| Item | Purpose |
| --- | --- |
| New `frontend/src/hooks/chat/useModelSelection.ts` | Selection state, persistence |
| New `frontend/src/components/chat/ModelSelector.tsx` | The control |
| New `frontend/src/utils/models.ts` | The known-model list (FR-12) |
| Modify `frontend/src/components/ChatPage.tsx` | Mount in header |
| Modify chat request construction | Include `model` |

**Reading the reported model (FR-2)** requires the `init` message. `CLAUDE.md` is explicit
that `init` is filtered from **display only** and still processed —
`processSystemMessage` runs `setHasReceivedInit(true)` before filtering, and a test locks
that pairing in. So the model can be captured in the same side-effect path **without
changing `NON_DISPLAYED_SYSTEM_SUBTYPES`**.

That is important: adding `init` back to the display would dump the session banner into the
transcript, which the blocklist exists to prevent.

Persistence (FR-8) goes through `AppSettings` and `useSettings`, alongside theme, Enter
behaviour, and — after P01 — permission mode. **P01 already bumps
`CURRENT_SETTINGS_VERSION` and rewrites the migration**; if P09 lands after P01, it must bump
again and extend the same migration rather than writing a parallel one.

### 7.4 Interaction with CLAUDE.md and settings.json

A real complication worth surfacing.

`CLAUDE.md` notes that `settingSources` defaults to loading all filesystem settings (`user`,
`project`, `local`), so a project's `settings.json` and `CLAUDE.md` are picked up
automatically. If a project pins a model there, passing `model` from the UI may override it,
or may be overridden by it — **the precedence is not documented and must be determined
empirically** before shipping.

Whatever the answer, FR-2's rule saves the UI: display what `init` reports, not what was
requested. If a project setting wins, the user sees that immediately rather than believing a
selection took effect when it did not.

### 7.5 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Validation pattern | `resolvePermissionMode` / `VALID_PERMISSION_MODES` | `backend/utils/permissions.ts` |
| Conditional SDK option spread | existing options block | `backend/handlers/chat.ts:66-69` |
| `init` side-effect path | `processSystemMessage` | `frontend/src/utils/UnifiedMessageProcessor.ts` |
| Settings persistence | `AppSettings`, `useSettings` | `frontend/src/utils/storage.ts`, `hooks/useSettings.ts` |
| Header layout | existing chat header | `frontend/src/components/ChatPage.tsx` |
| Test fixtures | `makeSystemInitMessage` | `frontend/src/utils/sdkFixtures.ts` |

`makeSystemInitMessage` already exists and constructs `init` messages — exactly what the
tests need.

---

## 8. Data model & persistence

| Datum | Store | Lifetime |
| --- | --- | --- |
| Selected model preference | `AppSettings` in `localStorage` | Until cleared |
| Reported model | React state from `init` | Session |
| Known-model list | Module constant | Build time |

No server-side persistence. No database.

Per-browser, like every other setting. Consistent with theme and Enter behaviour, and with
P01's permission-mode persistence.

---

## 9. Security implications

Small but real, and the mitigation is the point of §7.2.

**The `model` value reaches a CLI invocation.** `backend/utils/permissions.ts:38-45` already
documents this class of risk for `permissionMode`: the TypeScript wire type is erased at
runtime, so an untrusted body can put an arbitrary string on a CLI flag. The same applies
here.

Because model names are open-ended, an allowlist is not viable (FR-13). The mitigation is
strict **character** validation — `[A-Za-z0-9._-]`, bounded length, non-empty — which
prevents flag injection (`--dangerous-thing`), path traversal, and shell metacharacters,
while permitting any plausible future model identifier.

Note the SDK is invoked with an options object rather than a shell string
(`backend/handlers/chat.ts:50-70`), so this is defence in depth rather than the only barrier.
The project already applies this posture elsewhere: `git clone` uses an argv array with an
explicit `--` terminator (`backend/handlers/projectSetup.ts:193`).

No new endpoint, no new read surface, no new dependency.

---

## 10. Performance & scale

Negligible. One extra optional string per request; one small header control. Selecting a
faster model is itself a performance feature for the user.

---

## 11. Telemetry & observability

Server-side, via `backend/utils/logger.ts`:

- `logger.chat.debug` already logs the full chat request
  (`backend/handlers/chat.ts:115-118`), so the requested model is captured under `--debug`
  with no change.
- `logger.chat.warn` on a rejected model, mirroring the existing permission-mode rejection
  warning at lines 122-124.

No client analytics.

---

## 12. Test plan

### Backend — Deno test runner, `make test-backend`

New `backend/utils/model.test.ts`:

| Test | Asserts |
| --- | --- |
| `undefined` returns `undefined` (not specified) | FR-7 |
| A plausible identifier passes | FR-13 |
| Empty string rejected | FR-15 |
| Over-long string rejected | FR-15 |
| **String containing spaces rejected** | §9 |
| **String starting with `-` rejected** | §9 flag injection |
| String with `/`, `;`, `$`, backtick rejected | §9 |
| An unknown-but-well-formed identifier passes | FR-13 |

Extend `backend/handlers/chat.test.ts`:

| Test | Asserts |
| --- | --- |
| **Omitted `model` passes no `model` option to the SDK** | **FR-7 — the compatibility guarantee** |
| Provided valid model is passed through | FR-6 |
| Invalid model returns 400 naming the field | FR-15 |
| Existing permission-mode behaviour unaffected | Regression |

### Frontend — Vitest, `make test-frontend`

New `frontend/src/hooks/chat/useModelSelection.test.ts`:

| Test | Asserts |
| --- | --- |
| Defaults to "Default" with empty storage | FR-7, FR-11 |
| Selection persists and restores | FR-8 |
| Corrupt persisted value falls back to Default | Robustness |
| Reported model from `init` overrides displayed value | FR-2 |
| Change does not affect an in-flight request | FR-9 |
| Rejected model is not persisted | FR-17 |

New `frontend/src/components/chat/ModelSelector.test.tsx`:

| Test | Asserts |
| --- | --- |
| Labelled and keyboard-operable | FR-18 |
| "Default" listed first and selectable | FR-11 |
| "Other…" accepts a free-text identifier | FR-13 |
| Unknown reported model still displays | FR-14 |
| Full identifier exposed to assistive technology | FR-19 |
| Indeterminate state before any `init` | FR-3 |

Use `makeSystemInitMessage` from `sdkFixtures.ts` rather than hand-constructing `init`
messages, per `CLAUDE.md`.

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Fresh install → "Default"; behaviour identical to today.
2. Select a model → next message uses it; indicator shows the **reported** model.
3. Reload → selection persisted.
4. Enter a nonsense model via "Other…" → clear error naming the model; selection not stuck.
5. **Pin a different model in a project `settings.json`** → observe precedence (§7.4) and
   confirm the indicator shows reality.
6. Narrow the viewport → header degrades per §6 without overlapping P04's indicator.
7. `curl` a chat POST with `model: "--evil"` → 400.

---

## 13. Rollout & migration

- **Fully backwards compatible.** Omitting `model` is today's behaviour, guaranteed by test.
- Settings version bump; **coordinate with P01**, which also bumps it (§7.3).
- Minor release.
- **Ship after P04**, so the header's responsive strategy is settled once (§6).

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | Model list goes stale and misleads users | **High** (certain over time) | Medium | FR-11 Default option, FR-13 "Other…", FR-12 maintenance comment |
| 2 | **Arbitrary string reaches a CLI flag** | Medium | **High** | §9 character validation; flag-injection tests |
| 3 | Precedence with `settings.json` / CLAUDE.md unknown | **Medium** | Medium | §7.4 determine empirically; FR-2 makes the UI honest regardless |
| 4 | Header overcrowds once P04 also lands | **High** | Medium | §6 shared responsive strategy agreed between the two PRDs |
| 5 | Settings migration conflicts with P01's | Medium | Medium | Extend the same migration; do not write a parallel one |
| 6 | Mid-session model change produces confusing SDK behaviour | Medium | Medium | FR-9 next-message semantics; §16 open question on resume |
| 7 | Users assume the selector guarantees the model | Medium | Low | FR-2 displays reported, not requested |

---

## 15. Acceptance criteria

- [ ] Active model visible in the chat header
- [ ] Displayed model sourced from `init`, not from the request
- [ ] Indeterminate state before any `init`
- [ ] Model selectable, including a free-text "Other…"
- [ ] "Default (CLI setting)" is the initial state and sends no `model`
- [ ] **Omitting selection passes no `model` to the SDK — proven by test**
- [ ] Selection persists across reload
- [ ] Change applies from the next message, not in-flight
- [ ] Invalid model rejected with 400 and a clear client-side error
- [ ] Rejected model not persisted
- [ ] Character validation blocks spaces, leading `-`, and shell metacharacters
- [ ] Unknown reported model still displays
- [ ] `init` remains filtered from display; `NON_DISPLAYED_SYSTEM_SUBTYPES` unchanged
- [ ] Header degrades sensibly on narrow viewports alongside P04
- [ ] Control labelled and keyboard-operable
- [ ] `make check` passes

---

## 16. Open questions

1. **What is the precedence between a request `model` and a project `settings.json` model?**
   Blocking for §7.4. Determine empirically before shipping.
2. **Can the model change on a resumed session?** The SDK receives `resume: sessionId`
   (`backend/handlers/chat.ts:66`). Whether a different `model` alongside `resume` is
   honoured, ignored, or an error is unknown. FR-10 depends on the answer. If it is not
   supported, the selector should disable itself on resumed sessions with an explanation.
3. **Should the model list be fetched rather than hard-coded?** The CLI may be able to report
   available models. If so, FR-12's maintenance burden disappears. Worth investigating —
   this is the difference between a list that rots and one that does not.
4. **Should model be per-project?** A user might want a cheap model for one repo and a
   capable one for another. Per-project settings are `PROJ-07`, deferred on persistence
   grounds. Global for now.
5. **Should the mismatch between selected and reported be flagged actively**, or just
   displayed? Active flagging is more honest; it also risks nagging when a project setting
   legitimately wins every time.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Investigate precedence and resume semantics (§16.1, §16.2) | 2 h |
| `shared/types.ts` extension | 0.5 h |
| `backend/utils/model.ts` validation | 1.5 h |
| `chat.ts` threading | 1 h |
| Capture reported model from `init` | 1.5 h |
| `useModelSelection` hook + persistence | 2 h |
| `ModelSelector` component | 3 h |
| Known-model list | 0.5 h |
| Header integration + responsive strategy with P04 | 2 h |
| Backend tests | 3 h |
| Frontend tests | 3 h |
| Manual verification | 1.5 h |
| **Total** | **≈21.5 h — 3 days** |

---

## 18. References

- `backend/handlers/chat.ts:50-70` — `query()` options, with no `model`
- `backend/handlers/chat.ts:120-131` — the validation-and-400 pattern to mirror
- `backend/utils/permissions.ts:38-55` — `resolvePermissionMode`, and the wire-type-erasure rationale
- `backend/handlers/projectSetup.ts:193` — argv-array precedent for untrusted input
- `shared/types.ts:7-22` — `ChatRequest`
- `frontend/src/utils/UnifiedMessageProcessor.ts` — `NON_DISPLAYED_SYSTEM_SUBTYPES`, `processSystemMessage`
- `frontend/src/utils/sdkFixtures.ts` — `makeSystemInitMessage`
- `CLAUDE.md` § "Claude Agent SDK Types Reference" — `init` carries `model`
- `CLAUDE.md` § "The system prompt is opt-in" — `settingSources` defaults
- `../01-claudecodeui-deep-scan.md` §3.9 — competitor's multi-provider approach
- `../03-feature-comparison-matrix.md` — `COST-01`, `COST-04`
- `../06-prioritization-and-roadmap.md` §4 — why multi-provider is rejected
