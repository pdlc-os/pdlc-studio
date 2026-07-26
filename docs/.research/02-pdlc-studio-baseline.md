# PDLC Studio — Feature Baseline

> **Purpose**: an evidence-backed inventory of what PDLC Studio actually does today, so
> the comparison in `03-feature-comparison-matrix.md` measures a real baseline rather than
> the README's marketing claims.
>
> **Version scanned**: `0.2.4` (`backend/package.json`, commit `3997c20 Release 0.2.4`)
> **Date**: 2026-07-26
> **Method**: direct source reading. Every claim below cites a file path. Absence claims
> state what was searched for.

---

## 1. Executive summary

PDLC Studio is a **deliberately narrow, single-purpose web front end for the Claude Code
CLI**. It does one thing — stream a Claude Code session into a browser chat UI against a
user-chosen working directory — and it does that with unusually high engineering
discipline for a project of its size: a runtime abstraction over Deno and Node, a real
design system, a typed shared wire contract, unit tests on both sides, and a
one-command release pipeline producing compressed single-file binaries.

The scope is genuinely small. The whole application is roughly **6,250 lines** of
first-party TypeScript across backend and frontend (`wc -l` over `backend/**` and
`frontend/src/**`), served by **8 API endpoints** and **3 client routes**.

What follows is the honest reading: PDLC Studio's strength is *depth per feature*, and
its weakness is *breadth of features*. Almost everything it ships is at maturity 3–5.
Almost everything it does not ship is at maturity 0.

---

## 2. Architecture

### 2.1 Backend

| Property | Value | Evidence |
| --- | --- | --- |
| Location | `backend/` | — |
| Language | TypeScript | — |
| HTTP framework | Hono | `backend/handlers/chat.ts:1` |
| Runtimes | Deno **and** Node ≥20, behind an abstraction | `backend/runtime/{types,deno,node}.ts` |
| Default port | 8080 | `README.md:147-154` |
| Default bind | `127.0.0.1` | `README.md:150` |
| Claude invocation | Claude **Agent SDK** `query()`, pointed at the user's own CLI binary | `backend/handlers/chat.ts:50-70` |
| Streaming transport | **NDJSON over a plain `fetch` response body** | `backend/handlers/chat.ts:163-169` |
| Persistence | **None** — no database, no server-side state beyond an in-memory abort map | `backend/handlers/chat.ts:110` |

The runtime abstraction (`backend/runtime/types.ts`, 37 lines) is intentionally minimal —
it exists so business logic never imports `Deno.*` or `node:*` directly, which is what
makes the same handler code compile into a Deno single binary and also run under Node for
the npm package.

**Streaming is NDJSON, not SSE and not WebSocket.** `handleChatRequest` builds a
`ReadableStream`, JSON-stringifies each `StreamResponse` with a trailing newline, and
returns it with `Content-Type: application/x-ndjson`
(`backend/handlers/chat.ts:133-169`). This matters for the comparison: it is a
**unidirectional, per-request** channel. There is no persistent socket, so the server
cannot push anything to the client outside the lifetime of a chat POST.

### 2.2 API surface — all 8 endpoints

