# P24 — Tool Allowlist UI

| Field | Value |
| --- | --- |
| **Priority** | **P24** of 30 |
| **Score** | **9.0** |
| **Inputs** | Value 4 · Reach 3 · GapWeight ×1.5 · Effort 2 |
| **Category** | Tool Execution, Permissions & Safety |
| **Matrix features** | `TOOL-04` (tool allowlist UI) |
| **Maturity** | PDLC Studio **1** → target **3** · claudecodeui **4** |
| **Effort** | **2** |
| **Depends on** | **P01** — this is the answer to the prompt fatigue P01 introduces |
| **Blocks** | P27 (audit log) pairs with it |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio has a **fully built tool-allowlist capability that no user can reach.**

The evidence, from `03-feature-comparison-matrix.md` and verified in source:

- `allowedTools?: string[]` is a first-class field on the wire contract
  (`shared/types.ts:11`).
- The backend forwards it to the SDK: `...(allowedTools ? { allowedTools } : {})`
  (`backend/handlers/chat.ts:67`).
- `frontend/src/utils/toolUtils.ts` is **139 lines** of command parsing built specifically for
  this, with a **171-line test file** beside it.
- `frontend/src/utils/constants.ts:23-49` defines `TOOL_CONSTANTS` — multi-word commands
  (`cargo`, `git`, `npm`, `yarn`, `docker`), a wildcard, compound separators (`&&`, `||`,
  `;`, `|`), and a conservative list of 16 Bash builtins that never need approval.

Every part of this is implemented and tested. **Nothing in the UI writes the field.**

`04-uiux-workflow-comparison.md` §3 names it as the sharpest of its three discoverability
examples:

> **`allowedTools`.** A first-class field on the wire contract with sophisticated parsing
> behind it, and **no UI writes it**. The capability is fully built and completely
> unreachable.

This is why the matrix scores it maturity **1** (Stub) rather than 0. The distinction matters
for sizing: this is not "build a permission system", it is "build a form over one that
already exists".

### The P01 dependency is the real motivation

P01 changes the default permission mode from `bypassPermissions` to `default`, which means
approval prompts appear where previously there were none. P01 §9 identifies the resulting
risk in its own words:

> **New risk introduced**: prompt fatigue. Approval prompts on every tool call may push users
> to `bypassPermissions` faster than the current default would have. FR-12's one-time
> acknowledgement is a partial mitigation; **P24 (tool allowlist UI) is the real answer**,
> letting users permit `Read` and `Grep` permanently while still gating `Bash`.

That is the case for this PRD. Without it, P01's safe default is uncomfortable enough that
users will opt out of it wholesale — trading a well-designed safety feature for a blanket
bypass. With it, they can permit the safe majority of tool calls and keep prompts for the ones
that matter.

### Why P24 rather than higher

Reach is 3 — it matters most to users who have engaged with permission modes at all, which is
a subset. Its value rises sharply once P01 ships, and the two should be sequenced close
together.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui scores 4, with tools **disabled by default** and a settings surface
(`/api/settings`, a `settings` component module) through which the user opts in.

The relevant design point is that it treats tool permission as **persistent configuration**
rather than per-session state. A user decides once which tools are acceptable, and that
decision holds.

PDLC Studio's current model is the opposite on both counts: everything is permitted by
default (until P01), and the permission *mode* is not even persisted across a reload — a
defect P01 §SEC-11 fixes.

**The lesson taken**: allowlist decisions must persist. A per-session allowlist that resets on
reload would reproduce exactly the defect P01 is fixing.

---

## 3. Goals & non-goals

### Goals

1. Users can permit specific tools without opening the source.
2. Approving a tool at a prompt can be made permanent in one action.
3. Decisions persist across reloads and restarts.
4. The existing parsing in `toolUtils.ts` is used, not duplicated.
5. Users can see and revoke what they have permitted.

### Non-goals

