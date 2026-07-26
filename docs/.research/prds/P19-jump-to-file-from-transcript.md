# P19 — Jump to File from Transcript

| Field | Value |
| --- | --- |
| **Priority** | **P19** of 30 |
| **Score** | **12.0** |
| **Inputs** | Value 4 · Reach 4 · GapWeight ×1.5 · Effort 2 |
| **Category** | Code & File Interaction |
| **Matrix features** | `FILE-11` (jump to file cited in transcript) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui UNVERIFIED |
| **Effort** | **2** |
| **Depends on** | **P07** (file viewer and tree) — hard dependency |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

Claude Code's output is dense with file references. Tool calls name paths. Assistant prose
says "I've updated `src/auth/session.ts:42`". Error output carries `file:line:column`
triples. Every one of these is a thing the user might want to look at.

In PDLC Studio today, **all of them are inert text.** The user reads a path, then either asks
Claude to print the file — costing tokens and returning a snapshot — or switches to a
terminal or editor and navigates there by hand.

P07 fixes the underlying capability by adding a file tree and viewer. But P07 alone leaves a
gap: the user must *manually* find, in a tree, the file they are already looking at the name
of. That is a small friction repeated constantly.

This PRD closes the loop. It is deliberately small, and its value is almost entirely
*multiplicative* with P07 — the matrix note says as much: *"Small, and it makes FILE-01/02
pay off immediately."*

`04-uiux-workflow-comparison.md` §2 Journey B frames the underlying problem:

> PDLC Studio makes every file access a round-trip through the model — slow, token-expensive,
> and lossy.

P07 removes the need for the round trip. P19 removes the need to go looking.

### Why P19 rather than higher

Effort 2, but it is strictly downstream of P07 (effort 3), so it cannot be delivered early.
Its ×1.5 rather than ×2.0 gap weight reflects that the competitor's equivalent is
**UNVERIFIED** — this is not a parity item, it is a coherence item.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui's transcript-to-file linking is **UNVERIFIED** — the scan read its README,
`package.json`, `server/index.js`, and file tree, not its chat rendering components.

What is verified is that it has all the pieces: a `file-tree` module, a `code-editor` module
built on CodeMirror 6, and a chat module. Whether it wires them together this way is unknown.

**This PRD's priority does not depend on the competitor.** It rests on internal coherence:
once P07 exists, leaving file references inert is a conspicuous omission, in the same way
that P15 without P16 leaves a blind commit button.

---

## 3. Goals & non-goals

### Goals

1. File references in the transcript become clickable.
2. Clicking opens the file in P07's viewer.
3. Line references scroll to and highlight the line.
4. Detection is conservative — false positives are worse than misses.
5. Non-existent or out-of-project references degrade gracefully.

### Non-goals

- **The file viewer itself.** P07.
- **Editing.** `FILE-03`, deferred.
- **Linking to symbols or definitions.** Requires language intelligence; out of scope.
- **Linking external URLs.** The Markdown renderer already handles links.
- **Rewriting or normalising paths in the transcript.** Display text stays exactly as Claude
  wrote it.
- **Linking inside code blocks.** See §6 — deliberately excluded.

---

## 4. Personas & user stories

**Marcus — following a change.**

> As a user reading "I've updated `src/auth/session.ts`", I want to click that path and see
> the file, so that I can verify the claim immediately.

**Priya — chasing an error.**

> As a user looking at a stack trace, I want `foo.ts:42` to take me to line 42, so that I do
> not have to find the file and then count lines.

**Devon — reviewing a tool call.**

> As a user, I want the path in a `Read` or `Edit` tool call to be clickable, because that is
> where paths appear most often and most reliably.

Devon's story points at the highest-confidence, lowest-risk source of references — see §7.2.

---

## 5. Functional requirements

### Detection

- **FR-1** File paths appearing in **tool call inputs and results** **MUST** be detected.
- **FR-2** File paths appearing in **assistant prose** **SHOULD** be detected.
- **FR-3** `path:line` and `path:line:column` forms **MUST** be recognised, with the line used
  for navigation.
- **FR-4** Both absolute paths within the project and project-relative paths **MUST** be
  handled.
- **FR-5** Detection **MUST NOT** produce links for text that is not a path. Precision is
  prioritised over recall.