| Method | Path | Handler | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/projects` | `backend/handlers/projects.ts` | List project directories from `~/.claude.json` |
| `POST` | `/api/chat` | `backend/handlers/chat.ts` | Send a message, stream NDJSON back |
| `POST` | `/api/abort/:requestId` | `backend/handlers/abort.ts` | Abort an in-flight request |
| `GET` | `/api/projects/:encodedProjectName/histories` | `backend/handlers/histories.ts` | List conversation summaries |
| `GET` | `/api/projects/:encodedProjectName/histories/:sessionId` | `backend/handlers/histories.ts` | Fetch one conversation |
| `GET` | `/api/directories?path=` | `backend/handlers/directories.ts` | Browse subdirectories (read-only, dirs only, dotfiles hidden) |
| `POST` | `/api/projects/create` | `backend/handlers/projectSetup.ts` | Create a directory, optional `git init` |
| `POST` | `/api/projects/clone` | `backend/handlers/projectSetup.ts` | `git clone` into a directory |

**Route-ordering constraint**: `create` and `clone` are registered *before* the
parameterised `/api/projects/:encodedProjectName/...` routes, otherwise the literals get
captured as project names (`CLAUDE.md`, "Backend" section). Any new
`/api/projects/<literal>` route must respect this.

### 2.3 Frontend

| Property | Value | Evidence |
| --- | --- | --- |
| Location | `frontend/` | — |
| Stack | Vite + React + SWC + TypeScript + React Router | `frontend/package.json` |
| Design system | **Astryx**, neutral theme. No Tailwind, no utility classes | `CLAUDE.md`, "Design System (Astryx)" |
| Routes | **3 only** | `frontend/src/App.tsx:23-36` |
| Theming | CSS `light-dark()` tokens resolved against `color-scheme` | `frontend/src/components/AstryxProvider.tsx` |
| Client state | React state + `localStorage`; no client-side store library | `frontend/src/utils/storage.ts` |

The three routes are exhaustive (`frontend/src/App.tsx:23-36`):

- `/` → `ProjectSelector` (launch screen)
- `/projects/*` → `ChatPage`
- `/demo` → `DemoPage`, **lazy-loaded and only mounted in development**
  (`frontend/src/App.tsx:10-16`, guarded by `isDevelopment()`)

There is no settings route, no file route, no git route, no terminal route.

---

## 3. Feature inventory by category

### 3.1 Access, Identity & Security — **maturity 1**

This is the weakest area and the project says so itself.

- **No authentication of any kind.** No login, no session cookie, no token, no API key.
  Searched for: `auth`, `login`, `jwt`, `bcrypt`, `session`, `passport`, `cookie`,
  `Authorization` across `backend/` and `frontend/src/` — the only hits are the Claude
  *SDK* session-id plumbing, which is unrelated to user identity.
- **No multi-user concept.** No user model, no per-user scoping. Single local operator is
  the only supported topology.
- **Default permission mode is `bypassPermissions`** — the most permissive of the four
  modes — in *both* the UI (`INITIAL_PERMISSION_MODE`,
  `frontend/src/hooks/chat/usePermissionMode.ts:20`) and the API
  (`DEFAULT_PERMISSION_MODE`, `backend/utils/permissions.ts:29`).

  Combined, these two facts mean **anything that can reach the port can run arbitrary
  shell commands as the operating user**. The project documents this candidly rather than
  hiding it (`README.md:286-294`, `CLAUDE.md` "Permission Mode Switching").

**What partially mitigates it** — and this is real, not token effort:

- Binds `127.0.0.1` by default; `--host` is required to widen
  (`README.md:150`).
- `warnIfPermissionsExposed()` emits an explicit startup warning when a permissive
  default is paired with a non-loopback bind (`backend/utils/permissions.ts:64-77`).
- `resolvePermissionMode()` validates the wire value at runtime and returns `400` for
  anything not in `VALID_PERMISSION_MODES`, precisely because "the wire type is erased at
  runtime, so an untrusted body could otherwise put an arbitrary string on the CLI's
  `--permission-mode` flag" (`backend/utils/permissions.ts:38-55`, enforced at
  `backend/handlers/chat.ts:120-131`).
- The CLI's own `permissions.disableBypassPermissionsMode` setting — including via managed
  policy — overrides the app's default (`backend/utils/permissions.ts:20-23`).

So the *mechanism* is careful; the *default posture* is wide open. That is a deliberate
product choice for unattended local driving, and it is the single largest blocker to any
remote-access use case.

### 3.2 Chat & Streaming Experience — **maturity 4**

- Real-time streaming of Claude Code output via NDJSON (`backend/handlers/chat.ts`).
- Stream parsing is a layered pipeline: `useClaudeStreaming` →
  `hooks/streaming/useStreamParser.ts` → `hooks/streaming/useMessageProcessor.ts` →
  `utils/UnifiedMessageProcessor.ts` (590 lines).
- **Two independent noise filters**, both documented and both tested:
  - `IGNORED_SDK_MESSAGE_TYPES` (`frontend/src/hooks/streaming/useStreamParser.ts`) drops
    wide-union top-level SDK types such as `rate_limit_event`, which arrives once per turn.
  - `NON_DISPLAYED_SYSTEM_SUBTYPES` (`frontend/src/utils/UnifiedMessageProcessor.ts`) drops
    internal `type: "system"` subtypes (`init`, `hook_started`, `hook_progress`,
    `hook_response`, `thinking_tokens`, `background_tasks_changed`, `task_started`).
- Unrecognised message types warn **once per page load**, not once per occurrence — a
  small but telling piece of polish (`CLAUDE.md`).
- `init` is filtered from *display only* and still processed, because `setHasReceivedInit`
  gates session-id capture; dropping it would silently break continuity. A test locks the
  pairing in (`frontend/src/hooks/useClaudeStreaming.test.ts`).
- Rendering: assistant text through Astryx `Markdown`, long output through `CodeBlock`
  with `isCollapsible` truncation, tool invocations through `ChatToolCalls`
  (`CLAUDE.md`, "Chat UI").
- **Abort**: `POST /api/abort/:requestId`, a shared `Map<string, AbortController>` on the
  server (`backend/handlers/chat.ts:46-48, 94-99`), `Escape` key on the client
  (`KEYBOARD_SHORTCUTS.ABORT`, `frontend/src/utils/constants.ts:7`), managed by
  `frontend/src/hooks/chat/useAbortController.ts`. Aborts are reported as a distinct
  `aborted` stream type rather than as an error, because the SDK exports `AbortError` as
  a real runtime value (`backend/handlers/chat.ts:83-86`).
- **Session continuity**: frontend extracts `session_id` from SDK messages and passes it
  back as `sessionId`, which the backend forwards to the SDK as `options.resume`
  (`backend/handlers/chat.ts:66`).

This area is genuinely mature. The edge cases handled here (filter blocklists, once-per-load
warnings, abort-vs-error discrimination) are the kind normally found only after real usage.

### 3.3 Tool Execution, Permissions & Safety — **maturity 4 (mechanism) / 1 (default)**

- All four Claude CLI permission modes are exposed and cycled from the UI:
  `bypassPermissions` → `default` → `plan` → `acceptEdits`
  (`frontend/src/hooks/chat/usePermissionMode.ts`).
- Cycled via the chat input footer or **`Ctrl+Shift+M`**
  (`KEYBOARD_SHORTCUTS.PERMISSION_MODE_TOGGLE`, `frontend/src/utils/constants.ts:9`).
- Two distinct approval surfaces:
  - `frontend/src/components/chat/PermissionInputPanel.tsx` — per-tool approval
  - `frontend/src/components/chat/PlanPermissionInputPanel.tsx` — plan review/approve
    (has its own test file)
- Tool-name and command parsing for allowlisting lives in
  `frontend/src/utils/toolUtils.ts` (139 lines, with a 171-line test file). It understands
  multi-word commands (`cargo`, `git`, `npm`, `yarn`, `docker`), a wildcard, compound
  command separators (`&&`, `||`, `;`, `|`), and a conservative list of 16 Bash builtins
  that never need approval (`frontend/src/utils/constants.ts:23-49`).
- `allowedTools` is a first-class field on the wire contract (`shared/types.ts:11`).

**Gap**: permission mode is **not persisted** — `usePermissionMode` is plain React state
and explicitly resets on reload ("No localStorage persistence",
`frontend/src/hooks/chat/usePermissionMode.ts:23-26`). There is a
`STORAGE_KEYS.PERMISSION_MODE` key defined in `frontend/src/utils/storage.ts:10` but it is
labelled *legacy* and nothing writes it. So every page reload silently returns the user to
`bypassPermissions`.

### 3.4 Session & Conversation Management — **maturity 3**

- Conversation history is read from Claude Code's own JSONL transcripts. The parsing stack
  is substantial: `backend/history/parser.ts` (206), `conversationLoader.ts` (144),
  `timestampRestore.ts` (123), `grouping.ts` (117), `pathUtils.ts` (65).
- Two endpoints: list summaries, fetch one conversation (`shared/types.ts:38-61`).
- `ConversationSummary` carries `sessionId`, `startTime`, `lastTime`, `messageCount`,
  `lastMessagePreview` — enough for a useful list view.
- UI: `frontend/src/components/HistoryView.tsx` + `chat/HistoryButton.tsx`, loaded by
  `frontend/src/hooks/useHistoryLoader.ts`.

**Absent** (searched for each): conversation **search** across sessions; **forking** a
session from a past turn; **checkpoint / rewind / undo**; renaming or starring a
conversation; deleting a conversation; exporting a transcript; cross-project history view.

### 3.5 Project & Workspace Management — **maturity 4**

This is PDLC Studio's most polished surface and the one it should defend.

`ProjectSelector` renders an **Xcode-style launch window**: a single rounded panel split
60/40, identity and actions left, Recent Projects right (`CLAUDE.md`, "Launch screen").

Three actions, all converging on "a directory path to open":

| Action | Flow | Endpoint |
| --- | --- | --- |
| Create New Project… | `NewProjectDialog` → pick parent → name → optional `git init` | `POST /api/projects/create` |
| Clone Git Repository… | `CloneRepositoryDialog` → remote URL + parent dir | `POST /api/projects/clone` |
| Open Existing Project… | `DirectoryPickerDialog` directly | — |

`DirectoryPickerDialog` (`frontend/src/components/DirectoryPickerDialog.tsx`, with tests)
is shared by all three. Its selection model deliberately matches native folder pickers:
**the selection is always the directory currently being browsed**, so there is no separate
selected-vs-open state per row.

Recent Projects comes from `~/.claude.json` and only lists directories that already have
conversation history — so a freshly created or cloned directory will not appear there until
used. This is a known, documented rough edge.

`CloneRepositoryRequest.url` accepts https/http/ssh/git schemes and scp-style
`user@host:path` (`shared/types.ts:94-101`), validated server-side with a rejection message
naming the accepted forms (`backend/handlers/projectSetup.ts:157`).

**Command-injection posture is sound here**: `git` is invoked through
`runtime.runCommand("git", ["clone", "--", url, target])` — an argv array, never a shell
string, with an explicit `--` terminator before the user-supplied URL
(`backend/handlers/projectSetup.ts:193`). Same for `git init`
(`backend/handlers/projectSetup.ts:115`). `git init` deliberately scaffolds no files.

**Absent**: per-project settings or config UI; project rename/delete from the UI; project
grouping or favourites; manually adding a path that Claude has never seen (only via the
three dialogs, which is arguably sufficient).

### 3.6 Code & File Interaction — **maturity 0**

**Nothing.** There is no file explorer, no code editor, no syntax-highlighted file view,
no diff viewer, no file save.

Searched for: `CodeMirror`, `monaco`, `@uiw/react-codemirror`, `ace`, `prism`,
`highlight.js`, `FileTree`, `FileExplorer`, `editor`, `diff` across `frontend/package.json`
and `frontend/src/`. The only adjacent capability is `GET /api/directories`, which lists
**directories only and omits files entirely** (`shared/types.ts:74-83`, "Subdirectories of
`path`, name-sorted. Files are omitted.").

The user sees file contents only when Claude itself prints them into the transcript, where
they render through Astryx `CodeBlock`.

### 3.7 Version Control — **maturity 1**

Git exists in the product only as **two write-once operations**:

- `initGit?: boolean` on project creation (`shared/types.ts:91`)
- `POST /api/projects/clone` → `git clone` (`backend/handlers/projectSetup.ts`)
- `BrowseDirectoriesResponse.isGitRepository` — a read-only boolean shown in the picker
  (`shared/types.ts:82`)

There is **no** git status, stage, commit, branch, checkout, push, pull, log, blame, or
diff UI. Searched for: `git status`, `git commit`, `git diff`, `branch`, `stage`, `isomorphic-git`,
`simple-git` — no hits beyond the two operations above.

### 3.8 Terminal & Shell Access — **maturity 0**

No embedded terminal. Searched for: `xterm`, `xterm.js`, `node-pty`, `pty`, `terminal`,
`shell` in `frontend/package.json` and `frontend/src/` — no hits.

Shell commands reach the machine only indirectly, through Claude's own `Bash` tool.

### 3.9 Agent Configuration & Extensibility — **maturity 1**

- **System prompt**: explicitly opts into Claude Code's own preset
  (`systemPrompt: { type: "preset", preset: "claude_code" }`,
  `backend/handlers/chat.ts:62-65`). The comment there is worth preserving: the Agent SDK
  sends an *empty* system prompt otherwise, so removing that line silently strips tool
  guidance and CLAUDE.md handling.
- **Settings sources**: left at the SDK default, so `user`, `project`, and `local`
  filesystem settings — and therefore `CLAUDE.md` and `settings.json` — are picked up with
  no extra configuration (`CLAUDE.md`, "The system prompt is opt-in").
- **Slash commands**: handled by *naively stripping the leading `/`* and forwarding the
  rest as the prompt (`backend/handlers/chat.ts:39-44`). There is **no** slash-command
  picker, autocomplete, discovery list, or argument hinting in the UI.

**Absent**: MCP server management UI (the Playwright MCP config in `CLAUDE.md` is for
*developing* PDLC Studio, not a user-facing feature); subagent/agent management; hooks
configuration UI; custom command authoring; `@`-mention file references; tool allowlist
editing UI (the *plumbing* exists via `allowedTools`, but nothing in the UI writes it).

### 3.10 Model, Cost & Usage Observability — **maturity 1**

- No model selector. `query()` is called with no `model` option
  (`backend/handlers/chat.ts:50-70`), so the CLI's own default applies.
- No cost display, no token counter, no usage dashboard, no rate-limit surfacing.
  `rate_limit_event` is explicitly *silenced* (`IGNORED_SDK_MESSAGE_TYPES`).
- Usage data does flow through the fixtures layer (`makeUsage`, `makeResultUsage` in
  `frontend/src/utils/sdkFixtures.ts`), so the shape is available — it is simply never
  rendered.
- Structured logging exists server-side (`backend/utils/logger.ts`, 86 lines) with
  per-area namespaces (`logger.chat`, `logger.cli`) and a `--debug` flag, but this is
  operator-facing stdout, not product telemetry.

### 3.11 Multimodal & Rich Input — **maturity 0**

No image upload, no file attachment, no drag-and-drop, no clipboard-image paste, no voice
input, no audio. `ChatRequest.message` is a bare `string` (`shared/types.ts:8`) — the wire
contract itself has no room for attachments.

Searched for: `FormData`, `multipart`, `upload`, `File`, `Dropzone`, `paste`, `whisper`,
`MediaRecorder`, `getUserMedia`, `SpeechRecognition` — no hits in `frontend/src/`.

### 3.12 Mobile, Responsive & PWA — **maturity 2**

- The README claims "Mobile-responsive design — touch-optimized interface for any device"
  (`README.md:90`) and ships mobile screenshots at iPhone-SE width
  (`docs/.reference/images/screenshot-mobile-*.png`).
- Responsive behaviour in code is thin: `MESSAGE_CONSTANTS.MAX_DISPLAY_WIDTH` distinguishes
  `MOBILE: "85%"` from `DESKTOP: "70%"` (`frontend/src/utils/constants.ts:14-17`); the rest
  is whatever Astryx's own responsiveness provides.
- **No PWA.** Searched `frontend/index.html`, `frontend/vite.config.ts`, and
  `frontend/package.json` for `manifest`, `service-worker`, `serviceWorker`, `workbox`,
  `vite-plugin-pwa` — **zero hits**. `frontend/public/` contains exactly two files, both
  SVG marks. The only mobile-adjacent tag is
  `<link rel="apple-touch-icon" href="/pdlc-studio-mark.svg">`
  (`frontend/index.html:14`), which is an icon, not installability.
- No mobile-specific navigation (no bottom nav, no drawer), no offline support, no push
  notifications.
- **Accessibility defect**: the viewport meta sets `user-scalable=no`
  (`frontend/index.html:15`), which disables pinch-zoom on mobile. This fails
  [WCAG 2.1 SC 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html)
  and is at odds with the otherwise strong a11y discipline in §3.13. It is a one-line fix
  and is picked up as a candidate in the roadmap.

The honest reading: *responsive*, yes. *A mobile app experience*, no.

### 3.13 Design System, Theming & Accessibility — **maturity 5**

The strongest area, and a genuine differentiator.

- Built entirely on **Astryx** (neutral theme), composed from real components — `ChatLayout`,
  `ChatMessageList`, `ChatMessage`/`ChatMessageBubble`, `ChatComposer`, `ChatToolCalls`,
  `Markdown`, `CodeBlock` (`CLAUDE.md`, "Chat UI").
- **No Tailwind, no utility classes.** App CSS is restricted to a handful of app-shell
  classes (`.app-shell`, `.app-scroll`, `.app-chat-region`, `.launch-*`) in
  `frontend/src/index.css`, styled with Astryx tokens.
- The stylesheet chain order is load-bearing and maps to a layer cascade
  (`reset` → `astryx-base` → `astryx-theme`, then unlayered app CSS).
- **Dark mode** via CSS `light-dark()` tokens resolving against `color-scheme`. There is no
  `.dark` class. `<Theme>` owns it; components must never write `data-theme` or
  `color-scheme` themselves (`frontend/src/components/AstryxProvider.tsx`).
- Automatic system-preference detection with `prefers-color-scheme`
  (`frontend/src/utils/storage.ts:61-62`).
- **Testing discipline**: the project mandates asserting on behaviour and state
  (`data-selected`, `aria-*`, roles) and *never* on generated StyleX class names
  (`CLAUDE.md`, "Testing note"). That is a genuine a11y-positive constraint.
- Original brand artwork with two optical sizes and an automated drift test:
  `AppIcon.test.tsx` compares dot positions and path data across `brand/`,
  `frontend/public/`, and the inlined geometry in `AppIcon.tsx`, failing `make check` if a
  `make sync-brand` was forgotten.

Keyboard support is real but small: three shortcuts total — `Escape` (abort), `Enter`
(submit, with configurable behaviour), `Ctrl+Shift+M` (permission mode)
(`frontend/src/utils/constants.ts:5-10`).

### 3.14 Platform, Distribution & Deployment — **maturity 4**

- **Single-file binaries** via `deno compile` for Linux x64/arm64 and macOS x64/arm64.
  **Windows is not supported** (`CLAUDE.md`, "Single Binary Distribution").
- Binary size was a fought-for win: `npm ci --omit=dev --omit=optional` plus
  `--node-modules-dir=manual --no-check` took macOS arm64 from **428 MB → 94 MB**, and to
  **38 MB** as a compressed DMG. Linux ships as `.tar.gz` at **41 MB** (from 145 MB raw).
  `.tar.gz` over `.tar.xz` deliberately, so extraction never needs `xz-utils`.
- npm package `pdlc-studio` — but **npm publishing is opt-in and has never run**
  (gated on an `ENABLE_NPM_PUBLISH` repo variable; `CLAUDE.md`, "Release Process").
- Release is **one workflow dispatch**: bump, commit, tag, build five binaries, publish
  with generated notes (`.github/workflows/release.yml`).
- CLI flags: `--port`, `--host`, `--claude-path`, `--debug`, `--help`, `--version`
  (`backend/cli/args.ts`, `README.md:147-154`).
- **Universal Claude CLI path detection** — auto-discovery, script-path tracing with a
  temporary node wrapper, version validation, logged fallback — covering npm, pnpm, asdf,
  yarn, and Volta (`backend/cli/validation.ts`, 195 lines).

**Absent**: no Dockerfile, no docker-compose, no Helm/k8s manifests, no built-in tunnel
(ngrok/Cloudflare) support, no reverse-proxy config examples beyond prose advice.

### 3.15 Engineering Quality — **maturity 5**

- **Tests on both sides**: Vitest + Testing Library (frontend), Deno test runner (backend).
  Test files sit beside sources — `chat.test.ts`, `paths.test.ts`, `permissions.test.ts`,
  `pathUtils.test.ts`, `AppIcon.test.tsx`, `DirectoryPickerDialog.test.tsx`,
  `PlanPermissionInputPanel.test.tsx`, `usePermissionMode.test.ts`, `usePermissions.test.ts`,
  `usePlanApproval.test.ts`, `useStreamParser.test.ts`, `useClaudeStreaming.test.ts`,
  `toolUtils.test.ts`, `App.test.tsx`.
- **Lefthook** runs `make check` pre-commit; CI runs it on every push
  (`.github/workflows/ci.yml`).
- `make check` = format-check + lint + typecheck + test + build-frontend (`Makefile:60`).
- A dedicated `demo-comparison.yml` workflow — visual/demo regression checking.
- **Demo mode**: `/demo` route with a 787-line `mockResponseGenerator.ts` and
  `useDemoAutomation.ts`, enabling deterministic UI demonstration with no Claude CLI
  present. Dev-only (`frontend/src/App.tsx:10-16`).
- SDK fixtures are centralised in `frontend/src/utils/sdkFixtures.ts` so upgrade type-churn
  is fixed in one place rather than at every call site.
- `CLAUDE.md` is 598 lines of genuinely high-quality architectural documentation that
  records *why* decisions were made, including reversals (why `tagpr` was removed, why the
  old app mark was replaced).

**One notable gap**: `format:check` globs only `frontend/src/`, `frontend/scripts/`
(`frontend/package.json:14`) and `backend/**/*.ts` (`backend/package.json:51`). Markdown
under `docs/` — including this research pack — is **outside `make check`**.

---

## 4. Consolidated maturity snapshot

Scale defined in `05-feature-categories-and-maturity.md` (0 Absent → 5 Mature).

| # | Category | Maturity | One-line justification |
| --- | --- | --- | --- |
| 1 | Access, Identity & Security | **1** | No auth at all; `bypassPermissions` default. Mechanism careful, posture open. |
| 2 | Chat & Streaming Experience | **4** | NDJSON streaming, dual noise filters, abort-vs-error discrimination, tested. |
| 3 | Tool Execution & Permissions | **4** / 1 | All four modes + two approval panels; but default is the most permissive and mode is not persisted. |
| 4 | Session & Conversation Mgmt | **3** | Robust JSONL parsing and browse/restore; no search, fork, or checkpoint. |
| 5 | Project & Workspace Mgmt | **4** | Polished launch screen; create/clone/open share one picker. |
| 6 | Code & File Interaction | **0** | No explorer, editor, or diff. `/api/directories` omits files by design. |
| 7 | Version Control | **1** | `git init` and `git clone` only; no status/commit/diff. |
| 8 | Terminal & Shell Access | **0** | No xterm, no pty. |
| 9 | Agent Config & Extensibility | **1** | Preset system prompt + settings sources; slash commands are `/`-stripping only. |
| 10 | Model, Cost & Usage | **1** | No model picker, no cost/token display; `rate_limit_event` deliberately silenced. |
| 11 | Multimodal & Rich Input | **0** | `message` is a bare string; no attachments or voice. |
| 12 | Mobile, Responsive & PWA | **2** | Responsive widths only; no manifest, no service worker, no mobile nav. |
| 13 | Design System & A11y | **5** | Astryx throughout, `light-dark()` theming, behaviour-based test discipline. |
| 14 | Platform & Distribution | **4** | Compressed single binaries, one-command release, universal CLI detection. No Docker, no Windows. |
| 15 | Engineering Quality | **5** | Tests both sides, Lefthook + CI, demo mode, exceptional architectural docs. |

**Mean maturity: 2.4.** The distribution is strongly bimodal — six categories at 4–5, six
at 0–1. There is very little in the middle, which is exactly the profile of a project that
built one workflow properly and has not yet broadened.

---

## 5. What PDLC Studio does better than most alternatives

Worth stating plainly, because the comparison document should not read as a list of
deficits:

1. **Architectural documentation.** `CLAUDE.md` records rationale, tradeoffs, and reversals.
   Very few projects at this size have anything comparable.
2. **Design-system rigour.** A real component system with enforced theming and a
   no-utility-class rule, rather than ad-hoc styling.
3. **Distribution.** A 38 MB self-contained binary with no runtime prerequisites beyond the
   user's own Claude CLI.
4. **Runtime portability.** The same handlers run on Deno and Node behind a 37-line
   abstraction.
5. **Streaming correctness.** The filter blocklists, the once-per-load warning, and the
   `init`-processed-but-not-displayed subtlety are the marks of real production use.
6. **Honesty about security.** The README's `[!CAUTION]` block states the exposure plainly
   instead of burying it.

These are the assets any roadmap should preserve, and they impose real constraints on how
new features get built — see the "Key constraints" section of each PRD.

---

## 6. Constraints any new feature must respect

Carried into every PRD in `prds/`:

| Constraint | Consequence |
| --- | --- |
| **No database** | Persistence must justify itself: JSON on disk under `~/.claude`, or a dependency that inflates every binary. |
| **`deno compile` single binary** | Every runtime dependency ships inside all five artifacts. The 428→94 MB fight is documented; don't undo it. |
| **Deno + Node runtime abstraction** | Handlers must not import `Deno.*` or `node:*` directly; go through `backend/runtime/`. |
| **Astryx only, no Tailwind** | New UI composes Astryx components; app CSS stays limited to app-shell classes. |
| **NDJSON, not WebSocket** | Server→client push outside a chat POST requires a *new* transport — a real architectural decision, not a small addition. |
| **Route ordering** | New `/api/projects/<literal>` routes must register before the `:encodedProjectName` param route. |
| **Windows unsupported** | Any pty/terminal work inherits this. |
| **`bypassPermissions` default + no auth** | Any feature widening network exposure must address this first. |