- **Changing permission modes.** P01 owns the mode; this is the allowlist within a mode.
- **An audit log of what ran.** P27 — the natural companion.
- **Per-project permission profiles.** `TOOL-05`, deferred pending a persistence decision.
- **Denylists.** Allow-only is simpler and matches the SDK's `allowedTools` field.
- **MCP tool management.** `EXT-03`, deferred.
- **Changing what the CLI does with `allowedTools`.** The SDK owns the semantics.

---

## 4. Personas & user stories

**Marcus — hit prompt fatigue after P01.**

> As a user who now gets approval prompts, I want to permanently allow `Read` and `Grep`, so
> that I am not approving harmless file reads twenty times an hour.

**Devon — wants shell gated, everything else free.**

> As a cautious user, I want everything except `Bash` permitted, so that I only get prompted
> for the thing that actually worries me.

**Priya — approved something and regretted it.**

> As a user, I want to see what I have permitted and revoke it, because I clicked "always
> allow" too quickly.

**Sam — reviewing before a risky session.**

> As a user starting work on an unfamiliar repository, I want to check my allowlist first, so
> that I know what will run without asking.

---

## 5. Functional requirements

### Management surface

- **FR-1** There **MUST** be a UI listing the tools that can be permitted.
- **FR-2** Each **MUST** be individually toggleable.
- **FR-3** Currently permitted tools **MUST** be clearly indicated.
- **FR-4** Revoking **MUST** be possible and **MUST** take effect on the next request.
- **FR-5** There **MUST** be a way to clear the entire allowlist in one action.
- **FR-6** The surface **MUST** be reachable from settings and **SHOULD** be reachable from
  the permission prompt.

### Approval integration

- **FR-7** The approval prompt **MUST** offer "allow once" and "always allow".
- **FR-8** "Always allow" **MUST** add the tool to the persisted allowlist.
- **FR-9** The scope of "always allow" **MUST** be explicit — whether it permits the whole
  tool or only that specific command (§6).
- **FR-10** "Always allow" **MUST NOT** be the default or most prominent action.

### Command granularity

- **FR-11** For `Bash`, allowlisting **MUST** support command-level entries, not only
  whole-tool permission.
- **FR-12** Command parsing **MUST** reuse `frontend/src/utils/toolUtils.ts`.
- **FR-13** The existing `TOOL_CONSTANTS` handling of multi-word commands, compound
  separators, and Bash builtins **MUST** be respected.
- **FR-14** A wildcard entry **MUST** be visually distinguished as broad.

### Persistence

- **FR-15** The allowlist **MUST** persist across reloads and restarts.
- **FR-16** A corrupt persisted allowlist **MUST** fall back to empty, never throw.
- **FR-17** An empty allowlist **MUST** mean "no tools pre-permitted" — i.e. today's
  behaviour, with `allowedTools` omitted entirely.

### Accessibility

- **FR-18** Toggles **MUST** be labelled controls with the tool name in the accessible name.
- **FR-19** Permitted state **MUST NOT** be conveyed by colour alone.
- **FR-20** Changes **MUST** be announced politely.
- **FR-21** The approval prompt's options **MUST** be keyboard-reachable in a sensible order,
  with the safest option first.

---

## 6. UX & interaction specification

### The allowlist surface

Reached from `SettingsModal`, which already exists (`frontend/src/components/SettingsModal.tsx`,
`SettingsButton.tsx`, `settings/GeneralSettings.tsx`) — so this is a new section in an
existing surface, not a new one.

```
┌────────────────────────────────────────────┐
│  Tool permissions                          │
│                                            │
│  Always allowed without asking:            │
│                                            │
│  ☑ Read            Read file contents      │
│  ☑ Grep            Search file contents    │
│  ☑ Glob            Find files by pattern   │
│  ☐ Edit            Modify files            │
│  ☐ Write           Create files            │
│  ☐ Bash            Run shell commands      │
│                                            │
│  Specific commands:                        │
│    Bash(git status)                    ✕   │
│    Bash(npm test)                      ✕   │
│                                            │
│  [ Clear all ]                             │
│                                            │
│  Applies when the permission mode is       │
│  "Ask for approval". Has no effect in      │
│  "No prompts" mode.                        │
└────────────────────────────────────────────┘
```

