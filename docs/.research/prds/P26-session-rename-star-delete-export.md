# P26 — Session Rename, Star, Delete & Export

| Field | Value |
| --- | --- |
| **Priority** | **P26** of 30 |
| **Score** | **6.8** |
| **Inputs** | Value 3 · Reach 3 · GapWeight ×1.5 · Effort 2 |
| **Category** | Session & Conversation Management |
| **Matrix features** | `SESS-09` (rename / star / delete), `SESS-10` (export transcript) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui UNVERIFIED |
| **Effort** | **2** |
| **Depends on** | Nothing. Complements P08 (search) |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

Conversations in PDLC Studio are anonymous, unmanageable, and trapped.

`HistoryView` lists sessions with `sessionId`, timestamps, message count, and a
`lastMessagePreview` truncated to 50 characters
(`MESSAGE_CONSTANTS.SUMMARY_MAX_LENGTH`, `frontend/src/utils/constants.ts:18`). That is the
entire identity of a conversation. Session ids are displayed at 8 characters
(`SESSION_ID_DISPLAY_LENGTH`), which is unique but meaningless.

A user cannot:

- **Name** a conversation, so an important one is indistinguishable from a throwaway
- **Mark** one as worth keeping
- **Delete** an experiment they do not want cluttering the list
- **Export** a transcript to share, archive, or attach to an issue

P08 addresses finding a conversation by content. This PRD addresses the complementary problem:
**curating** them. A user with 300 sessions benefits from search; a user who knows which five
matter benefits more from being able to say so.

### The export half is separately motivated

Export is arguably the more valuable of the two. A useful debugging session — where an agent
worked out a tricky problem — is currently locked inside `~/.claude`'s JSONL files in a format
nobody would paste into an issue. The user's only option is manual selection and copying from
a scrolling transcript.

The matrix scores it as very cheap: *"Pure client-side; very cheap."*

### Why P26 rather than higher

Value 3 and reach 3 — this is quality-of-life, not capability. Nothing is impossible without
it. It ranks in the last third accordingly.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui's session-management UI is **UNVERIFIED**. What is verified is that it persists
sessions in a **SQLite `session` table** with `id`, `provider`, `provider_session_id`,
`jsonl_path`, and token columns — a schema that makes attaching a name, a flag, or a deletion
marker trivial.

It also depends on **`jszip ^3.10.1`**, which plausibly serves export or download.

**PDLC Studio has no database** and `SESS-04` is explicitly rejected
(`06-prioritization-and-roadmap.md` §4). So the metadata half of this PRD needs a different
mechanism — §7.2 — and the export half needs no server at all.

---

## 3. Goals & non-goals

### Goals

1. Give a conversation a human-readable name.
2. Mark conversations worth keeping.
3. Remove conversations no longer wanted.
4. Export a transcript in a shareable format.
5. Add no database.

### Non-goals

- **Conversation search.** P08.
- **Folders, tags, or hierarchical organisation.** Over-structuring for the scale involved.
- **Cross-project session views.** `SESS-11`, deferred.
- **Editing transcript content.** Read-only.
- **Sharing to an external service.** Export produces a file; what the user does with it is
  theirs.
- **Automatic naming via the model.** See §16.4 — attractive, but a separate decision.

---

## 4. Personas & user stories

**Marcus — one session mattered.**

> As a user, I want to name the session where I solved the auth bug, so that I can find it
> again among fifty others.

**Priya — experimenting.**

> As a user who ran six throwaway sessions today, I want to delete them, so that my history
> reflects work rather than noise.

**Devon — filing a bug report.**

> As a user, I want to export a transcript, so that I can attach it to an issue instead of
> screenshotting a scrolling window.

**Sam — archiving.**

> As a user, I want a copy of an important session outside `~/.claude`, so that it survives me
> clearing state.

---

## 5. Functional requirements

### Naming

- **FR-1** A conversation **MUST** be nameable.
- **FR-2** The name **MUST** be shown in `HistoryView` in place of, or alongside, the preview.
- **FR-3** Renaming **MUST** be possible from the history list and from within a conversation.
- **FR-4** An empty name **MUST** revert to the default preview-based display, not show blank.
- **FR-5** Names **MUST** persist across restarts.

### Starring

- **FR-6** A conversation **MUST** be markable as starred.
- **FR-7** Starred conversations **MUST** be visually distinguished.
- **FR-8** Starred conversations **SHOULD** be filterable or sorted first.

### Deletion

