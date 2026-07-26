# P27 — Tool Execution Audit Log

| Field | Value |
| --- | --- |
| **Priority** | **P27** of 30 |
| **Score** | **6.8** |
| **Inputs** | Value 3 · Reach 3 · GapWeight ×1.5 · Effort 2 |
| **Category** | Tool Execution, Permissions & Safety |
| **Matrix features** | `TOOL-07` (audit log of executed tools) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui UNVERIFIED |
| **Effort** | **2** |
| **Depends on** | Pairs with **P01** and **P24** |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio runs tools on the user's machine — reading files, writing files, and executing
shell commands — and keeps **no durable record of what it ran.**

The only account is the transcript, and the transcript is a poor audit surface:

- It is per-session, so "what has this app done today" spans many conversations.
- Tool calls are interleaved with prose, so scanning for actions means reading everything.
- It is filtered for readability — `NON_DISPLAYED_SYSTEM_SUBTYPES` and
  `IGNORED_SDK_MESSAGE_TYPES` deliberately remove material.
- Nothing aggregates. A user cannot ask "which commands ran in this project this week?"

This matters more than it would in most applications, because of the default posture. Until
P01, sessions start in `bypassPermissions` — `backend/utils/permissions.ts:29` — meaning
Claude runs every tool including `Bash` **without asking**. `README.md:288` states it plainly:

> Permission prompts are disabled by default: sessions start in `bypassPermissions`, so
> Claude runs every tool — including shell commands via `Bash` — without asking.

So the current state is: arbitrary shell execution, unattended, with no record. A user who
returns to a repository and finds something unexpected has no way to determine whether this
app did it.

### Why it pairs with P01 and P24

These three form a coherent set:

| PRD | Question answered |
| --- | --- |
| **P01** | What *may* run by default? |
| **P24** | What *may* run without asking? |
| **P27** | What *did* run? |

P24 §16.5 already suggests considering them together, and the settings surface P24 builds is
the natural home for this one.

### Why P27 rather than higher

Value 3 — this is retrospective visibility, not capability. Most users will never look. But
the users who do look will be looking because something went wrong, and today they find
nothing.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui's audit capability is **UNVERIFIED** — no audit or history-of-actions route
appeared in its ~28 route groups, and its component modules do not obviously include one.

It may simply not have this. Its safety model is preventive — tools disabled by default, JWT
auth, per-tool opt-in — rather than retrospective.

**This PRD therefore does not rest on parity.** It rests on PDLC Studio's specific situation:
a permissive default (pre-P01), no authentication (pre-P14), and an explicit design intent to
run "unattended against a working directory the user picked"
(`backend/utils/permissions.ts:14-17`). Unattended operation is exactly the case where a
record matters most.

---

## 3. Goals & non-goals

### Goals

1. A durable record of tools executed, across sessions.
2. Enough detail to answer "what did this run?" without re-reading transcripts.
3. Filterable by project, time, and tool.
4. Bounded storage that cannot grow without limit.
5. No database, no new dependency.

### Non-goals

- **Preventing execution.** P01 and P24 do that.
- **A tamper-proof security audit trail.** See §9 — this is operator visibility, not forensics.
- **Recording full file contents** written or read. Sizes and paths only; contents would make
  the log enormous and duplicate the transcript.
- **Cross-machine aggregation or shipping logs anywhere.** Local only.
- **Replacing the transcript.** Complementary.

---

## 4. Personas & user stories

**Devon — found an unexpected change.**

> As a user who found a modified file, I want to see whether this app wrote it and when, so
> that I can tell an agent action from my own.

**Marcus — ran unattended.**

> As a user who left a long task running in `bypassPermissions`, I want to review what
> commands were executed, so that I know what happened while I was away.

**Priya — deciding what to allowlist.**

> As a user configuring P24's allowlist, I want to see which tools I actually use, so that I
> permit the right ones rather than guessing.

**Sam — reporting a problem.**

> As someone filing a bug, I want a record of the commands that ran, so that the report is
> concrete.

Priya's story is the one that makes this genuinely useful rather than merely reassuring — an
audit log is the evidence base for a sensible allowlist.

---

## 5. Functional requirements

### Capture