That last note matters. The allowlist is **only meaningful in `default` mode** — under
`bypassPermissions` everything runs regardless, and under `plan` nothing executes. Showing the
allowlist without explaining its relationship to the mode would leave users believing they had
restricted something they had not.

### The approval prompt

`PermissionInputPanel` already exists and handles per-tool approval. This PRD extends it:

```
┌──────────────────────────────────────────┐
│  Allow Bash?                             │
│                                          │
│    git status                            │
│                                          │
│  [ Allow once ]  [ Always allow… ]  [ Deny ] │
└──────────────────────────────────────────┘
```

**"Allow once" is first and default** (FR-10, FR-21). "Always allow…" carries an ellipsis
because it opens a scope choice (FR-9):

```
  Always allow:
   ○ this command — Bash(git status)
   ○ all Bash commands
```

**The scope choice is the most important interaction in this PRD.** A user who intends to
permit `git status` and instead permits all of `Bash` has granted arbitrary shell execution —
which is precisely what P01 exists to stop happening by default. Making the two visually and
textually distinct, with the narrow option first, is the mitigation.

### States

| State | Behaviour |
| --- | --- |
| Empty allowlist | Section shown with nothing checked; explanatory text |
| Some permitted | Checked entries plus a command list |
| Wildcard present | **Prominently flagged as broad** (FR-14) |
| Mode is `bypassPermissions` | Section visible but marked as not currently in effect |
| Mode is `plan` | Same |
| Corrupt storage | Silently empty (FR-16) |

---

## 7. Technical design

### 7.1 What `allowedTools` accepts

`allowedTools` is passed through to the Agent SDK unchanged
(`backend/handlers/chat.ts:67`). Its accepted entry format — whether `"Bash"`,
`"Bash(git status)"`, or something else — is defined by the SDK, not by this app.

`TOOL_CONSTANTS` strongly implies the parenthesised command form, since it carries
`WILDCARD_COMMAND: "*"` and multi-word command handling that would otherwise be pointless.
And `toolUtils.ts` exists specifically to produce these entries.

**Confirm the exact format against `sdk.d.ts` and `toolUtils.ts` before building the UI**
(§16.1). Generating entries the SDK silently ignores would produce an allowlist that appears
to work and does not — the worst possible failure for a security-adjacent feature.

### 7.2 Reuse `toolUtils.ts`, do not reimplement

FR-12 is a hard requirement. `frontend/src/utils/toolUtils.ts` (139 lines, 171 lines of
tests) already knows how to:

- extract a tool name from a tool-use block
- parse a Bash command into an allowlist entry
- handle multi-word commands (`git status` is one command, not `git` plus an argument)
- split compound commands on `&&`, `||`, `;`, `|`
- recognise the 16 Bash builtins that never need approval

Reimplementing any of this in the settings UI would create two parsers that disagree — and the
one users see would drift from the one that decides.

Its existing test file is also the regression guard for any change made here.

### 7.3 Persistence

FR-15 requires persistence across restarts. Options, consistent with the pattern established
across this pack:

| Option | Assessment |
| --- | --- |
| **`AppSettings` in `localStorage`** | Matches theme, Enter behaviour, and P01's permission mode. Per-browser |
| `~/.claude` sidecar | Machine-scoped, matching P06's recents and P14's auth |

**Recommendation: `AppSettings`.** The allowlist is a client-side preference that shapes what
the client sends, exactly like the permission mode P01 persists there. Keeping them together
means one migration and one mental model.

**Settings-version coordination is now five PRDs wide** — P01, P09, P10, P17 and P24 all add
fields. Whichever lands last extends the same migration rather than writing a parallel one.
This is worth tracking explicitly rather than rediscovering each time.

```ts
export interface AppSettings {
  theme: Theme;
  enterBehavior: EnterBehavior;
  permissionMode: PermissionMode;      // P01
  bypassAcknowledged: boolean;         // P01
  allowedTools: string[];              // P24
  version: number;
}
```