- **FR-6** References resolving outside the project root **MUST NOT** be linked.
- **FR-7** Detection **MUST NOT** alter the displayed text.

### Navigation

- **FR-8** Activating a reference **MUST** open the file in P07's viewer.
- **FR-9** Where the panel is closed, activation **MUST** open it.
- **FR-10** A line reference **MUST** scroll to and visually mark that line.
- **FR-11** A reference to a non-existent file **MUST** produce a clear message, not a broken
  view.
- **FR-12** Activation **MUST NOT** disturb the transcript's scroll position.

### Presentation

- **FR-13** Linked references **MUST** be visually distinguishable as interactive.
- **FR-14** The distinction **MUST NOT** rely on colour alone.
- **FR-15** Unlinked paths **MUST** render exactly as they do today — no layout shift, no
  change in weight.

### Accessibility

- **FR-16** References **MUST** be real interactive elements — `button` or `a` — reachable by
  Tab and activated by Enter.
- **FR-17** Each **MUST** have an accessible name conveying what it opens, including the line
  where present.
- **FR-18** Opening a file **MUST** be announced, since the visual change happens outside the
  user's reading position.
- **FR-19** References **MUST NOT** be so numerous that they flood the tab order — see §6.

FR-19 is a real concern: a transcript containing a long file listing could otherwise produce
hundreds of tab stops, making keyboard navigation of the conversation worse than before.

---

## 6. UX & interaction specification

### What gets linked, and what does not

**This is the central design decision**, and the answer is "less than you might expect".

| Location | Linked? | Reasoning |
| --- | --- | --- |
| Tool call `file_path` inputs | **Yes** | Structured data. A path field *is* a path. Zero ambiguity |
| Tool result file headers | **Yes** | Same |
| Assistant prose, inline code spans | **Yes** | `` `src/auth/session.ts` `` is a strong signal |
| Assistant prose, bare text | **Cautiously** | "look in the src directory" must not link |
| **Inside fenced code blocks** | **No** | Code contains import paths, strings, and comments full of path-like text. Linking there would riddle real code with interactive elements, break selection, and hurt readability |
| Command output in code blocks | **No** | Same, and this is where FR-19's flooding risk lives |

Excluding code blocks is what keeps FR-5 (precision) and FR-19 (tab-order sanity)
achievable. It also preserves P03's copy behaviour — a code block's copied content must
remain the raw source, and wrapping paths in elements inside it risks that.

### Presentation

```
  I've updated src/auth/session.ts to expire tokens.
               ─────────────────────
               dotted underline + pointer
```

- Dotted or dashed underline plus a distinct treatment on hover and focus (FR-13, FR-14).
- **Not** styled like a hyperlink — these are not navigations away, and a blue underline
  would imply leaving the app.
- Unlinked text is untouched (FR-15).

### Activation

| Panel state | Behaviour |
| --- | --- |
| Closed | Opens, shows the file (FR-9) |
| Open on the tree | Switches to the file |
| Open on another file | Switches |
| Open on the same file, different line | Scrolls and re-marks (FR-10) |

The transcript never scrolls (FR-12). The user's reading position is preserved — jumping to a
file should not lose their place in the conversation.

### Failure

| Case | Behaviour |
| --- | --- |
| File does not exist | Panel opens with "File not found: *path*", plus a refresh affordance |
| Path outside the project | **Not linked at all** (FR-6) — no failure to handle |
| Binary file | P07's binary message |
| Line beyond end of file | Open the file; do not mark a line; no error |

---

## 7. Technical design

### 7.1 Where detection happens

**Not in a global text pass over rendered HTML.** That would require DOM traversal after
render, would fight the Markdown renderer, and would be impossible to test cleanly.

Instead, detection happens where content is already being processed into display messages:

- `frontend/src/utils/UnifiedMessageProcessor.ts` (590 lines) builds display messages
- `frontend/src/utils/contentUtils.ts` (116 lines) extracts content
- `frontend/src/utils/toolUtils.ts` (139 lines, 171 lines of tests) already parses tool data

Structured tool inputs (FR-1) are the easy and highest-value case: `toolUtils.ts` already
understands tool shapes, and a `file_path` field needs no pattern matching at all — it is
declared to be a path.