- **FR-9** A conversation **MUST** be deletable from the UI.
- **FR-10** Deletion **MUST** require confirmation.
- **FR-11** The confirmation **MUST** state plainly what is removed and whether it is
  recoverable.
- **FR-12** Deletion **MUST NOT** be possible for the currently active conversation without an
  explicit additional warning.

### Export

- **FR-13** A conversation **MUST** be exportable.
- **FR-14** Markdown **MUST** be a supported format.
- **FR-15** Raw JSON **SHOULD** be supported.
- **FR-16** Export **MUST** include user messages, assistant responses, and timestamps.
- **FR-17** Tool calls **SHOULD** be included, in a readable form.
- **FR-18** The exported file **MUST** have a meaningful filename derived from the name or
  date.
- **FR-19** Export **MUST** work entirely client-side where the conversation is already
  loaded.

### Safety & robustness

- **FR-20** Metadata operations **MUST NOT** modify Claude Code's own JSONL transcripts.
- **FR-21** A corrupt metadata store **MUST** degrade to unnamed, unstarred behaviour.
- **FR-22** Metadata for a conversation that no longer exists **MUST** be ignored and pruned.

### Accessibility

- **FR-23** All controls **MUST** be keyboard-reachable and labelled.
- **FR-24** Starred state **MUST NOT** be conveyed by colour or icon shape alone.
- **FR-25** The delete confirmation **MUST** trap focus and default to cancel.
- **FR-26** Rename **MUST** be operable without a pointer.

---

## 6. UX & interaction specification

```
┌──────────────────────────────────────────────┐
│  Conversations              ☆ Starred only   │
│                                              │
│  ★ Auth token expiry fix              ⋯      │
│    3 days ago · 42 messages                  │
│                                              │
│  ☆ …why does the websocket not reconnect…    │
│    2 weeks ago · 17 messages           ⋯     │
└──────────────────────────────────────────────┘
```

- Named conversations show their name; unnamed ones keep today's preview (FR-4).
- The star is a toggle; starred state carries a text label for assistive technology (FR-24).
- `⋯` opens rename / export / delete.

### Deletion — the consequential interaction

**Deletion is destructive and, without a database, irreversible.** FR-11 requires the
confirmation say so plainly:

```
┌────────────────────────────────────────┐
│  Delete this conversation?             │
│                                        │
│  "Auth token expiry fix"               │
│  42 messages · 3 days ago              │
│                                        │
│  This removes the transcript from disk.│
│  It cannot be undone.                  │
│                                        │
│         [ Cancel ]      [ Delete ]     │
└────────────────────────────────────────┘
```

Cancel is the default and receives focus (FR-25).

**§16.1 raises whether deletion should remove the JSONL at all** — an important open question,
because it is the difference between "hide from this UI" and "destroy the user's data".

### Export

Markdown, because it is readable, pasteable into an issue, and diffable:

```markdown
# Auth token expiry fix

**Project:** ~/code/my-project
**Started:** 2026-07-23 14:22
**Messages:** 42

---

### User · 14:22

Why does the session token not expire?

### Assistant · 14:22

Looking at the session handler…

<details><summary>Read — src/auth/session.ts</summary>

…tool detail…

</details>
```

Tool calls in `<details>` (FR-17) keeps them available without drowning the conversation —
the same instinct behind `CollapsibleDetails` in the app itself.

### States

| State | Behaviour |
| --- | --- |
| Unnamed | Preview shown as today |
| Named | Name shown; preview secondary |
| Renaming | Inline input, `Enter` commits, `Escape` cancels |
| Starred filter on | Only starred shown; clear affordance to reset |
| Deleting | Confirmation, cancel focused |
| Deleted | Removed from list, announced |
| Export in progress | Brief indicator; large transcripts are not instant |
| Metadata unavailable | Everything works, nothing is named or starred (FR-21) |

---

## 7. Technical design

### 7.1 Two halves, two mechanisms

**Export is pure client-side** (FR-19). The conversation is already loaded via
`GET /api/projects/:encoded/histories/:sessionId`, so export is a transform plus a download.
No endpoint, no dependency — `Blob` and an object URL are sufficient. **`jszip` is not needed**
for a single file.

**Metadata needs persistence**, and there is no database.

### 7.2 Metadata storage

| Option | Assessment |
| --- | --- |
| `localStorage` | Zero backend work. But per-browser — a session named in Chrome is unnamed in Safari, which is confusing for something that describes machine state |
| **`~/.claude` sidecar** | Machine-scoped, matching P06's recents and P14's auth files |

**Recommendation: a sidecar**, `~/.claude/pdlc-studio-sessions.json`:

```json
{
  "version": 1,
  "sessions": {
    "<sessionId>": { "name": "Auth token expiry fix", "starred": true }
  }
}
```

**P06 and P14 both propose `~/.claude/pdlc-studio-*.json` files**, and P14 §7.3 already calls
for a **shared, tested helper** for reading and writing them with consistent failure
semantics. This PRD is the third consumer and should use it rather than write a third variant.

Note the name collision risk: P14 proposes `pdlc-studio-sessions.json` for *auth* sessions.
These are different things and **must not share a filename** — this one should be
`pdlc-studio-conversations.json` to avoid a genuinely confusing clash.

FR-21 and FR-22: read in a `try`, fall back to empty, prune entries whose session no longer
exists on write.

### 7.3 Deletion

Deleting a conversation means deleting its JSONL file under `~/.claude`, which is **Claude
Code's data, not ours**.

That is a meaningful step. FR-20 forbids *modifying* those files for metadata purposes; this
requirement is about *removing* one at explicit user request, which is different — but it
deserves care:

- Delete only the specific session file, resolved from the encoded project name and session id
  via `backend/history/pathUtils.ts`.
- Use the same containment discipline as everywhere else — resolve fully and verify the target
  is inside the expected history directory before unlinking. **A path bug here deletes the
  wrong file.**
- Prune the metadata entry in the same operation.

§16.1 asks whether this should instead be a soft hide.

### 7.4 Endpoints

```
GET    /api/projects/:encodedProjectName/histories/metadata
PUT    /api/projects/:encodedProjectName/histories/:sessionId/metadata
DELETE /api/projects/:encodedProjectName/histories/:sessionId
```

> **Route ordering.** `metadata` is a literal segment under `histories` and **must register
> before** `/histories/:sessionId`, or it will be captured as a session id — exactly the
> hazard P08 §7.2 flags for `/histories/search`. Two literals now sit under this path, so the
> ordering rule needs stating once in the route file rather than rediscovered per PRD.

### 7.5 Export implementation

`frontend/src/utils/messageConversion.ts` (248 lines) and `contentUtils.ts` (116 lines)
already convert SDK messages into display form. Export is a third rendering of the same data
and should reuse them rather than re-narrow the SDK types.

Per `CLAUDE.md`, assistant content is `BetaMessage` blocks and user content may be a plain
string or a block array — the same narrowing rules apply, and reusing existing helpers is how
to avoid getting them wrong a third time.

Filename (FR-18): slugified name, or date plus short session id when unnamed.

### 7.6 Components

| Item | Purpose |
| --- | --- |
| New `frontend/src/utils/exportConversation.ts` | Markdown and JSON serialisation |
| New `frontend/src/hooks/useConversationMetadata.ts` | Fetch, update, optimistic state |
| New `frontend/src/components/history/ConversationActions.tsx` | Rename / star / export / delete |
| New `backend/handlers/historyMetadata.ts` | Metadata and delete endpoints |
| Modify `frontend/src/components/HistoryView.tsx` | Names, stars, filter, actions |

### 7.7 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| **Sidecar read/write helper** | Shared with P06 and P14 | `backend/utils/sidecar.ts` |
| Message conversion | `messageConversion.ts`, `contentUtils.ts` | `frontend/src/utils/` |
| History loading | `useHistoryLoader` | `frontend/src/hooks/` |
| Session path resolution | `pathUtils.ts` | `backend/history/` |
| Dialog primitive | as used by `NewProjectDialog` | `frontend/src/components/` |
| Copy control | `CopyButton` (P03) | `frontend/src/components/chat/` |

---

## 8. Data model & persistence

| Datum | Store | Lifetime |
| --- | --- | --- |
| Conversation name, starred | `~/.claude/pdlc-studio-conversations.json` | Until deleted |
| Exported file | User's filesystem, via download | User-controlled |
| Transcript itself | Claude Code's JSONL — **not ours** | Until deleted |

No database. The sidecar is small, bounded by the number of conversations the user has
annotated, and pruned on write.

---

## 9. Security implications

**Deletion is the one genuinely risky operation in this PRD**, and the risk is a path bug.

| Threat | Mitigation |
| --- | --- |
| **Deleting the wrong file via a crafted session id** | §7.3 — resolve fully, verify containment within the expected history directory, then unlink. Same discipline as `resolveWithinRoot` (P07 §7.3) |
| Session id used to traverse | Reject any id that is not a plain identifier; do not interpolate into a path unchecked |
| **Unauthenticated deletion** | Until P14, anyone reaching the port can delete conversation history. This PRD adds a **destructive** unauthenticated endpoint |
| Metadata corrupting Claude Code state | FR-20 — metadata lives in a separate file; Claude's own files are never written |
| Exported file contains sensitive content | Inherent — the transcript is the user's data and they chose to export it. Worth noting export includes tool output, which may contain file contents |