### 7.4 Sending it

The chat request already accepts `allowedTools` (`shared/types.ts:11`) and the backend already
forwards it. **No backend change is required** — which is why this is effort 2.

The frontend must include the persisted list when building a chat request. FR-17 requires that
an empty list omit the field entirely rather than sending `[]`, since
`...(allowedTools ? { allowedTools } : {})` treats an empty array as truthy and would pass it
through — with unknown SDK semantics for "an explicitly empty allowlist".

That is a subtle correctness point and belongs in a test.

### 7.5 Components

| Item | Purpose |
| --- | --- |
| New `frontend/src/components/settings/ToolPermissions.tsx` | The management surface |
| New `frontend/src/hooks/chat/useAllowedTools.ts` | State, persistence, entry construction |
| Modify `frontend/src/components/SettingsModal.tsx` | Add the section |
| Modify `frontend/src/components/chat/PermissionInputPanel.tsx` | "Always allow" with scope |
| Modify chat request construction | Include the list (FR-17 semantics) |

`usePermissions.ts` and `usePermissions.test.ts` already exist in
`frontend/src/hooks/chat/` and handle prompt state — the new hook should sit alongside rather
than absorb them.

### 7.6 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| **Tool/command parsing** | `toolUtils.ts` + tests | `frontend/src/utils/` |
| Tool constants | `TOOL_CONSTANTS` | `frontend/src/utils/constants.ts` |
| Approval prompt | `PermissionInputPanel` | `frontend/src/components/chat/` |
| Prompt state | `usePermissions` | `frontend/src/hooks/chat/` |
| Permission mode | `usePermissionMode` (P01) | `frontend/src/hooks/chat/` |
| Settings surface | `SettingsModal`, `GeneralSettings` | `frontend/src/components/` |
| Settings persistence | `AppSettings`, `useSettings` | `frontend/src/utils/storage.ts` |
| Wire field | `allowedTools` | `shared/types.ts:11` |

---

## 8. Data model & persistence

| Datum | Store | Lifetime |
| --- | --- | --- |
| Allowlist entries | `AppSettings` in `localStorage` | Until cleared |

No database, no backend state, no new file on disk.

**Per-browser, not per-machine.** Consistent with theme and permission mode, and the correct
trade at this size. Per-project allowlists (`TOOL-05`) remain deferred pending the broader
persistence decision that P06 and P14 also touch.

---

## 9. Security implications

This is a security-relevant feature and cuts both ways.

**Improves safety**: it is what makes P01's safe default sustainable. Without it, prompt
fatigue drives users to `bypassPermissions`, which is strictly worse than a considered
allowlist. The realistic comparison is not "allowlist versus prompts for everything" but
"allowlist versus users turning prompts off".

**Reduces safety if the scope choice is wrong**: FR-9 exists because permitting all of `Bash`
when the user meant one command grants arbitrary shell execution permanently. That is the
single highest-consequence mistake available in this UI, and §6's design — narrow option
first, distinct wording, explicit ellipsis — is the mitigation.

**The wildcard is the sharpest edge.** `TOOL_CONSTANTS.WILDCARD_COMMAND` is `"*"`. An entry
containing it is equivalent to permitting the tool outright, and FR-14 requires it be flagged
as such rather than sitting in a list looking like any other entry.

**Persistence is a security property here.** An allowlist that silently reset would be safe;
one that silently *persisted more than the user thought* would not. FR-3's clear indication
and FR-5's clear-all are what keep the granted set visible.

**Not addressed**: the allowlist is client-supplied. A caller hitting `/api/chat` directly can
send any `allowedTools` it likes — the server does not constrain it. That is unchanged by this
PRD and is one more item in the same category as P01 §9's observation that an attacker can
simply request `bypassPermissions`. Only P14 addresses the underlying issue.

---

## 10. Performance & scale

Negligible. A small array in `localStorage`, read once and sent with each request.

The only bound worth having: cap the number of entries at something generous but finite, so a
runaway "always allow" loop cannot grow the settings object without limit.