Prose detection (FR-2) is the harder case and needs a pattern, applied only to text segments
outside code spans and code blocks.

### 7.2 Two detection tiers

Treating these separately is what makes FR-5 achievable.

**Tier 1 — structured (high confidence, do this first)**

Tool calls carry paths in named fields. `Read`, `Edit`, `Write`, and `Grep` all take a path
argument. Per `CLAUDE.md`, a `tool_use` block's `input` is typed `unknown`, so narrowing is
required — but once narrowed, a `file_path` value is unambiguously a path.

**This tier alone delivers most of the value** and carries essentially no false-positive
risk. If effort must be cut, ship Tier 1 and defer Tier 2.

**Tier 2 — textual (lower confidence)**

A conservative pattern over prose. It should require at least one of:

- A path separator **and** a recognised file extension (`src/auth/session.ts`)
- An explicit `:line` suffix (`session.ts:42`)
- Enclosure in an inline code span

And it should reject:

- Bare directory names without separators ("the src directory")
- URLs, which the Markdown renderer handles
- Version strings, `package@1.2.3` forms
- Anything containing whitespace

**A path that does not resolve inside the project MUST NOT be linked** (FR-6). That check is
the strongest available filter and it is cheap — see §7.3.

### 7.3 Resolution and validation

FR-6 needs a project-relative resolution before deciding to link. Two options:

| Option | Assessment |
| --- | --- |
| Validate against P07's tree data | No extra request; but the tree is lazily loaded (P07 FR-2), so most paths will not be known |
| **Resolve optimistically; validate on activation** | Link anything shape-plausible and in-project by path arithmetic; report not-found on click (FR-11) |

**Recommendation: the second.** Pre-validating every reference would require a request per
path, and P07's tree is deliberately lazy. Path arithmetic — does this resolve inside the
project root — is enough to satisfy FR-6 without any I/O, and FR-11 handles the rest.

Path arithmetic must reuse the same containment logic as P07 §7.3's `resolveWithinRoot`,
conceptually — though here it runs client-side and is a *display* decision, not a security
boundary. **The security boundary remains server-side in P07's endpoint**, and this PRD must
not weaken that: a client-side check is a UX filter, not a control.

### 7.4 Components

| Item | Purpose |
| --- | --- |
| New `frontend/src/utils/fileReferences.ts` | Detection, both tiers, and resolution |
| New `frontend/src/components/chat/FileReference.tsx` | The interactive element |
| Modify `frontend/src/utils/toolUtils.ts` | Expose path fields from tool inputs |
| Modify `frontend/src/components/MessageComponents.tsx` | Render references in prose |
| Modify P07's `useFileContent` / panel state | Accept an open-at-line request |

The panel needs an imperative "open this file at this line" entry point. That should be part
of P07's hook surface rather than bolted on — worth agreeing when P07 is built, since P16
(diff) and P25 (search) will want the same thing.

### 7.5 Line highlighting

FR-10 is already solved by Astryx. P07 §7.6 records that `CodeBlock` accepts
`highlightLines: number[]` (1-indexed). So the file viewer passes the requested line through
and the design system marks it.

Scrolling the line into view is separate and is ours — `maxHeight` makes `CodeBlock`
scrollable, so a ref plus `scrollIntoView` on the target row is the mechanism, subject to
whether the rendered rows are reachable. **Verify this during P07**, since P16 needs the same
capability.

### 7.6 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Tool input parsing | `toolUtils.ts` + its tests | `frontend/src/utils/` |
| Content extraction | `contentUtils.ts` | `frontend/src/utils/` |
| Display message construction | `UnifiedMessageProcessor.ts` | `frontend/src/utils/` |
| File viewer and panel | P07 | `frontend/src/components/files/` |
| Line highlighting | Astryx `CodeBlock` `highlightLines` | design system |
| Buttons | Astryx | design system |

---

## 8. Data model & persistence

**None.** References are derived from message content at render time. Nothing is stored.

---

## 9. Security implications

Small, but there is one thing to get right.

**The client-side containment check is not a security control** (§7.3). FR-6 prevents
*linking* out-of-project paths, which is a UX decision — it stops the UI offering to open
`/etc/passwd` because Claude mentioned it. The actual boundary is P07's server-side
`resolveWithinRoot`, and this PRD must not create any path into the file endpoint that
bypasses it.