- **FR-1** Every tool invocation **MUST** be recorded.
- **FR-2** Each entry **MUST** carry timestamp, tool name, project, and session id.
- **FR-3** For `Bash`, the command **MUST** be recorded.
- **FR-4** For file tools, the path **MUST** be recorded.
- **FR-5** Outcome — success or failure — **SHOULD** be recorded where determinable.
- **FR-6** Recording **MUST NOT** block or delay execution.
- **FR-7** Failure to record **MUST NOT** fail the request.
- **FR-8** Tool **inputs** beyond command and path, and tool **results**, **MUST NOT** be
  recorded in full.

### Storage

- **FR-9** The log **MUST** persist across restarts.
- **FR-10** It **MUST** be bounded, by entry count or age.
- **FR-11** Rotation or pruning **MUST** be automatic.
- **FR-12** A corrupt log **MUST** degrade to empty, never break the app.
- **FR-13** The user **MUST** be able to clear it.

### Viewing

- **FR-14** There **MUST** be a UI listing recorded entries, newest first.
- **FR-15** Filtering by tool **MUST** be available.
- **FR-16** Filtering by project **SHOULD** be available.
- **FR-17** Each entry **MUST** be traceable to its session.
- **FR-18** An empty log **MUST** show an explanatory state.

### Accessibility

- **FR-19** The list **MUST** be a semantic table or list with headers.
- **FR-20** Outcome **MUST NOT** be conveyed by colour alone.
- **FR-21** Filters **MUST** be labelled and keyboard-operable.
- **FR-22** Result counts **MUST** be announced politely.

---

## 6. UX & interaction specification

### Placement

A section in `SettingsModal`, alongside P24's tool permissions. The two belong together —
"what may run" and "what did run" are the same mental model — and P24 §16.5 anticipates this.

```
┌──────────────────────────────────────────────┐
│  Activity                                    │
│                                              │
│  Tool: [ All ▾ ]   Project: [ All ▾ ]        │
│                                              │
│  Today                                       │
│   14:32  Bash    npm test              ✓     │
│          my-project · session 3f2a…          │
│   14:31  Edit    src/auth/session.ts   ✓     │
│   14:28  Read    src/auth/session.ts   ✓     │
│                                              │
│  Yesterday                                   │
│   09:14  Bash    git status            ✓     │
│                                              │
│  Showing 40 of 500 · [ Clear log ]           │
└──────────────────────────────────────────────┘
```

- Grouped by day, newest first.
- `Bash` entries show the command — the detail that matters most.
- Outcome shown as a symbol **and** conveyed textually to assistive technology (FR-20).
- Session id links back to the conversation (FR-17).

### What is deliberately not shown

FR-8 excludes full tool inputs and results. A `Write` entry records that a file was written
and its path — **not** its contents. Reasons:

- Contents would make the log enormous, defeating FR-10's bound.
- It would duplicate the transcript, which already has them.
- It would turn the log into a second copy of the user's source code in a JSON file, which is
  a worse privacy position than the transcript already is.

The log answers "what happened"; the transcript answers "what exactly".

---

## 7. Technical design

### 7.1 Where to capture

The clean interception point is the backend's stream loop. `executeClaudeCommand`
(`backend/handlers/chat.ts:50-79`) iterates every SDK message and yields it to the client:

```ts
for await (const sdkMessage of query({ … })) {
  logger.chat.debug("Claude SDK Message: {sdkMessage}", { sdkMessage });
  yield { type: "claude_json", data: sdkMessage };
}
```

Tool invocations arrive as `tool_use` content blocks on assistant messages. Recording there
means:

- **Server-side**, so it is not lost when a browser tab closes.
- **Complete**, covering everything that ran regardless of what the UI displays — important,
  because the frontend's two filter blocklists deliberately drop material.
- **One place**, rather than reconstructing from client state.

FR-6/FR-7 require it be fire-and-forget: buffer in memory, flush asynchronously, and never let
a write failure interrupt the stream.

### 7.2 Extracting tool details

Per `CLAUDE.md`, a `tool_use` block's `input` is typed `unknown`, and assistant payloads use
the Anthropic `Beta*` types. So extraction must narrow rather than assume — the same
discipline `frontend/src/utils/toolUtils.ts` applies client-side.

Note the asymmetry: **`toolUtils.ts` is frontend-only.** This capture point is backend, so
either the narrow extraction it needs is written afresh in `backend/`, or the shared logic
moves to `shared/`.

**Recommendation: a small, purpose-built extractor in `backend/audit/`.** Only tool name plus
command-or-path is needed (FR-3, FR-4) — far less than `toolUtils.ts` does. Moving that module
to `shared/` for this would be a large refactor of well-tested code for a small gain, and P24
depends on it staying where it is.