---

## 11. Telemetry & observability

Server-side, the existing debug logging already records the chat request including
`allowedTools` (`backend/handlers/chat.ts:115-118`), so the effective list is visible under
`--debug` with no change.

No client analytics.

---

## 12. Test plan

### Frontend — Vitest, `make test-frontend`

New `frontend/src/hooks/chat/useAllowedTools.test.ts`:

| Test | Asserts |
| --- | --- |
| Empty by default | FR-17 |
| Adding a tool persists it | FR-8, FR-15 |
| Revoking removes it | FR-4 |
| Clear-all empties the list | FR-5 |
| **Corrupt persisted value falls back to empty without throwing** | FR-16 |
| **Empty list omits `allowedTools` from the request entirely** | **FR-17, §7.4** |
| Entry construction delegates to `toolUtils` | FR-12 |
| Entry count capped | §10 |

New `frontend/src/components/settings/ToolPermissions.test.tsx`:

| Test | Asserts |
| --- | --- |
| Lists permittable tools with labelled toggles | FR-1, FR-2, FR-18 |
| Permitted state not colour-only | FR-19 |
| Command-level entries listed and removable | FR-11, FR-4 |
| **Wildcard entry visually flagged as broad** | **FR-14** |
| Explains that the allowlist applies only in "Ask for approval" mode | §6 |
| Changes announced politely | FR-20 |

Extend `frontend/src/components/chat/PermissionInputPanel.test.tsx`:

| Test | Asserts |
| --- | --- |
| Offers allow-once and always-allow | FR-7 |
| **"Allow once" is first in tab order** | **FR-21** |
| "Always allow" presents an explicit scope choice | FR-9 |
| **Command scope adds only that command, not the whole tool** | **FR-9, §9** |
| Tool scope adds the whole tool | FR-9 |
| Always-allow is not the default action | FR-10 |

Extend `toolUtils.test.ts` coverage if entry construction gains new cases — but **do not
duplicate its parsing tests** in the new files.

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. With P01's `default` mode, run a session → approval prompts appear.
2. "Always allow" a `Read` → subsequent reads do not prompt.
3. Check settings → `Read` shown as permitted.
4. "Always allow" a specific `Bash` command with **command** scope → **only that command**
   stops prompting; a different `Bash` command still prompts. *(The §9 risk.)*
5. Revoke it → prompting resumes.
6. Clear all → everything prompts again.
7. Reload the page → allowlist persists.
8. Switch to `bypassPermissions` → settings section indicates it is not in effect.
9. Corrupt the settings value by hand → app loads, allowlist empty.
10. Confirm under `--debug` that an empty allowlist sends **no** `allowedTools` field.

Checks 4 and 10 are the two most important.

---

## 13. Rollout & migration

- Additive; no backend change; no wire change (the field already exists).
- Settings version bump — **coordinate with P01, P09, P10, P17** (§7.3).
- Existing users start with an empty allowlist, which is exactly today's behaviour (FR-17).
- Minor release.
- **Ship soon after P01**, which is what creates the need (§1).

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **User permits all of `Bash` intending one command** | **Medium** | **High** | FR-9 explicit scope; narrow option first; §6 wording; dedicated test |
| 2 | **Entry format does not match what the SDK accepts** | **Medium** | **High** | §16.1 confirm first; an ignored allowlist looks like it works |
| 3 | Empty array sent instead of omitting the field | Medium | Medium | FR-17; §7.4; explicit test |
| 4 | Parsing duplicated, drifting from `toolUtils.ts` | Medium | **High** | FR-12 hard requirement; reuse enforced by test |
| 5 | Users believe the allowlist restricts `bypassPermissions` | **Medium** | Medium | §6 explanatory text; state shown per mode |
| 6 | Wildcard entry looks ordinary | Medium | **High** | FR-14 prominent flagging |
| 7 | Settings migration collides across five PRDs | Medium | Medium | §7.3 single shared migration |
| 8 | Allowlist grows unboundedly via repeated always-allow | Low | Low | §10 cap |

---