Concretely: the open-at-file request must go through P07's existing endpoint with its
existing validation. It must not gain a "trusted, already-checked" fast path.

**Reference text is rendered as text.** Paths come from model output and could contain
markup-like content. As in P08 §9 and P16 §9, the reference element is constructed from a
structured value, never interpolated into markup. The displayed label is the path exactly as
written (FR-7), escaped as ordinary text.

No new endpoint. No new data leaves the machine.

---

## 10. Performance & scale

- Detection runs per message at processing time, not per render. `UnifiedMessageProcessor`
  is already the place this work belongs.
- Tier 2's pattern must be bounded — a catastrophic-backtracking regex over a long assistant
  message would be a real hazard. Keep the pattern simple and anchored; avoid nested
  quantifiers.
- Excluding code blocks (§6) is also the main performance mitigation: the largest text
  volumes in a transcript are code and command output, and they are skipped entirely.
- FR-19's tab-order concern is addressed by the same exclusion.

---

## 11. Telemetry & observability

None. A file that fails to open surfaces to the user (FR-11) rather than being logged.

---

## 12. Test plan

### Frontend — Vitest, `make test-frontend`

New `frontend/src/utils/fileReferences.test.ts` — **the highest-value file**, because
precision is the requirement:

| Test | Asserts |
| --- | --- |
| Tool `file_path` input detected | FR-1 |
| Relative path in prose with extension detected | FR-2, FR-4 |
| Absolute in-project path detected | FR-4 |
| `path:line` parsed with the line extracted | FR-3 |
| `path:line:column` parsed, line used | FR-3 |
| **"the src directory" not linked** | **FR-5** |
| **A URL not linked** | FR-5 |
| **`package@1.2.3` not linked** | FR-5 |
| **Text with whitespace not linked** | FR-5 |
| **Out-of-project path not linked** | **FR-6** |
| **`../` escaping the project not linked** | FR-6 |
| Content inside a fenced code block not linked | §6 |
| Content inside an inline code span **is** linked | §6 |
| Displayed text is byte-identical to input | FR-7 |
| Pattern terminates promptly on a long adversarial string | §10 |

New `frontend/src/components/chat/FileReference.test.tsx`:

| Test | Asserts |
| --- | --- |
| Renders as a real button reachable by Tab | FR-16 |
| Activated by Enter | FR-16 |
| Accessible name includes path and line | FR-17 |
| Interactive treatment not colour-only | FR-14 |
| Opening announced | FR-18 |

Integration, extending `ChatMessages` tests:

| Test | Asserts |
| --- | --- |
| Activation opens the panel when closed | FR-9 |
| **Transcript scroll position unchanged on activation** | FR-12 |
| Non-existent file shows a clear message | FR-11 |
| Unlinked paths render identically to before | FR-15 |

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Ask Claude to read a file → the path in the tool call is clickable and opens it.
2. Ask Claude to describe a change → the path in prose is clickable.
3. Produce a stack trace with `file.ts:42` → opens at line 42, highlighted.
4. Confirm a transcript containing a long code listing has **no** links inside the code
   block.
5. Mention a path outside the project → not linked.
6. Reference a deleted file → clear not-found message.
7. Click from the middle of a long transcript → transcript stays put.
8. Tab through a message with several references → sensible, bounded tab order.
9. Screen reader: reference names read meaningfully; opening is announced.

Check 4 is the one that most often regresses, because it depends on the Markdown pipeline's
structure rather than on the detection pattern.

---

## 13. Rollout & migration

Additive. No endpoint, no wire change, no persistence, no migration. Minor release.

**Must ship after P07.** Shipping the two together is reasonable — P07's value is noticeably
higher with P19 attached, and P19 is meaningless without it.

