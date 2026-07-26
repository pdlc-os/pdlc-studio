# UI/UX Workflow & Interactive Capability Comparison

> Where `03-feature-comparison-matrix.md` asks *"does it have X?"*, this document asks
> *"what is it like to use?"* — navigation model, task journeys, interaction affordances,
> keyboard, accessibility, and the failure modes each design produces.

---

## 1. The core structural difference: one surface vs. many

This single difference explains most of what follows.

### PDLC Studio — a **linear, single-surface** app

Three routes total (`frontend/src/App.tsx:23-36`), one of which is dev-only:

```
/              → ProjectSelector   (launch screen)
/projects/*    → ChatPage          (everything else)
/demo          → DemoPage          (development builds only)
```

The user's mental model is a straight line: **pick a directory → talk to Claude**. There is
no second thing to do, no place to get lost, and no navigation to learn. `ChatPage` is the
application.

### claudecodeui — a **tabbed workbench**

24 feature modules under `src/components/`, organised around a persistent `sidebar` and a
`main-content` area that swaps between chat, `code-editor`, `file-tree`, `git-panel`,
`shell`, `mcp`, `task-master`, `browser-use`, `plugins`, `prd-editor`, `settings`, and
more.

The mental model is an IDE: **a workspace with tools in it**, chat being one tool among
several.

### The consequence

| | PDLC Studio | claudecodeui |
| --- | --- | --- |
| Time to first message | Very low — two clicks | Higher — auth, then project, then find the chat tab |
| Cognitive load | Minimal | IDE-scale |
| Ceiling on task complexity | **Low** — anything not expressible as chat is impossible | High |
| Risk of feeling unfinished | **High** — "where's the file tree?" | Low |
| Risk of feeling bloated | Low | Moderate |

Neither is strictly better. But note the asymmetry in **failure mode**: PDLC Studio's
simplicity is a genuine feature right up until the user needs to see a file, at which point
it becomes a wall. There is no graceful degradation — you either stay in chat or you leave
the app and open a terminal.

---

## 2. Journey-by-journey comparison

### Journey A — First run, brand new user

**PDLC Studio**

1. `npm install -g pdlc-studio` or download a 38 MB binary; run it.
2. Browser opens on the launch screen: identity + three buttons on the left, "Recent
   Projects" on the right.
3. Recent Projects is **empty** — it reads `~/.claude.json` and only lists directories that
   already have conversation history (`CLAUDE.md`, "Launch screen").
4. No onboarding, no tour, no explanation of the three buttons.
5. Pick a directory → straight into chat.

**Friction**: step 3 is a genuine cold-start problem. A new user sees an empty panel where
the app's most prominent affordance should be, with no text explaining why. The three
buttons are self-explanatory, which saves it — but there is nothing telling the user that
Claude CLI must be installed and authenticated first. If it isn't, the failure surfaces
much later, as a stream error in chat.

**claudecodeui**

1. Install (npm / Docker / Electron), run.
2. **Log in** — a real auth gate (`auth` module, `/api/auth`).
3. A dedicated **`onboarding/`** module and a **`project-creation-wizard`** guide setup.
4. `provider-auth` walks through connecting Claude / Codex / Cursor.

**Friction**: more steps before value. But nothing is unexplained, and provider
misconfiguration is caught at setup rather than at first message.

> **Gap taken**: PROJ-08 (first-run onboarding), PROJ-05 (recent-projects cold start).

---

### Journey B — "Read this file and explain it"

**PDLC Studio**: type the request. Claude reads the file and prints it into the transcript,
where it renders through Astryx `CodeBlock` with `isCollapsible` truncation. To see a
*different* part of the file, ask again. To see a file Claude didn't mention, ask.

The transcript is the **only** view of the filesystem.

**claudecodeui**: open `file-tree`, click the file, read it in CodeMirror with syntax
highlighting, a minimap, and search. Chat is for questions, not for retrieval.

**Assessment**: this is the sharpest daily-use gap. PDLC Studio makes every file access a
round-trip through the model — slow, token-expensive, and lossy. This is why FILE-01/02
rank so highly despite being large.

> **Gap taken**: FILE-01, FILE-02, FILE-05, FILE-11.

---

### Journey C — "The agent just changed 8 files. What did it do?"