## 15. Acceptance criteria

- [ ] Settings surface lists permittable tools with labelled toggles
- [ ] Permitted state indicated without relying on colour
- [ ] Command-level `Bash` entries supported, listed, and removable
- [ ] **Wildcard entries prominently flagged as broad**
- [ ] Clear-all available
- [ ] Explains that the allowlist applies only in "Ask for approval" mode
- [ ] Approval prompt offers allow-once and always-allow, with allow-once first
- [ ] **Always-allow presents an explicit scope choice; command scope grants only that command**
- [ ] Always-allow is not the default or most prominent action
- [ ] **Parsing reuses `toolUtils.ts`; no second parser**
- [ ] `TOOL_CONSTANTS` multi-word, separator, and builtin handling respected
- [ ] Allowlist persists across reloads and restarts
- [ ] Corrupt storage falls back to empty silently
- [ ] **Empty allowlist omits `allowedTools` from the request**
- [ ] Entry format verified against what the SDK actually accepts
- [ ] No backend change required
- [ ] `make check` passes

---

## 16. Open questions

1. **What entry format does the SDK's `allowedTools` accept?** Blocking. `TOOL_CONSTANTS` and
   `toolUtils.ts` imply `Tool(command)` with a `*` wildcard, but this must be confirmed
   against `sdk.d.ts` — an allowlist the SDK ignores is worse than none, because it looks like
   it works.
2. **What are the semantics of an explicitly empty `allowedTools` array?** FR-17 avoids the
   question by omitting the field, which is the safe choice — but knowing the answer would
   confirm that is right.
3. **Should the allowlist be per-project?** `TOOL-05`, deferred. A user may reasonably trust
   a scratch repo and not a client's. Blocked on the same persistence decision as P06 and
   P14.
4. **Should there be sensible defaults** — `Read`, `Grep`, `Glob` pre-permitted on first run?
   It would blunt P01's prompt fatigue immediately. But it also means shipping a product that
   permits things the user never approved, which sits badly next to P01's whole argument.
   Recommendation: no defaults; make the first-run allowlisting easy instead.
5. **Should P27 (audit log) ship with this?** They pair naturally — the allowlist says what
   may run, the audit log says what did. Considering them together would produce a more
   coherent settings surface.

Question 4 is a genuine product judgement and worth deciding explicitly rather than by
omission.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| **Confirm SDK entry format (§16.1)** | 2 h |
| `useAllowedTools` hook + persistence + migration | 3 h |
| Entry construction via `toolUtils` | 2 h |
| `ToolPermissions` settings section | 4 h |
| `PermissionInputPanel` always-allow + scope choice | 4 h |
| Chat request wiring incl. FR-17 semantics | 1 h |
| Tests | 5 h |
| Manual verification incl. scope-mistake check | 2 h |
| **Total** | **≈23 h — 3 days** |

No backend work at all — the field and its forwarding already exist, which is what keeps this
at effort 2 despite touching a security-sensitive surface.

---

## 18. References

- `shared/types.ts:11` — `allowedTools`, the unreachable field
- `backend/handlers/chat.ts:67` — where it is forwarded to the SDK
- `backend/handlers/chat.ts:115-118` — debug logging that already records it
- `frontend/src/utils/toolUtils.ts` — 139 lines of parsing that must be reused
- `frontend/src/utils/toolUtils.test.ts` — 171 lines of existing coverage
- `frontend/src/utils/constants.ts:23-49` — `TOOL_CONSTANTS`
- `frontend/src/components/chat/PermissionInputPanel.tsx` — the prompt to extend
- `frontend/src/hooks/chat/usePermissions.ts` — existing prompt state
- `frontend/src/components/SettingsModal.tsx`, `settings/GeneralSettings.tsx` — settings surface
- `../03-feature-comparison-matrix.md` — `TOOL-04`, deferred `TOOL-05`
- `../04-uiux-workflow-comparison.md` §3 "Discoverability"
- `P01-safe-permission-defaults-mode-persistence.md` §9 — the prompt-fatigue risk this answers