The unauthenticated-deletion row deserves emphasis. Earlier PRDs added unauthenticated
**reads** (P07, P25) and **writes** (P15). This is the first that can **destroy user data**
without authentication. It is bounded — one conversation at a time, requiring a specific
session id — but it is a category change, and it is a further argument for sequencing P14
before the later milestones.

---

## 10. Performance & scale

- Metadata file is small; read once and cache.
- Export of a very long conversation builds a large string client-side. Bound it, or stream
  into a `Blob` in chunks rather than concatenating a single huge string.
- Deletion is one `unlink`.
- The starred filter operates on an already-loaded list.

---

## 11. Telemetry & observability

Via `backend/utils/logger.ts`:

- `logger.api.warn` on unreadable or corrupt metadata before falling back.
- **`logger.api.info` on every deletion, recording the session id.** Deletion is
  irreversible; a log line is the only forensic trace if something goes wrong.

No client analytics.

---

## 12. Test plan

### Backend — `make test-backend`

New `backend/handlers/historyMetadata.test.ts`:

| Test | Asserts |
| --- | --- |
| Metadata read returns names and starred flags | FR-1, FR-6 |
| Update persists and survives a reload | FR-5 |
| **Corrupt metadata falls back to empty without throwing** | FR-21 |
| Entries for missing sessions pruned | FR-22 |
| **Claude Code's JSONL never written for metadata** | FR-20 |
| Deletion removes the correct file | FR-9 |
| **Session id containing `../` rejected** | §9 |
| **Deletion cannot escape the history directory** | §9 |
| Deletion prunes the metadata entry | §7.3 |
| **`/histories/metadata` not captured as a session id** | §7.4 |

### Frontend — `make test-frontend`

New `frontend/src/utils/exportConversation.test.ts`:

| Test | Asserts |
| --- | --- |
| Markdown includes user and assistant messages with timestamps | FR-16 |
| Tool calls rendered in a collapsed form | FR-17 |
| JSON export is valid and round-trippable | FR-15 |
| Filename derived from name, or date when unnamed | FR-18 |
| **User content as a plain string handled** | §7.5 |
| **User content as a block array handled** | §7.5 |
| Empty conversation exports without throwing | Boundary |

New `frontend/src/components/history/ConversationActions.test.tsx`:

| Test | Asserts |
| --- | --- |
| Rename commits on `Enter`, cancels on `Escape` | FR-3, FR-26 |
| Empty name reverts to preview display | FR-4 |
| Star toggles with a text label, not icon alone | FR-6, FR-24 |
| **Delete confirmation focuses Cancel** | FR-25 |
| Confirmation states irreversibility | FR-11 |
| Deleting the active conversation warns additionally | FR-12 |
| All controls keyboard-reachable and labelled | FR-23 |

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Name a conversation → appears in the list; persists across restart.
2. Clear the name → reverts to preview.
3. Star and filter → only starred shown.
4. Export as Markdown → paste into an issue; readable, tool calls collapsed.
5. Export as JSON → valid.
6. Delete a conversation → confirmation states irreversibility; file gone from `~/.claude`.
7. Attempt deletion of the active conversation → extra warning.
8. Corrupt the metadata file → app loads, nothing named, no error.
9. `curl` a delete with `../` in the session id → rejected.
10. Confirm Claude Code still reads its own history normally afterwards.

Check 10 matters: if this PRD corrupts the directory Claude Code owns, the damage extends
beyond this app.

---

## 13. Rollout & migration

- Additive. New sidecar created on first use; absence is the normal starting state.
- New endpoints; route ordering must be correct (§7.4).
- No migration.
- Minor release.
- **Uses the shared sidecar helper** from P06/P14 (§7.2); if neither has landed, this PRD
  writes it.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Deletion removes the wrong file** | Low | **Critical** | §7.3 containment verification; two explicit tests; deletion logged |