**PDLC Studio**: read the transcript and reconstruct it mentally from the tool-call blocks.
There is no diff, no changed-file list, no `git status`. To actually review, leave the app
and run `git diff` in a terminal.

**claudecodeui**: open `git-panel` — changed files listed, diffs rendered via
`@codemirror/merge`, stage what's good, commit, all in-app.

**Assessment**: this is the workflow PDLC Studio is *most* conspicuously missing, because
it's the one that follows every single successful agent interaction. The app helps you
generate changes and then abandons you at the moment of review. It is also the strongest
argument for GIT-03/GIT-05/GIT-07 and FILE-04.

> **Gap taken**: GIT-03, GIT-05, GIT-07, FILE-04.

---

### Journey D — "Where was that thing I asked three days ago?"

**PDLC Studio**: open `HistoryView`, which lists conversations for the current project with
`lastMessagePreview` (truncated to 50 chars, `MESSAGE_CONSTANTS.SUMMARY_MAX_LENGTH`). Scan
by eye. There is **no search** — not within a conversation, not across them, not across
projects.

**claudecodeui**: Fuse.js fuzzy search plus `@vscode/ripgrep`, backed by a SQLite session
index.

**Assessment**: PDLC Studio's history browsing degrades badly with use. It is fine at 10
conversations and unusable at 300 — and the users who like the product most will hit 300
fastest.

> **Gap taken**: SESS-03, and EXT-02 (command palette) as the natural home for it.

---

### Journey E — "Here's a screenshot of the bug"

**PDLC Studio**: **impossible.** `ChatRequest.message` is a bare `string`
(`shared/types.ts:8`). The wire contract has no room for an attachment. The user must
save the image, then ask Claude to read it by path — which works only because Claude has
filesystem access, and fails entirely if the image is on a phone.

**claudecodeui**: paste, drag, or pick. `react-dropzone` client-side, `multer` server-side,
`/api/assets` for retrieval.

**Assessment**: screenshot→chat is one of the highest-frequency agent workflows in
practice. Its total absence is a bigger deal than the maturity-0 score suggests.

> **Gap taken**: IN-01/02/03 (one PRD).

---

### Journey F — Approving a risky operation

**PDLC Studio**: **by default, there is nothing to approve.** Sessions start in
`bypassPermissions` (`frontend/src/hooks/chat/usePermissionMode.ts:20`), so Claude runs
every tool including `Bash` unattended.

If the user cycles to `default` mode (footer control or `Ctrl+Shift+M`), they get a genuinely
good approval experience: `PermissionInputPanel` for per-tool decisions,
`PlanPermissionInputPanel` for plan review, and allowlist parsing that understands
multi-word commands and compound separators (`frontend/src/utils/toolUtils.ts`).

**But that choice does not survive a page reload** — `usePermissionMode` is plain React
state with no persistence, explicitly documented as resetting
(`usePermissionMode.ts:23-26`). A user who deliberately opts into safety silently loses it
on refresh.

**claudecodeui**: tools **disabled by default**; the user opts in via settings.

**Assessment**: PDLC Studio has built a better approval *mechanism* than it defaults to
using. The UX gap is not the panels — those are good — it is that the safe path is
non-default and non-sticky.

> **Gap taken**: SEC-03 + SEC-11 (one PRD), TOOL-04 (allowlist UI), TOOL-07 (audit log).

---

### Journey G — Using it from a phone

**PDLC Studio**: works, in the sense that the layout reflows —
`MESSAGE_CONSTANTS.MAX_DISPLAY_WIDTH` switches 70% → 85%
(`frontend/src/utils/constants.ts:14-17`), and Astryx handles the rest. But:

- It cannot be installed to the home screen (no manifest).
- **Pinch-zoom is disabled** — `user-scalable=no` (`frontend/index.html:15`), a WCAG 1.4.4
  failure.
- There is no mobile navigation pattern; the desktop layout simply narrows.
- Reaching it from a phone at all requires `--host 0.0.0.0`, which — with no auth and
  `bypassPermissions` — exposes arbitrary shell execution to the local network. The README
  says this plainly in a `[!CAUTION]` block (`README.md:293-294`).

**claudecodeui**: mobile is the headline use case. Installable, push notifications, remote
access behind JWT auth.