**Consider shipping Tier 1 only** in the first pass (§7.2). It is most of the value at a
fraction of the risk, and Tier 2 can follow once the panel integration is proven.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **False positives litter prose with bogus links** | **Medium** | **High** | FR-5 precision-over-recall; two-tier design; nine negative tests; ship Tier 1 first |
| 2 | Links inside code blocks break readability and copy | **Medium** | **High** | §6 exclusion; explicit test |
| 3 | Reference flood destroys the tab order | Medium | Medium | FR-19; code-block exclusion is the main mitigation |
| 4 | Client-side containment mistaken for a security control | Medium | **High** | §9 — server-side validation remains the boundary; no fast path |
| 5 | Catastrophic backtracking on a long message | Low | Medium | §10 simple anchored pattern; adversarial test |
| 6 | Activation scrolls the transcript, losing the user's place | Medium | Medium | FR-12; explicit test |
| 7 | Scroll-to-line not achievable within `CodeBlock` | Medium | Medium | §7.5 — verify during P07, since P16 needs it too |
| 8 | Detection duplicated across message types | Low | Low | Single `fileReferences.ts` module |

---

## 15. Acceptance criteria

- [ ] Paths in tool call inputs and results are clickable
- [ ] Paths in assistant prose are clickable, conservatively
- [ ] `path:line` and `path:line:column` recognised; line used for navigation
- [ ] **Nothing inside fenced code blocks is linked**
- [ ] Directory words, URLs, version strings and whitespace-containing text are not linked
- [ ] Out-of-project and `../`-escaping paths are not linked
- [ ] Displayed text is unchanged from what Claude wrote
- [ ] Activation opens the file in P07's viewer, opening the panel if closed
- [ ] Line references scroll to and highlight the line
- [ ] Non-existent files produce a clear message
- [ ] **Transcript scroll position is preserved on activation**
- [ ] References are real buttons, Tab-reachable, Enter-activated
- [ ] Accessible names include path and line; opening is announced
- [ ] Interactive treatment does not rely on colour alone
- [ ] Unlinked text renders identically to today
- [ ] **File access still goes through P07's server-side validation**
- [ ] `make check` passes

---

## 16. Open questions

1. **Ship Tier 2 at all in the first pass?** §7.2 argues Tier 1 carries most of the value and
   almost none of the false-positive risk. A staged rollout is attractive.
2. **Can `CodeBlock` scroll to a specific line?** §7.5 — `highlightLines` marks it, but
   scrolling it into view depends on the rendered structure. Verify during P07; P16 needs the
   same answer.
3. **Should references show existence state before activation?** A subtly different treatment
   for known-missing files would be nice, but requires pre-validation, which §7.3 rejects on
   cost grounds. Probably no.
4. **Should tool-call paths be linked even when the panel would show a stale file?** After an
   agent edits a file, the viewer shows current content, not the content at the time of the
   tool call. That is arguably correct — but it means clicking a path in an old message shows
   today's file, which could confuse. Worth a note in the UI, or accepting.
5. **Should this extend to line ranges** (`file.ts:10-20`)? Common in some output formats.
   Cheap to add if `highlightLines` accepts an array, which it does.

Question 4 is the most interesting product question here and has no obviously right answer.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Tier 1: tool-input path extraction | 3 h |
| Tier 2: prose pattern and exclusions | 4 h |
| Project-relative resolution and FR-6 filtering | 2 h |
| `FileReference` component | 2 h |
| Panel open-at-line integration with P07 | 3 h |
| Scroll-to-line (§7.5) | 2 h |
| Tests, weighted to negative cases | 5 h |
| Manual verification | 1.5 h |
| **Total** | **≈22.5 h — 3 days** |

Tier 1 alone is roughly **10 h**, which is the recommended first increment (§16.1).

---

## 18. References

- `frontend/src/utils/toolUtils.ts` — tool parsing, 139 lines with 171 lines of tests
- `frontend/src/utils/contentUtils.ts` — content extraction
- `frontend/src/utils/UnifiedMessageProcessor.ts` — where detection belongs
- `frontend/src/components/MessageComponents.tsx` — prose rendering
- `CLAUDE.md` § "Assistant payloads use the Anthropic API `Beta*` types" — `tool_use.input` is `unknown`
- `CLAUDE.md` § "Chat UI" — `CodeBlock`, `Markdown`
- `../03-feature-comparison-matrix.md` — `FILE-11`
- `../04-uiux-workflow-comparison.md` §2 Journey B
- `P07-file-tree-read-only-file-viewer.md` §7.3, §7.6 — server-side confinement and `CodeBlock` props
- `P16-diff-viewer.md` §7.4 — the parallel rendering question