| 2 | **Unauthenticated destructive endpoint** | **Certain** | Medium | §9 — acknowledged; argues for P14 before this milestone |
| 3 | Filename clash with P14's auth sessions file | **Medium** | Medium | §7.2 — name it `pdlc-studio-conversations.json` |
| 4 | Route captured as a session id | Medium | Medium | §7.4; test; state the rule once in the route file |
| 5 | Export mishandles a message shape | Medium | Medium | §7.5 reuse existing conversion; both content-shape tests |
| 6 | Large export builds a huge string | Low | Medium | §10 chunked `Blob` |
| 7 | Corrupt metadata breaks history browsing | Low | High | FR-21; explicit test |
| 8 | Users expect deletion to be undoable | Medium | Medium | FR-11 explicit wording; §16.1 soft-delete option |
| 9 | Three sidecar files with three different failure behaviours | Medium | Low | §7.2 shared helper |

---

## 15. Acceptance criteria

- [ ] Conversations can be named; names persist across restart
- [ ] Empty name reverts to the preview display
- [ ] Rename available from the list and from within a conversation, keyboard-operable
- [ ] Starring works, is filterable, and is not conveyed by icon or colour alone
- [ ] Deletion requires confirmation that states irreversibility, with Cancel focused
- [ ] Deleting the active conversation carries an extra warning
- [ ] **Deletion cannot escape the history directory; traversal rejected**
- [ ] Deletion is logged
- [ ] Markdown export includes messages, timestamps, and collapsed tool calls
- [ ] JSON export valid; filename meaningful
- [ ] Export works client-side with no new dependency
- [ ] **Claude Code's JSONL is never written for metadata purposes**
- [ ] Corrupt metadata degrades silently; stale entries pruned
- [ ] Uses the shared sidecar helper; filename does not clash with P14's
- [ ] `/histories/metadata` registered before `/histories/:sessionId`
- [ ] `make check` passes

---

## 16. Open questions

1. **Should deletion remove the JSONL, or only hide the conversation from this UI?** The
   sharpest question here. Removing it destroys data Claude Code owns and that the user may
   expect to find via the CLI. Hiding it is safer but leaves disk usage growing and is
   arguably dishonest about what "delete" means. **A third option — move to a
   `~/.claude/pdlc-studio-trash/` directory — gives real deletion semantics with recovery**,
   and is probably the right answer.
2. **Should names be visible to Claude Code itself?** They live in our sidecar, so the CLI will
   not see them. Acceptable, but worth being explicit that this is a PDLC Studio concept.
3. **Should export include a project path?** Useful context; also leaks a filesystem path into
   a file the user may share publicly. Recommendation: include it, but make it easy to see and
   remove.
4. **Should names be auto-generated?** Asking Claude to summarise a conversation into a title
   would be genuinely useful and is how several products do it. But it costs a model call per
   conversation and introduces a background API cost the user did not ask for. Deliberately
   excluded; worth revisiting as an explicit, user-triggered action rather than automatic.
5. **Should starring affect P08's search ranking?** A starred conversation is likely more
   relevant. Cheap once both exist.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Shared sidecar helper (if not already written by P06/P14) | 2 h |
| Metadata endpoints | 3 h |
| Deletion endpoint with containment verification | 3 h |
| `useConversationMetadata` hook | 2 h |
| Markdown and JSON export | 4 h |
| `ConversationActions` component | 3 h |
| `HistoryView` integration incl. filter | 3 h |
| Backend tests | 4 h |
| Frontend tests | 4 h |
| Manual verification | 1.5 h |
| **Total** | **≈29.5 h — 4 days** |

Slightly above effort 2's nominal range; the deletion path and its safety tests are what push
it. Export alone is roughly **6 h** and could ship independently — it is the cheapest, safest,
and arguably most valuable half.

---

## 18. References

- `frontend/src/components/HistoryView.tsx` — the surface to extend
- `frontend/src/hooks/useHistoryLoader.ts` — existing loading pattern
- `frontend/src/utils/constants.ts:18-19` — `SUMMARY_MAX_LENGTH`, `SESSION_ID_DISPLAY_LENGTH`
- `frontend/src/utils/messageConversion.ts`, `contentUtils.ts` — reuse for export
- `backend/history/pathUtils.ts` — session path resolution
- `backend/handlers/histories.ts` — existing routes and their ordering
- `shared/types.ts:38-61` — `ConversationSummary`, `ConversationHistory`
- `CLAUDE.md` § "Assistant payloads use the Anthropic API `Beta*` types"
- `CLAUDE.md` § "Backend" — route-ordering constraint
- `../03-feature-comparison-matrix.md` — `SESS-09`, `SESS-10`
- `P06-recent-projects-cold-start-fix.md` §7.1 — the sidecar precedent
- `P14-authentication.md` §7.3 — the shared sidecar helper and the filename clash to avoid
- `P08-cross-session-conversation-search.md` §7.2 — the route-ordering hazard under `histories`