**Assessment**: PDLC Studio's mobile story is *blocked on its security story*. Making the
mobile experience better without authentication would be irresponsible — it would make a
hazardous configuration more attractive. This dependency is why SEC-01 outranks every
mobile item.

> **Gap taken**: MOB-01, MOB-02, MOB-06 — all sequenced **after** SEC-01.

---

## 3. Interaction affordances

### Keyboard

**PDLC Studio — three shortcuts, total** (`frontend/src/utils/constants.ts:5-10`):

| Key | Action |
| --- | --- |
| `Escape` | Abort the in-flight request |
| `Enter` | Submit (behaviour configurable — send vs. newline) |
| `Ctrl+Shift+M` | Cycle permission mode |

The configurable Enter behaviour is a thoughtful touch that many larger apps miss. But
there is no shortcut for: new session, open history, focus composer, switch project,
toggle theme, or open settings.

**claudecodeui**: `cmdk` powers a full command palette — the standard modern answer, which
makes every action keyboard-reachable without memorising bindings.

> **Gap taken**: UX-04 (shortcut set), EXT-02 (command palette).

### Discoverability

**PDLC Studio's weakest interaction property.** Three examples:

1. **Slash commands.** The backend strips a leading `/` and forwards the rest
   (`backend/handlers/chat.ts:39-44`). So `/compact` works — but nothing in the UI tells
   you it exists, lists available commands, or hints at arguments. It is an invisible
   feature.
2. **Permission modes.** Four modes exist, cycled by a footer control and `Ctrl+Shift+M`.
   The shortcut is documented in `CLAUDE.md` and the README — not in the app.
3. **`allowedTools`.** A first-class field on the wire contract (`shared/types.ts:11`) with
   sophisticated parsing behind it, and **no UI writes it**. The capability is fully built
   and completely unreachable.

claudecodeui's command palette and settings screens make the equivalent surfaces
discoverable by browsing.

> **Gap taken**: EXT-01 (slash-command discovery), TOOL-04 (allowlist UI).

### Feedback and system legibility

What PDLC Studio does **well**:

- Streaming output appears live.
- Abort is distinguished from error at the protocol level — `AbortError` yields
  `{ type: "aborted" }` rather than an error (`backend/handlers/chat.ts:83-86`).
- Tool calls render as structured `ChatToolCalls`, not raw JSON.
- Two tested blocklists keep SDK telemetry out of the transcript, so the conversation reads
  as a conversation.

What it **hides**:

- **Rate limits.** `rate_limit_event` is in `IGNORED_SDK_MESSAGE_TYPES`. When the user is
  rate-limited, the UI simply stalls with no explanation.
- **Context pressure.** Compaction boundaries arrive as `system` subtypes and are filtered.
  The user never learns their context was compacted.
- **Cost and tokens.** Never displayed, though the data flows through `sdkFixtures`.
- **Which model is running.** Never shown, never selectable.

This is a coherent design philosophy — *keep the transcript clean* — that has been applied
slightly too broadly. Filtering `hook_progress` is right; filtering the only signal that
explains a 60-second stall is not.

> **Gap taken**: COST-05 (rate limits), COST-07 (context pressure), COST-01/02/03.

---

## 4. Accessibility

The one area where PDLC Studio's practices are clearly stronger — with one specific defect.

**PDLC Studio**

- Test discipline mandates asserting on **behaviour and state** — `data-selected`, `aria-*`,
  roles — and **never** on generated StyleX class names (`CLAUDE.md`, "Testing note"). This
  makes accessible markup structurally necessary rather than optional.
- Theming via CSS `light-dark()` against `color-scheme`, with an inline anti-FOUC script in
  `frontend/index.html` that sets only `data-theme` — deliberately not `style.colorScheme`,
  because that would outrank the stylesheet and freeze the page. That comment shows someone
  thought carefully about a real user-visible bug.
- System preference detection via `prefers-color-scheme`.
- Astryx components carry whatever semantics the design system provides, consistently.

**The defect**: `user-scalable=no` in the viewport meta (`frontend/index.html:15`) disables
pinch-zoom. This fails WCAG 2.1 SC 1.4.4 and contradicts everything above. It is a one-line
fix and is ranked accordingly (MOB-06).