Outcome (FR-5) comes from the corresponding `tool_result`, which arrives as a later message
and may carry an error flag. Correlating by `tool_use_id` is straightforward but must handle
the case where no result arrives — an aborted request leaves invocations unresolved, which
should record as "unknown" rather than "success".

### 7.3 Storage

No database. A **JSON Lines file** under `~/.claude`:

```
~/.claude/pdlc-studio-activity.jsonl
```

JSONL rather than JSON, deliberately:

- **Append-only writes** — no read-modify-write of a growing array, which is both slow and a
  corruption risk if interrupted.
- A truncated final line loses one entry, not the whole file (FR-12).
- Rotation is a matter of dropping leading lines.

```jsonc
{"ts":"2026-07-26T14:32:11Z","tool":"Bash","detail":"npm test","project":"/Users/me/code/my-project","session":"3f2a…","outcome":"ok"}
```

**This is the fourth `~/.claude/pdlc-studio-*` file** across the pack — P06 recents, P14 auth
and sessions, P26 conversations. The shared sidecar helper P14 §7.3 calls for should cover
this too, though JSONL append needs a different write path from the JSON read-modify-write the
others use.

**Bounding** (FR-10, FR-11): cap by entry count (say 5,000) and by age (say 30 days),
whichever bites first. Prune on startup and periodically, not on every append.

### 7.4 Endpoints

```
GET    /api/activity?tool=&project=&limit=&before=
DELETE /api/activity
```

Under `/api/activity`, **not** `/api/projects/...`, because the log spans projects (FR-16) —
and it sidesteps the route-ordering constraint that P06, P08, P15, P20, P22 and P26 all have
to reason about.

### 7.5 Components

| Item | Purpose |
| --- | --- |
| New `backend/audit/recorder.ts` | Buffer, extract, append, prune |
| New `backend/audit/extract.ts` | `tool_use` narrowing (§7.2) |
| New `backend/handlers/activity.ts` | Read and clear endpoints |
| New `frontend/src/components/settings/ActivityLog.tsx` | The list |
| New `frontend/src/hooks/useActivityLog.ts` | Fetch, filter, clear |
| Modify `backend/handlers/chat.ts` | Call the recorder in the stream loop |

The `chat.ts` change must be minimal — one call inside the existing loop, wrapped so it cannot
throw into the stream (FR-7).

### 7.6 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Stream interception point | `executeClaudeCommand` loop | `backend/handlers/chat.ts:71-79` |
| Structured logging | `logger` | `backend/utils/logger.ts` |
| Home directory | `getHomeDir()` | `backend/utils/os.ts` |
| Sidecar helper | Shared with P06, P14, P26 | `backend/utils/sidecar.ts` |
| Settings surface | `SettingsModal` + P24's section | `frontend/src/components/` |
| Session linkage | `HistoryView` routing | `frontend/src/components/` |

---

## 8. Data model & persistence

| Datum | Store | Lifetime |
| --- | --- | --- |
| Activity entries | `~/.claude/pdlc-studio-activity.jsonl` | Until pruned or cleared |
| In-flight buffer | Server memory | Until flushed |

No database. Bounded by construction (§7.3).

**A buffered write means entries can be lost** if the process is killed between append
intervals. That is an acceptable trade for FR-6's non-blocking requirement, and it is a reason
§9 is explicit that this is not forensic-grade.

---

## 9. Security implications

**This PRD must not oversell itself**, and that is the most important thing in this section.

**It is operator visibility, not a security control.** Specifically:

- **Not tamper-proof.** The file lives in the user's home directory with user permissions.
  Anything that can run as the user — including Claude itself, via `Bash` — can edit or delete
  it. An audit log that the audited party can rewrite is not evidence.
- **Not complete.** Buffered writes can lose entries on an abrupt exit (§8).
- **Not authenticated.** Until P14, `GET /api/activity` is readable and
  `DELETE /api/activity` is callable by anyone who can reach the port. That is a further
  destructive unauthenticated endpoint, in the same category as P26 §9's deletion.

Presenting it as a security feature would be worse than not having it, because a user might
rely on it. The UI copy should describe it as "Activity" — a record of what ran — not as an
"audit log" implying assurance. **The PRD title uses "audit log"; the product should not.**

**Genuine benefits**, honestly stated:

- Answers "did this app touch that file?" in the common, non-adversarial case.
- Provides the evidence base for a sensible P24 allowlist (Priya's story).
- Makes unattended `bypassPermissions` operation reviewable after the fact.

**Privacy**: the log records commands and paths, which can themselves be sensitive — a
`Bash` command may contain an argument the user considers private. FR-8's exclusion of full
inputs and results limits this, and FR-13's clear function is the user's control.

---

## 10. Performance & scale

- **Recording must not slow the stream** (FR-6). Buffer in memory; flush on an interval or at
  a size threshold, never per message.
- Appending to JSONL is cheap; the file never needs full rewriting except on prune.
- Pruning rewrites the file and should happen on startup or on a long interval, not inline.
- The read endpoint should paginate — a 5,000-entry log must not be returned whole.
- The frontend renders a bounded page with filters applied server-side.

---

## 11. Telemetry & observability

This PRD *is* observability, but for the user rather than the operator.

Server-side, via `backend/utils/logger.ts`:

- `logger.api.warn` when a write or prune fails — recorded, never fatal (FR-7).
- `logger.api.info` on clear (FR-13), since clearing destroys the record.

Note the existing `logger.chat.debug` already logs full SDK messages under `--debug`
(`backend/handlers/chat.ts:73`), which is a superset of this data but ephemeral and
operator-facing. This PRD is the durable, user-facing subset.

---

## 12. Test plan

### Backend — `make test-backend`

New `backend/audit/extract.test.ts`:

| Test | Asserts |
| --- | --- |
| `Bash` tool_use yields the command | FR-3 |
| File tool yields the path | FR-4 |
| Unknown tool shape yields a name with no detail, no throw | §7.2 |
| **Full inputs and results are not captured** | **FR-8** |
| `tool_result` correlates by id to set outcome | FR-5 |
| Missing result records outcome as unknown, not success | §7.2 |

New `backend/audit/recorder.test.ts`:

| Test | Asserts |
| --- | --- |
| Entries appended as valid JSONL | §7.3 |
| **Write failure does not propagate to the caller** | **FR-7** |
| Buffer flushes on threshold | FR-6 |
| Pruning by count works | FR-10, FR-11 |
| Pruning by age works | FR-10, FR-11 |
| **Truncated final line does not break reading** | **FR-12** |
| Corrupt file degrades to empty | FR-12 |

New `backend/handlers/activity.test.ts`:

| Test | Asserts |
| --- | --- |
| Returns entries newest first | FR-14 |
| Filters by tool and project | FR-15, FR-16 |
| Paginates | §10 |
| Clear empties the log and is logged | FR-13, §11 |

Extend `backend/handlers/chat.test.ts`:

| Test | Asserts |
| --- | --- |
| Tool invocations during a stream are recorded | FR-1 |
| **A recorder throwing does not interrupt the stream** | **FR-7** |

### Frontend — `make test-frontend`

New `frontend/src/components/settings/ActivityLog.test.tsx`:

| Test | Asserts |
| --- | --- |
| Entries listed newest first, grouped by day | FR-14 |
| Semantic table/list with headers | FR-19 |
| Outcome conveyed textually, not colour alone | FR-20 |
| Filters labelled and keyboard-operable | FR-21 |
| Session link navigates to the conversation | FR-17 |
| Empty state explains the log | FR-18 |
| Counts announced politely | FR-22 |
| Clear requires confirmation | FR-13 |

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Run a session with several tool calls → all appear.
2. Run a `Bash` command → the command text is recorded.
3. Confirm **no file contents** appear anywhere in the JSONL.
4. Abort mid-request → invocations recorded with unknown outcome, no crash.
5. Make the log file unwritable → sessions still work normally.
6. Truncate the file mid-line → UI loads, no error.
7. Generate more than the cap → oldest pruned.
8. Filter by tool and by project.
9. Clear → empty state; confirm the file is emptied.
10. Confirm streaming performance is unchanged with recording active.

Checks 3 and 5 are the two that matter most.

---

## 13. Rollout & migration

- Additive. New file created on first tool use; absence is the normal starting state.
- New endpoints outside the `/api/projects` tree, so no route-ordering concern.
- No migration.
- Minor release.
- **Ship with or after P24**, so the settings surface is coherent (§6).

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Presented as a security guarantee it cannot provide** | **Medium** | **High** | §9 — call it "Activity", not "audit"; state limits in the UI |
| 2 | Recording slows or breaks the stream | Medium | **High** | FR-6 buffered, FR-7 non-propagating; explicit test |
| 3 | Log grows without bound | Medium | Medium | FR-10/FR-11 dual cap; tests |
| 4 | Full file contents captured, bloating and duplicating | Medium | Medium | FR-8; explicit test |
| 5 | **Unauthenticated `DELETE /api/activity`** | **Certain** | Medium | §9 acknowledged; argues for P14 |
| 6 | Corrupt or truncated file breaks the app | Low | High | FR-12; JSONL chosen for this reason |
| 7 | Entries lost on abrupt exit | Medium | Low | §8 accepted trade; stated in §9 |
| 8 | Fourth sidecar file with divergent semantics | Medium | Low | §7.3 shared helper |
| 9 | Command text in the log is itself sensitive | Medium | Medium | FR-8 limits scope; FR-13 clear function |

---

## 15. Acceptance criteria

- [ ] Every tool invocation recorded with timestamp, tool, project, session
- [ ] `Bash` commands and file paths captured
- [ ] Outcome recorded where determinable; unknown where not
- [ ] **Full tool inputs and results are never recorded**
- [ ] Recording is non-blocking and cannot fail a request
- [ ] Log persists across restarts, bounded by count and age, pruned automatically
- [ ] Truncated or corrupt log degrades to empty without breaking the app
- [ ] User can clear the log, with confirmation, and clearing is logged
- [ ] UI lists entries newest first, grouped by day, with tool and project filters
- [ ] Entries link back to their session
- [ ] Outcome conveyed textually, not by colour alone
- [ ] Empty state explains what the log is
- [ ] **UI copy does not claim tamper-resistance or completeness**
- [ ] Endpoints outside `/api/projects`
- [ ] `make check` passes under both runtimes

---

## 16. Open questions

1. **Should the log live per-project instead of globally?** A global log answers "what has this
   app done"; per-project logs are easier to reason about and prune. FR-16's filter gives most
   of the benefit of both. Global is recommended.
2. **Should tool *results* be recorded in summary** — exit code, bytes written, error message?
   More useful for debugging; more surface for the privacy concern in §9. A short truncated
   error string is probably the right middle ground.
3. **Should the log record denied/prompted tools too**, not just executed ones? Knowing what
   Claude *tried* to do is arguably more interesting than what it succeeded at, especially for
   allowlist tuning. Worth including — the data is available at the same interception point.
4. **Should there be an export?** P26 builds transcript export; the same pattern would apply
   and would make Sam's bug-report story much better. Cheap once P26 exists.
5. **Is "Activity" the right name?** §9 argues against "audit log" in the product. Alternatives:
   "Activity", "Tool history", "What ran". Recommendation: "Activity".

Question 3 is the most valuable addition and costs almost nothing.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| `tool_use` extraction and narrowing | 3 h |
| Recorder: buffer, append, flush, prune | 5 h |
| `chat.ts` interception (minimal, non-throwing) | 1.5 h |
| Activity endpoints with filtering and pagination | 3 h |
| `useActivityLog` hook | 2 h |
| `ActivityLog` settings section | 4 h |
| Backend tests | 5 h |
| Frontend tests | 3 h |
| Manual verification | 1.5 h |
| **Total** | **≈28 h — 3.5–4 days** |

Slightly above effort 2's nominal range. The recorder's robustness requirements — never block,
never throw, survive truncation — are where the time goes, and they are not compressible.

---

## 18. References

- `backend/handlers/chat.ts:50-79` — the stream loop and interception point
- `backend/handlers/chat.ts:73` — existing ephemeral debug logging of SDK messages
- `backend/utils/permissions.ts:14-17, 29` — the unattended-execution design intent and default
- `backend/utils/logger.ts` — structured logging
- `backend/utils/os.ts` — `getHomeDir()`
- `frontend/src/utils/toolUtils.ts` — frontend-only parsing, deliberately not reused (§7.2)
- `frontend/src/components/SettingsModal.tsx` — the surface this extends
- `README.md:288` — the documented default this PRD makes reviewable
- `CLAUDE.md` § "Assistant payloads use the Anthropic API `Beta*` types" — `tool_use.input` is `unknown`
- `../03-feature-comparison-matrix.md` — `TOOL-07`
- `P01-safe-permission-defaults-mode-persistence.md` — what may run by default
- `P24-tool-allowlist-ui.md` §16.5 — the suggestion to consider these together
- `P26-session-rename-star-delete-export.md` §9 — the parallel unauthenticated-deletion concern