**claudecodeui**: no accessibility tooling appears anywhere in its 35 devDependencies — no
`eslint-plugin-jsx-a11y`, no axe. With no test suite at all, there is no mechanism ensuring
accessible markup. Tailwind utility classes also make it easy to style without semantics.

**Verdict**: PDLC Studio leads meaningfully here, and should keep leading. Fix MOB-06.

---

## 5. Visual and stylistic identity

| | PDLC Studio | claudecodeui |
| --- | --- | --- |
| Styling | Astryx components; **no** utility classes | Tailwind + CVA + `tailwind-merge` |
| Tokens | Enforced; app CSS limited to app-shell classes | Convention only |
| Theming | `light-dark()` tokens, no `.dark` class | Tailwind dark variant |
| Layout metaphor | **Xcode-style launch window**, 60/40 split panel | IDE with sidebar + tabs |
| Icon | Original artwork, two optical sizes, drift-tested in CI | `lucide-react` |
| i18n | **None** | i18next, 7 README languages |

PDLC Studio's launch screen deserves specific credit. The Xcode-style panel with three
actions funnelling into one shared `DirectoryPickerDialog`, and a picker whose selection is
"the directory you're currently browsing" (matching native folder pickers rather than
inventing a selected-vs-open state), is better-considered interaction design than most
projects of any size produce.

The app-mark work is similarly disciplined: two optical sizes, and `AppIcon.test.tsx` fails
the build if `brand/`, `frontend/public/`, and the inlined geometry drift apart.

**The i18n row is a total gap**, and easy to overlook because nothing in the app looks
broken. Every user-facing string is a hard-coded English literal. Retrofitting i18n across
a codebase is far more expensive than scaffolding it early, which is why UX-06 is ranked
despite having no current user demand.

---

## 6. Where PDLC Studio's UX is genuinely better

Stated explicitly, because a gap analysis naturally over-weights deficits:

1. **Time to value.** Two clicks from launch to talking to Claude. claudecodeui requires
   auth, project selection, and finding the right tab.
2. **No navigation to learn.** Nothing is buried, because there is nowhere to bury it.
3. **The launch screen.** Better-considered than claudecodeui's equivalent, and the shared
   picker across create/clone/open is a real reuse win.
4. **Transcript cleanliness.** The two blocklists mean the conversation reads as a
   conversation instead of a log.
5. **Abort semantics.** Distinguishing abort from error at the protocol level is a detail
   most apps get wrong.
6. **Theming correctness.** The `light-dark()` approach and the anti-FOUC script are more
   robust than a class-toggle.
7. **Zero-setup demo mode.** `/demo` runs the full UI against a 787-line mock generator
   with no Claude CLI present — excellent for evaluation and screenshots.

Items 1–3 are the product's identity. **Nothing in the roadmap should trade them away**,
which is the explicit reason the top 30 contains no tabbed-IDE restructuring: the file
tree, git panel, and diff viewer are all specified as *progressive disclosure from the chat
surface* — panels and drawers reachable from context — rather than as a new top-level
navigation layer.

---

## 7. Summary

| Dimension | PDLC Studio | claudecodeui | Winner |
| --- | --- | --- | --- |
| Simplicity / time to value | Excellent | Moderate | **PDLC** |
| Breadth of capability | Narrow | Very broad | claudecodeui |
| Task-completion without leaving the app | **Poor** | Excellent | claudecodeui |
| Discoverability of own features | **Poor** | Good | claudecodeui |
| Keyboard support | Minimal (3) | Full palette | claudecodeui |
| Accessibility practice | Strong (1 defect) | Weak | **PDLC** |
| Visual consistency | Excellent | Good | **PDLC** |
| Mobile | Responsive only | Full, installable | claudecodeui |
| i18n | **None** | 7 languages | claudecodeui |
| Safety of default posture | **Hazardous** | Safe | claudecodeui |
| System legibility (cost, limits, model) | **Opaque** | Transparent | claudecodeui |

The pattern is consistent: **PDLC Studio wins on craft, claudecodeui wins on coverage.**

The roadmap in `06-prioritization-and-roadmap.md` is built to close coverage gaps *without*
spending the craft advantage — which is why it favours progressive disclosure over new
navigation, sidecar files over a database, and Astryx composition over new styling
primitives.
