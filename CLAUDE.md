# PDLC Studio

A web-based interface for the `claude` command line tool that provides streaming responses in a chat interface.

## Code Quality

Automated quality checks ensure consistent code standards:

- **Lefthook**: Git hooks manager running `make check` before commits
- **Quality Commands**: `make check` runs all quality checks manually
- **CI/CD**: GitHub Actions runs quality checks on every push

### Setup for New Contributors

```bash
# Install Lefthook
brew install lefthook  # macOS
# Or download from https://github.com/evilmartians/lefthook/releases

# Install and verify hooks
lefthook install
lefthook run pre-commit
```

## Architecture

### Backend (Deno/Node.js)

- **Location**: `backend/` | **Port**: 8080 (configurable)
- **Technology**: TypeScript + Hono framework with runtime abstraction
- **Purpose**: Executes `claude` commands and streams JSON responses

**Key Features**: Runtime abstraction, modular architecture, structured logging, universal Claude CLI path detection, session continuity, single binary distribution, comprehensive testing.

**API Endpoints**:

- `GET /api/projects` - List available project directories
- `POST /api/chat` - Chat messages with streaming responses (`{ message, sessionId?, requestId, allowedTools?, workingDirectory? }`)
- `POST /api/abort/:requestId` - Abort ongoing requests
- `GET /api/projects/:encodedProjectName/histories` - Conversation histories
- `GET /api/projects/:encodedProjectName/histories/:sessionId` - Specific conversation history
- `GET /api/directories?path=` - List subdirectories for the launch screen's folder picker. Omit `path` to list the home directory; `~` is expanded. Read-only, directories only, dot-directories hidden.
- `POST /api/projects/create` - Create a project directory (`{ parentPath, name, initGit? }`) → `{ path }`
- `POST /api/projects/clone` - `git clone` into a directory (`{ url, parentPath, name? }`) → `{ path }`
- `PUT /api/projects/:encodedProjectName/histories/:sessionId/star` - Star or unstar a conversation (`{ isStarred }`)
- `GET /api/commands?workingDirectory=` - Slash commands available to the composer's `/` picker → `{ commands }`

The `create` and `clone` routes are registered **before** the parameterised
`/api/projects/:encodedProjectName/...` routes, so "create" and "clone" are not
captured as project names.

### Frontend (React)

- **Location**: `frontend/` | **Port**: 3000 (configurable)
- **Technology**: Vite + React + SWC + TypeScript + Astryx design system + React Router
- **Purpose**: Project selection and chat interface with streaming responses

**Key Features**: Project directory selection, routing system, conversation history, demo mode, real-time streaming, theme toggle, auto-scroll, accessibility features, modular hook architecture, request abort functionality, permission dialog handling, configurable Enter key behavior.

#### Launch screen (`/`)

`ProjectSelector` renders an Xcode-style launch window: one rounded panel split
60/40, app identity and actions on the left, Recent Projects on the right.

All three actions funnel into the same place — a directory path that gets opened
as a project:

| Action                   | Flow                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Create New Project...    | `NewProjectDialog` → pick a parent via the folder picker, name it, optional `git init` → `POST /api/projects/create` |
| Clone Git Repository...  | `CloneRepositoryDialog` → remote URL + parent directory → `POST /api/projects/clone`                                 |
| Open Existing Project... | `DirectoryPickerDialog` directly                                                                                     |

`DirectoryPickerDialog` is shared by all three. **The selection is always the
directory currently being browsed**, matching native folder pickers: navigate
into the folder you want, then confirm. That avoids a separate
selected-vs-open state per row.

**Recent Projects comes from `~/.claude.json`** and only lists directories that
already have conversation history, so a newly created or cloned directory will
not appear there until it has been used. Opening it still works — the list is
just not the only way in any more, which was the point of this screen.

The version string is injected at build time by `vite.config.ts` reading
`backend/package.json` (exposed as `__APP_VERSION__`, declared in
`src/vite-env.d.ts`). `frontend/package.json` stays at `0.0.0` and is not the
release version.

Layout chrome lives in the `.launch-*` classes in `src/index.css` because Astryx
has no split-panel or grid primitive and `Card` cannot clip a child's background
to its own rounded corners. Everything inside is composed from Astryx
components. Two token gotchas are documented inline there: `--radius-xl` does
not exist (`--radius-page` does), and `--color-background-muted` is defined
identically to `--color-background-body` in theme-neutral, so it yields no
contrast.

The panel sits on a **gradient halo** in the app mark's own blue-to-green sweep,
plus `--shadow-med` for neutral depth — the gradient carries the hue, the shadow
carries the lift. `box-shadow` cannot take a gradient, so the halo is a blurred
pseudo-element, and it needs the extra `.launch-panel-glow` wrapper because the
panel's `overflow: hidden` (which clips the aside) would otherwise clip it too.

Its strength is baked into the gradient's **alpha values, not `opacity`**.
`light-dark()` is a colour function: `opacity: light-dark(a, b)` is invalid, so
the declaration is dropped and the glow silently renders at full strength — it
first shipped looking like neon trim for exactly that reason. Keep the alphas
low (13% light / 18% dark); this should read as depth, not decoration.

### Design System (Astryx)

The UI is built on [Astryx](https://github.com/facebook/astryx) with the **neutral** theme. There is no Tailwind and no utility-class styling — build UI by composing Astryx components.

**Packages**: `@astryxdesign/core` and `@astryxdesign/theme-neutral` (both pinned to an exact version, because the theme peer-depends on an exact core version), plus `@stylexjs/stylex` as a required peer and `lucide-react` for icons outside Astryx's semantic icon set.

**No build plugin required.** Astryx ships pre-built CSS and JS, so `@astryxdesign/build` (which peers Vite 8) is deliberately _not_ used and there is no StyleX compilation step. The stylesheet chain in `src/index.css` must keep its order, since it maps to the layer cascade:

```
@astryxdesign/core/reset.css      -> @layer reset
@astryxdesign/core/astryx.css     -> @layer astryx-base  (also declares :root tokens)
@astryxdesign/theme-neutral/theme.css -> @layer astryx-theme
```

App CSS below that block is unlayered and so overrides all Astryx layers. Keep it to the few app-shell classes that already exist (`.app-shell`, `.app-scroll`, `.app-chat-region`), styled with Astryx tokens (`var(--spacing-4)`, `var(--color-border)`, ...). Do not add utility classes.

**Theming and dark mode**: light/dark comes from CSS `light-dark()` tokens that resolve against `color-scheme`. `<Theme>` (in `components/AstryxProvider.tsx`) owns this — it sets `color-scheme` on its wrapper and mirrors `data-theme` onto `<html>`. There is no `.dark` class. Never write `data-theme`/`color-scheme` from a component; to override the theme for a subtree (as the demo route does for `?theme=`), nest another `<Theme>`.

**Chat UI**: prefer the purpose-built Chat group over hand-rolled equivalents — `ChatLayout` (owns scrolling, auto-scroll, scroll-to-bottom, and the empty state), `ChatMessageList`, `ChatMessage`/`ChatMessageBubble`, `ChatComposer`, and `ChatToolCalls` for tool invocations and results. Assistant text renders through `Markdown`; long output through `CodeBlock` (`isCollapsible` handles truncation).

**Discovering component APIs**: use the CLI rather than guessing props — `npx @astryxdesign/cli component <Name>`, `--list` to browse, `npx @astryxdesign/cli docs theme` for theming. `npx @astryxdesign/cli init` can write the full component index into this file.

**Testing note**: assert on behavior and state (`data-selected`, `aria-*`, roles), never on generated StyleX class names.

### App Mark

The icon is **original artwork** — a shell prompt at the centre of a ring of
graduated dots. It replaced a mark taken from the selfh.st icon set that
appeared to be InvokeAI's logo.

`brand/` is the canonical, editable source and has its own README covering the
palette, the construction, and the editing gotchas. Two things matter here:

**Two optical sizes, one identity.** `brand/pdlc-studio-mark.svg` carries 22
dots plus a glyph, which is more detail than a 16px favicon has pixels for;
below 32px it reduces to a coloured smudge. `brand/pdlc-studio-mark-small.svg`
drops the ring and grows the prompt to fill the tile. `AppIcon` switches between
them on `SMALL_SIZE_THRESHOLD`, so the 88px launch screen gets the ring and the
16px favicon does not. Both keep an ink tile so the icon does not change
character between sizes.

The threshold is a CSS-pixel size, but what matters is device pixels: at DPR 2 a
28px mark gets 56 real ones and the ring holds. Branching on DPR would make the
icon change shape when a window moves between displays, so call sites that want
the ring below the threshold pass `variant="mark"` instead — the demo header
does, at 28px. The chat header sits at 32px, exactly on the threshold, and keeps
`variant="mark"` explicit so lowering the size later cannot silently drop the
ring.

In the chat header the mark is also a link home, wrapped in `.app-mark-button` —
a bare `<button>` rather than Astryx's `IconButton`, which would box the mark in
padding and a hover fill it does not need, since the artwork carries its own
tile.

Its vertical alignment is deliberate. The surrounding `HStack` uses
`vAlign="start"`, not `"center"`: the text beside it is a `VStack` that grows a
second row once a working directory is open, and centring against that two-row
block drops the mark ~16px below the app name. Aligning tops leaves a residual
half the height difference between the 32px mark and the 28px name row, which
`.app-mark-button` cancels with a derived negative margin.

**The mark lives in three places and nothing keeps them in sync automatically.**
`brand/` is the source, `frontend/public/` holds the copies Vite serves as
favicon and apple-touch-icon, and `AppIcon.tsx` inlines the geometry so it
cannot flash in late on a cold load. Run `make sync-brand` after editing;
`AppIcon.test.tsx` compares dot positions and path data across all three and
fails if they drift, so a forgotten sync is caught by `make check`.

Two traps worth knowing before touching it:

- `gradientUnits="userSpaceOnUse"` is load-bearing. Under the default
  `objectBoundingBox` every dot gets the whole blue-to-green ramp across its own
  few pixels and the ring comes out uniformly muddy.
- The gradient id is derived from `useId()` with **all** non-alphanumerics
  stripped, not just colons. `useId` returns `:r1:` on React 18 and `«r1d»` on
  19, and neither is a valid XML `NameChar`. Browsers resolve `url(#...)` by
  exact string match and tolerate both, so this fails silently rather than
  visibly.

### Shared Types

**Location**: `shared/` - TypeScript type definitions shared between backend and frontend

**Key Types**: `StreamResponse`, `ChatRequest`, `AbortRequest`, `ProjectInfo`, `ConversationSummary`, `ConversationHistory`

## Claude Command Integration

Backend uses the Claude Agent SDK (`query()`) executing commands with:

- `--output-format stream-json` - Streaming JSON responses
- `--verbose` - Detailed execution information
- `-p <message>` - Prompt mode with user message

**Message Types**: System (initialization), Assistant (response content), Result (execution summary)

### Claude CLI Path Detection

Universal detection supporting npm, pnpm, asdf, yarn installations:

1. Auto-discovery in system PATH
2. Script path tracing with temporary node wrapper
3. Version validation with `claude --version`
4. Fallback handling with logging

**Implementation**: `backend/cli/validation.ts` with `detectClaudeCliPath()`, `validateClaudeCli()`

**Why this is still here.** The Agent SDK ships its own Claude Code executable
as platform-specific optional dependencies and would use it if
`pathToClaudeCodeExecutable` were omitted. This app deliberately keeps pointing
the SDK at the user's own installed CLI, which is what makes the single-binary
distribution work without bundling a platform binary per target.

The tradeoff: the SDK version and the CLI it drives are now independent, so a
user whose installed `claude` is much older or newer than the SDK's
`claudeCodeVersion` is a supported-but-untested combination. If sessions fail to
start with protocol-ish errors, compare `claude --version` against the SDK's
`claudeCodeVersion` before looking anywhere else. Dropping
`pathToClaudeCodeExecutable` (and `executable: "node"`) in
`backend/handlers/chat.ts` switches to the bundled executable and removes the
skew, at the cost of bundling binaries into the build.

## Session Continuity

Conversation continuity using the Claude Agent SDK's session management:

1. First message starts new Claude session
2. Frontend extracts `session_id` from SDK messages
3. Subsequent messages include `session_id` for context
4. Backend passes `session_id` to SDK via `options.resume`

## MCP Integration (Model Context Protocol)

Playwright MCP server integration for automated browser testing and demo verification.

### Configuration

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### Usage

1. Say "**playwright mcp**" in requests for browser automation
2. Visible Chrome browser window opens for interaction
3. Manual authentication supported through browser window

**Available Tools**: Navigation, interaction, screenshots, content access, file operations, tab management, dialog handling

## Development

### Prerequisites

- Backend: Deno or Node.js (22.9.0+)
- Frontend: Node.js
- Claude CLI tool installed

The Node floor is 22.9 because the dev task loads `.env` with
`--env-file-if-exists`, which has no Node 20 backport. Plain `--env-file`
exists from 20.6 but _errors_ when the file is missing, and `.env` is
gitignored and absent by default.

### Port Configuration

Create `.env` file in project root:

```bash
PORT=9000
```

Both dev tasks pick it up on their own — Vite reads it for the frontend, and
the backend passes it to the runtime (`--env-file-if-exists` for Node,
`--env-file` for Deno, which warns rather than failing when it is absent).

**The compiled binary does not.** It reads the environment it is handed, and
rejects `--env-file` outright, since argv goes to commander rather than to the
runtime. Use `PORT=9000 pdlc-studio`, the `--port` flag, or
`set -a; . ./.env; set +a` before launching. This is why no `.env` loader is a
dependency of this project.

### Running the Application

```bash
# Backend
cd backend
deno task dev        # Deno
npm run dev          # Node.js
# Add --debug for debug logging

# Frontend
cd frontend
npm run dev
```

**Access**: Frontend http://localhost:3000, Backend http://localhost:8080

### Project Structure

```
├── backend/              # Server with runtime abstraction
│   ├── cli/             # Entry points (deno.ts, node.ts, args.ts, validation.ts)
│   ├── runtime/         # Runtime abstraction (types.ts, deno.ts, node.ts)
│   ├── handlers/        # API handlers (chat.ts, projects.ts, histories.ts, etc.)
│   ├── history/         # History processing utilities
│   ├── middleware/      # Middleware modules
│   ├── utils/           # Utility modules (logger.ts)
│   └── scripts/         # Build and packaging scripts
├── frontend/            # React application
│   ├── src/
│   │   ├── config/      # API configuration
│   │   ├── utils/       # Utilities and constants
│   │   ├── hooks/       # Custom hooks (streaming, theme, chat state, etc.)
│   │   ├── components/  # UI components (chat, messages, dialogs, etc.)
│   │   ├── types/       # Type definitions
│   │   └── contexts/    # React contexts
├── brand/               # Canonical app mark SVGs (see brand/README.md)
├── shared/              # Shared TypeScript types
└── CLAUDE.md           # Technical documentation
```

## Key Design Decisions

1. **Runtime Abstraction**: Platform-agnostic business logic with minimal Runtime interface
2. **Universal CLI Detection**: Tracing-based approach for all package managers
3. **Raw JSON Streaming**: Unmodified Claude responses for frontend flexibility
4. **Modular Architecture**: Specialized hooks and components for maintainability
5. **TypeScript Throughout**: Consistent type safety across all components
6. **Project Directory Selection**: User-chosen working directories for contextual file access

## Claude Agent SDK Types Reference

**SDK Types**: `frontend/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`

```typescript
// Type extraction
const systemMsg = sdkMessage as Extract<SDKMessage, { type: "system" }>;
const assistantMsg = sdkMessage as Extract<SDKMessage, { type: "assistant" }>;

// Content access patterns
for (const item of assistantMsg.message.content) {
  if (item.type === "text") {
    const text = (item as { text: string }).text;
  }
}

// System message (direct access, no nesting)
console.log(systemMsg.cwd);
```

**Key Points**: System fields directly on object, Assistant content nested under `message.content`, Result has `subtype` field

### `type: "system"` is a wide union

Only `subtype: "init"` is the session banner. Compaction boundaries, status
updates, hook progress, task notifications and much more all arrive as
`type: "system"` with a different `subtype`. Narrow on `subtype` before reading
`init`-only fields (`tools`, `cwd`, `model`). The app models this as
`SDKSystemLikeMessage` in `frontend/src/types.ts`, and
`SystemMessageComponent` falls back to a JSON dump for subtypes it has no
dedicated rendering for.

**Display filtering**: because that fallback would otherwise dump SDK telemetry
into the transcript, `NON_DISPLAYED_SYSTEM_SUBTYPES` in
`frontend/src/utils/UnifiedMessageProcessor.ts` keeps the purely-internal
subtypes out of the UI (`init`, `hook_started`, `hook_progress`,
`hook_response`, `thinking_tokens`, `background_tasks_changed`,
`task_started`).

It is a **blocklist**, so a future SDK version can add a noisy subtype that
shows up until it is listed there — `background_tasks_changed` and
`task_started` were found exactly that way, by watching a live session rather
than by reading the types. If this keeps happening, invert it to an allowlist of
the subtypes the UI actually renders. The parameterised test in
`useClaudeStreaming.test.ts` iterates the exported list, so adding a subtype
there gets coverage for free.

There is a **second, separate** filter for the top-level `type`:
`IGNORED_SDK_MESSAGE_TYPES` in `frontend/src/hooks/streaming/useStreamParser.ts`.
The SDK's union is much wider than the four types this app renders, and some of
the rest arrive constantly — `rate_limit_event` comes once per turn. Listing
them there keeps them silent.

Anything genuinely unrecognised still warns, but **once per page load rather
than once per occurrence**, so a new SDK message type is visible without
flooding the console. If a type turns out to be expected, add it to
`IGNORED_SDK_MESSAGE_TYPES`.

`init` is filtered from **display only**. It must still be processed, because
`setHasReceivedInit(true)` is what allows `session_id` to be picked up from
subsequent assistant messages — dropping init entirely silently breaks session
continuity. `processSystemMessage` runs that side effect before filtering, and
`useClaudeStreaming.test.ts` locks the pairing in.

Assistant _thinking_ content and `result`/`success` messages are unaffected —
they arrive as assistant content blocks and `type: "result"` respectively, not
as `type: "system"`.

### Assistant payloads use the Anthropic API `Beta*` types

`SDKAssistantMessage["message"]` is a `BetaMessage` and `SDKUserMessage["message"]`
is a `MessageParam` — only the former has an `id`, and `MessageParam.content`
may be a plain string rather than a block array. A tool_use block's `input` is
typed `unknown`. Because these types come from the `@anthropic-ai/sdk` peer
dependency, they resolve properly and are enforced; narrow rather than assume.

Constructing these shapes by hand requires a lot of required bookkeeping
(`cache_creation`, `iterations`, `citations`, `stop_details`, …), so demo-mode
and test fixtures build them via the factories in
`frontend/src/utils/sdkFixtures.ts` (`makeUsage`, `makeResultUsage`,
`makeTextBlock`, `makeAPIAssistantMessage`, `makeSystemInitMessage`,
`firstContentBlock`) instead of casting.

### The system prompt is opt-in

`query()` sends an **empty** system prompt unless `systemPrompt` is set — the
Agent SDK is a generic agent harness, not Claude Code, by default. This app
passes `{ type: "preset", preset: "claude_code" }` in `backend/handlers/chat.ts`
to get the CLI's own prompt. Removing that line silently strips tool guidance,
CLAUDE.md handling, and the rest of Claude Code's behaviour.

`settingSources`, by contrast, defaults to loading all filesystem settings
(`user`, `project`, `local`), so CLAUDE.md and `settings.json` are picked up
without extra configuration.

## New conversations and the sidebar

A conversation started in this tab has **no id in the URL** — the URL stays
`?new=1`, and the id only arrives with the SDK's init message. `activeSessionKey`
therefore falls back to `currentSessionId`, which is what lets the sidebar
highlight the row it just gained and the header name it. Deleting also compares
against that key, so deleting a conversation started in this tab closes it.

The URL is deliberately _not_ rewritten to `?sessionId=` mid-conversation:
`useAutoHistoryLoader` keys off that param and would refetch the transcript from
disk over the messages already in memory.

The header renders as soon as a conversation is active, showing **"Untitled
conversation"** until the CLI generates an `ai-title`.

The list refetches at two moments: the session becoming real, and a turn
finishing. Both are needed — the first makes the conversation appear, the second
picks up its generated name. The title is written asynchronously and not
reliably before the result message lands, so a refetch on completion alone often
reads the file just too early; a second pass `TITLE_SETTLE_MS` later catches it
without polling indefinitely.

## Panes and light mode

The chat route's panes (sidebar, transcript) are surfaces on the page
background. The two schemes need opposite treatments to get there: dark
separated on its own, because `--color-background-surface` is lighter than the
page. **Light did not separate at all** — measured, the shell, sidebar and
transcript were all `rgb(241,241,241)`, a contrast ratio of exactly `1.000`,
with a border at `1.055`. Light now uses the white card colour on the grey page
and steps the border up to `--color-border-emphasized` (`1.312` versus the
default border's `1.055`).

## Model, effort and thinking

The composer's control beside Send sets `model`, `effortLevel` and `thinking`
on the chat request, persisted in `AppSettings`.

**The model list comes from the CLI, not a hardcoded table.** It rides along on
the `/api/commands` response, because `initializationResult()` reports commands
_and_ models from one handshake — a separate `/api/models` would spawn a second
CLI process for data already in hand. Each model also reports whether it
honours effort and adaptive thinking, so the effort control can be disabled
rather than silently ignored. Only an explicit `supportsEffort: false` disables
it: the CLI leaves the flag undefined for some models, and greying out a
working control is worse than offering one the model ignores.

All three are **omitted from the request unless set**, so a user's own
`settings.json` defaults stand rather than being overridden on every message.

The popover's content is mounted only while open. Astryx's `Popover` otherwise
keeps it in the DOM, which put four comboboxes and thirteen options into the
accessibility tree for a panel that is shut — invisible, but reachable by a
screen reader. That is also why the composer's own tests query
`getByRole("combobox", { name: "Message" })` and scope option lookups to the
slash menu.

## Code syntax highlighting

Astryx's `CodeBlock` does the highlighting; theme-neutral supplies the colours
as `--color-syntax-*`. Markdown fenced blocks were already covered — `Markdown`
passes the fence's language straight through.

**Do not diagnose this by looking for token `<span>`s.** In Chrome `CodeBlock`
uses the CSS Custom Highlight API, so it colours a bare text node through
`::highlight()` and creates no elements at all; span mode is only a fallback for
Safari and browsers without the API. A DOM probe therefore shows an
"unhighlighted" block that is in fact highlighted. Check a screenshot.

The real gap was **tool results**. Only Edit (`diff`) and Bash (`bash`) implied a
language, so a `Read` of a source file rendered as plaintext — which is most of
the code this app displays. `ToolResultMessage.filePath` now carries the path
from the _request_ (a result returns contents with no indication of which file),
and `languageFromPath` maps its extension. Any tool naming a path qualifies,
unlike the Files tab which lists only tools that write: what is displayed needs
a language either way.

The extension table is deliberately limited to languages the CodeBlock tokenizer
knows. Returning `undefined` for the rest keeps a misleading language label off
the header, rather than promising highlighting that never arrives.

## Conversations sidebar

The chat route is two columns: the project's conversations on the left, the
transcript on the right (`.chat-shell`). Opening a project **no longer opens a
conversation** — arriving from the launch screen shows an empty state rather
than starting a session the user has to abandon.

Which conversation is open lives in the URL (`?sessionId=`, `?new=1`,
`?tab=files`), so reload and the back button behave and a link is shareable.

Refresh lives in the **sidebar header**, next to the project name and above
the list it reloads — not in the page header. It replaced a `+` that duplicated
the New Session button a few centimetres below it. Reloading matters because
conversations are files on disk: a `claude` session started in a terminal
writes into the same project directory, so the list can be stale through no
fault of this page.

There is **no separate conversation-history screen** any more, and no back
button: the sidebar lists every conversation at all times, so a second place to
browse them was redundant. `HistoryView` and `HistoryButton` were deleted with
it; `useHistoryLoader` remains, since loading a resumed transcript is still
needed.

The conversation's name and full session id render **inside the transcript
pane**, not in the page header — in the header they began at the far left of
the window and read as a sibling of the app name rather than as the title of
the pane on the right.

**Search filters on content, not just titles.** The sidebar's box passes `q` to
the existing histories endpoint, which scans each session's message text
server-side, where that text already is. Filtering happens _before_ grouping,
so a session whose only match is in an earlier, superseded file still counts —
grouping would have discarded that file as a duplicate. Input is debounced,
since a hit re-scans every message of every session in the project.

**Titles come from the session file**, not from the UI. Claude writes two kinds
into the JSONL: `custom-title` (set by `/rename`) and `ai-title` (generated).
A custom title wins; the parser takes the _last_ of each, since both are
appended per turn rather than replaced.

**Rename and delete go through the SDK** (`renameSession`, `deleteSession`), so
a rename here is the same operation as the CLI's `/rename` and shows up in
`claude --resume`. Both deliberately omit the SDK's `dir` option: the route
carries the _encoded_ project name, and decoding it back to a path is
ambiguous because the separator and a literal hyphen are the same character
(`-Users-me-pdlc-studio`). Session ids are UUIDs, so an unscoped lookup is both
simpler and correct. Clear-all enumerates the project's own history directory,
so it cannot reach beyond the project even though each delete is unscoped.

Note `getHistoriesUrl` and friends take the **encoded** name, not a filesystem
path — the parameter was once named `projectPath`, which read as though a raw
path would work.

## Attachments and the Files tab

Files are attached by dropping them anywhere on the composer or via the button
beside the permission-mode control. They upload immediately, so the chip shows
a real size and a failure surfaces while the user can still act on it.

**Claude is given paths, not bytes.** `withAttachments` appends a labelled block
of absolute paths to the message; the model opens what it needs with its own
tools. That is how the CLI works with files and keeps a 20MB PDF out of the
prompt entirely. Attachments land in a per-upload temp directory, never in the
project — an attachment is something you are showing Claude, not a change to
your repository.

The **Files tab** splits into "Uploaded by me" and "Generated by PDLC".
Attachments are always a flat list — they are whatever was dropped on the
composer and have no structure. Generated files offer both a list, in the order
they were written, and a tree, which sorts directories first and discards that
order in favour of location. `buildFileTree` makes paths relative to the project
root but leaves files outside it absolute, so an attachment in a temp directory
is not misfiled under the project.

Files created by **shell redirection** are picked up too, best-effort:
`shellRedirects.ts` tokenises the Bash command (quote-aware, so `echo "a > b"`
is not mistaken for a redirect) and takes stdout targets only. `2>`, `>&1` and
`/dev/*` are excluded, relative targets resolve against the working directory,
and a target that cannot be placed is dropped rather than guessed at — a row
pointing at a file that was never written is worse than a missing row.

It cannot tell whether the command ran or succeeded, and does not expand
variables or globs or follow `cp`, `mv`, `tee`, or heredocs. Those remain
invisible. It derives its list from the transcript: attached paths are
parsed back out of the user's own messages, and written paths come from
`ToolMessage.filePath`, captured at creation from the structured tool input.
Deriving rather than keeping a side list is what makes the tab work on a
_resumed_ conversation. Only genuinely file-producing tools count
(`Write`/`Edit`/`MultiEdit`/`NotebookEdit`) — `Read` also carries `file_path`,
and listing it would imply Claude created the file.

`GET /api/files` backs open and download. **It reads files off the machine and
the server has no authentication**, so it is confined to the named working
directory plus the attachments temp root, checked after resolving so `..`
cannot climb out and with a trailing separator so `/tmp-evil` is not treated as
inside `/tmp`. It always serves `application/octet-stream`: the bytes are
user-supplied, and a guessed type invites the browser to execute markup.

## Composer

### Auto-growing input

The composer grows with its content and stops at a ceiling, after which it
scrolls (`hooks/useAutoResizeTextarea.ts`, 40px–320px).

This is hand-rolled because **Astryx's `TextArea` has no auto-grow prop** — it
sizes from a fixed `rows` count, and `size` changes padding, not height. An
earlier note in `utils/constants.ts` claimed "TextArea owns composer sizing",
which is why the box stayed one row tall no matter how much was typed; that
note has been corrected.

The hook drives `style.height` on the element through a ref. Inline styles
outrank the component's own StyleX classes, so this sticks without patching the
design system. Two details are load-bearing: the height must collapse to `auto`
before every `scrollHeight` read (a box already taller than its content reports
its own height, not the content's), and the work happens in a layout effect so
the resize paints in the same frame. Astryx ships `resize: vertical`, which
`index.css` turns off — a manual drag would be undone by the next keystroke.

### Slash-command picker

Typing `/` opens a filterable menu of every command the user's Claude CLI
exposes: built-ins, user and project commands, skills, and plugin-provided
commands (`plugin:skill`). Arrow keys move, Enter or Tab inserts, Escape
dismisses without clearing the line, and matching is fuzzy — `srev` finds
`security-review`.

**The message reaches the SDK exactly as typed.** `backend/handlers/chat.ts`
used to strip a leading `/`, inherited from a time when the command was a CLI
argument. Under the Agent SDK the slash is what _marks_ the prompt as a command,
so stripping it turned `/compact` into the word "compact" — Claude answered it
in prose while no compaction ran, and every command the picker offers was
reaching the model as a message that happened to read like one.

**Discovery is the CLI's job.** `backend/handlers/commands.ts` opens a session
and awaits `initializationResult()`, whose `commands` field is the resolved
list. Nothing here knows where commands live on disk, so a newly added skill or
plugin needs no code change.

Two things make that cheap enough to do per project:

- The prompt is an async iterable that **never yields**, not a string. A string
  prompt would start a turn and bill a model call; the iterable lets the session
  come up, answer the handshake, and close having sent nothing.
- Results are cached per working directory (60s) with in-flight de-duplication,
  because every miss spawns a CLI process.

Discovery failure is deliberately silent — an empty list, never an error. The
picker is an accelerator over an input that works fine without it.

The composer's own open-condition is that the whole input is one unbroken
`/token`. A space means the user has moved on to arguments, so the menu closes
and Enter goes back to sending. That is also why inserting a command appends a
trailing space.

Note `SDKCommandsChangedMessage` (`subtype: "commands_changed"`) pushes a fresh
list mid-session; it is in `NON_DISPLAYED_SYSTEM_SUBTYPES` because it carries a
whole command array that would otherwise land in the transcript as JSON.

Command names are painted with the **app mark's gradient** (`brand/README.md`),
clipped to the glyphs so one sweep runs across each name. The brand ramp is used
verbatim in dark mode only: `brand/README.md` notes a blue-to-green sweep has
almost no contrast on a light tile, which bites harder on 13px text than on the
icon, so light mode uses the same four hues darkened to clear 4.5:1. Matched
characters are emphasised with weight, not colour, since colour is already spent
on the gradient.

The stops live in one place, `--command-sweep` in `index.css`, because the same
gradient is used by the picker and the composer.

### Highlighting the command inside the composer

A chosen command keeps its gradient once it is in the text box, while the rest
of the message stays ordinary body text. A `<textarea>` cannot style ranges of
its own content, so `ComposerHighlight` does the standard overlay trick: the
textarea keeps the text, caret, selection and all native editing but paints its
glyphs `transparent`, and a read-only `aria-hidden` copy sits exactly on top
rendering the same string with markup.

Registration between the two layers is the whole game, and three things are
load-bearing:

- **Metrics are mirrored from the live element**, not hardcoded. Astryx styles
  the textarea through StyleX, so its font and padding are not ours to assume.
- **Geometry is measured against the textarea, not the shell.** Astryx nests the
  `<textarea>` inside its own wrapper, so anchoring the overlay to the shell with
  `inset: 0` lands it ~9px out horizontally.
- **A `ResizeObserver` drives the geometry sync.** The auto-resize hook lives in
  the parent and React runs a child's effects first, so the overlay's own layout
  effect measures the textarea _before_ it has been resized. Growing hides this;
  shrinking leaves the overlay stuck at its previous height.

`caret-color` is restored explicitly, since it defaults to `color` and would
otherwise go transparent with the text. `::placeholder` is unaffected — Astryx
sets it to `--color-text-secondary` rather than inheriting.

Only a token that names a **real** command is tinted, so the colour doubles as
validation: a typo stays plain text, and a failed discovery simply highlights
nothing.

### File mentions (`@`)

Typing `@` completes the files staged for the message, so a prompt can point at
one by name. Same keyboard model as the `/` picker deliberately — two
completion menus behaving differently in one text box would be worse than
either is useful.

The differences follow from what a mention is. It belongs _inside_ a sentence
("compare @a.ts with @b.ts"), so `getMentionQuery` searches back from the
**caret** rather than anchoring to the start of the line, and it only counts
when the `@` begins a word — otherwise an email address or a decorator in
pasted code opens a menu. With nothing attached the key stays an ordinary
character.

Insertion is the bare filename, because the message already carries a labelled
block of full paths (`withAttachments`) for Claude to resolve against. Two
attachments with the same filename defeat that block, so those mentions carry
the full path instead.

**The caret is placed in a `useLayoutEffect` keyed on the value, not in a
`requestAnimationFrame`.** The rAF can run before React commits the new value,
in which case `setSelectionRange` lands on the old text and is then reset —
which fires a `select` carrying a stale offset and leaves the picker open over
a token that no longer exists. This was only visible in a browser; the caret
state and the DOM disagreed while every unit test passed.

### Context island

A status surface in the composer footer, beside the model selector, reporting
how full the context window is and swapping to a spinner while Claude compacts.
Built as a slot rather than a percentage readout so later states can take the
same space.

It renders nothing until a turn has reported usage — a fresh conversation has
measured nothing, and a 0% would be a claim rather than a reading. Cached
tokens count toward the fill because they still occupy the window, and when a
turn used several models the **largest** window wins, so a subagent on a
cheaper model is not mistaken for the main conversation.

Two placement traps, both found only in a live session:

- It must sit **outside** the send/stop swap in `ChatInput`. Compaction only
  runs mid-turn, so an island in the idle branch is hidden for exactly the
  window it has something to report.
- `adaptContext` in `useStreamParser` copies `StreamingContext` field by field
  and every field is optional, so a callback missing there is silently dropped
  rather than caught by the type checker. Add new ones in **both** places.

Compaction refreshes the reading from the boundary rather than waiting for the
next turn's result. Both spellings are read: the SDK type declares
`compact_metadata.post_tokens`, while the session file writes
`compactMetadata.postTokens`. An observed manual `/compact` carries no
post-count at all, so absence reports nothing rather than a reassuring 0%.

## The CLI's command plumbing is not user speech

Running a slash command emits several user-role turns the user never typed, and
rendering them verbatim attributed paragraphs of XML to them.
`utils/localCommandTurns.ts` turns each back into what it is:

| Arrives as               | Shown as                                                    |
| ------------------------ | ----------------------------------------------------------- |
| `<command-name>…`        | the command as typed (`/compact`)                           |
| `<local-command-caveat>` | dropped — it addresses the model                            |
| `<local-command-stdout>` | unwrapped, or dropped if it only acknowledges (`Compacted`) |

Output carrying a real answer (`/cost`) is kept, so this is not a blanket
filter. Separately, the post-compaction summary the CLI feeds back in is
dropped on its own `isCompactSummary` flag — thousands of words restating the
conversation the user is already looking at. The flag is used rather than the
English it opens with.

`compact_boundary` is in `NON_DISPLAYED_SYSTEM_SUBTYPES`; its numbers drive the
island instead.

## Starring conversations

Offered three ways — an icon on the sidebar row, the row's right-click menu,
and the conversation header — because the conversation you want to star is not
always the one that is open, and a hover-revealed icon on a narrow sidebar is
easy to miss.

Starred conversations get their own section above the rest. Membership is a
**partition, not a sort**, so a conversation is in exactly one section and can
never appear twice; the section is absent when nothing is starred.

**Stars live in `~/.pdlc-studio/starred.json`** (`backend/history/starred.ts`),
not in the session JSONL: a star is this app's preference, not part of the
conversation, and writing it into a file the CLI owns and appends to would lose
it the moment the CLI rewrote the file. Server-side rather than localStorage so
it survives a cleared cache.

They ride along with the histories listing (`isStarred` on
`ConversationSummary`) rather than being fetched separately — the sidebar has
to know which section a row belongs to before it can draw it.

`PUT /api/projects/:encodedProjectName/histories/:sessionId/star` takes
`{ isStarred }` and **states the desired state rather than toggling**: a client
list a few seconds stale would otherwise flip the star the wrong way. Note PUT
had to be added to the CORS `allowMethods` — the same gap that made PATCH and
DELETE unreachable when they were added.

## Exporting a transcript

An Export control at the right edge of the conversation header, mirrored in
that header's right-click menu, offering Markdown, HTML and PDF.

**Markdown is the single source of truth.** HTML is that markdown parsed
(`marked`), and PDF is that HTML printed, so the three cannot drift into
describing the same conversation differently.

- The HTML is standalone — its own stylesheet inline, nothing to fetch — and
  commits to light, since a page printed from a dark theme is a wall of ink.
- PDF goes through the print dialog and says so in the menu. No browser API
  writes a PDF; bundling a PDF library or rendering server-side both mean
  shipping a second engine to reproduce a page this one already lays out.
  `saveTranscript` prints via a hidden iframe, cleaning up on `afterprint`
  (removing it earlier cancels the print) with a timer as a floor.

Two things a transcript does that ordinary markdown does not:

- **Fences are sized longer than anything inside them.** Tool output routinely
  contains ``` — a diff of the exporter would — and a three-backtick fence
  around it closes at the first one, spilling the rest of the transcript out as
  prose.
- **The parsed HTML is sanitized** (`utils/sanitizeHtml.ts`, allowlist over a
  `DOMParser` tree). `marked` does not sanitize, and Claude quotes whatever it
  read off the web or out of a repository into a file the user will open.

## Agents and workflows

A third tab beside Chat and Files, plus an island state, showing what the
conversation's subagents and workflows are doing.

**Built from task telemetry, not the transcript.** A workflow fans out to agents
whose work never appears as messages, so the transcript shows a long pause where
this shows the tree. The CLI reports lifecycle as a stream of small events —
`task_started`, `task_progress`, `task_updated`, `task_notification`,
`background_tasks_changed`, plus the top-level `tool_progress` — and nothing
ever sends a snapshot, so `utils/agentActivity.ts` folds them into one.

That reducer is deliberately pure, because the ordering rules are the whole
substance of it: a late `progress` frame must not resurrect a finished task,
`background_tasks_changed` has REPLACE semantics over the _live_ set only (an
absent task ended, it was not deleted), and events arrive for tasks whose
`started` was never seen, which synthesise a row rather than being dropped.

`workflow_name` is set **only** when `task_type === "local_workflow"`, so it is
the grouping key; everything else falls into one unnamed group rather than
being filed under an invented heading.

**This also fixed a live bug.** `task_progress`, `task_updated` and
`task_notification` were never in `NON_DISPLAYED_SYSTEM_SUBTYPES`, so a running
workflow dumped a raw JSON blob into the transcript for every frame — several
per second per agent. They are folded into the panel _before_ the display
filter, the same ordering `init` and `status` rely on.

**Limitation: the telemetry is not persisted.** Session JSONL files contain no
`task_*` entries, so a resumed conversation shows an empty panel until new
agents run. The subagent's _work_ still appears in the transcript as a Task
tool call and result; only the live tree is ephemeral. Nothing can be done
about this from here.

Note the header — title, star, export and the view toggle — renders for _every_
tab. Scoping it to the chat branch left Files and Agents with no way back: the
control that switches tabs vanished the moment it was used.

### Agent teams

A team section at the top of the Agents tab, read from the CLI's own state:
`~/.claude/teams/session-<first 8 of the session id>/config.json`
(`backend/history/teams.ts`). Nothing in the SDK exposes teams —
`SDKSessionInfo` carries no agent, team or parent metadata — so that file is
the only source, which makes it a private interface this app does not own.
Every field is therefore optional and unknown ones are tolerated.

It shows each member's name, agentType, model, the colour the CLI assigned it
(so the panel and the terminal name the same agent), and its **charter** — the
prompt the teammate was given, which is the only record anywhere of what that
agent was asked to do.

**A teammate cannot be opened as a conversation, and this is not an oversight.**
Verified against a real six-member team:

- no member carries a `sessionId`; only the lead has one, at the top level
- the five teammates wrote **no session files** — they run `in-process`
- the lead's own transcript has no agent attribution either: all 73 entries are
  `isSidechain: false` and the only `origin` is `{"kind":"human"}`

So teammate work exists in no transcript on disk; there is nothing to resume.
`member.sessionId` is still read first when deciding whether to offer Open, so
the action appears by itself if the CLI ever starts recording one. A test
asserts teammates have no session, which is what should fail first if that
changes.

## Stopping a turn, and streaming input

The chat handler sends **streaming input** — an async iterable of
`SDKUserMessage` — rather than a string prompt. The SDK's control requests
(`interrupt`, `setModel`, `setPermissionMode`, `setMaxThinkingTokens`) are
documented as _"only supported when streaming input/output is used"_, and a
string prompt is not.

Three things about it are load-bearing, all found by measurement:

- **`origin: { kind: "human" }` must be stamped explicitly.** The SDK treats an
  absent origin as unattributed and fails closed at strict `isHuman()` gates.
- **The generator parks after yielding, instead of returning.** Returning ends
  the input stream, and the CLI treats end-of-input as the end of the session.
  `commands.ts` parks for the same reason, so `initializationResult()` — also a
  control request — can be answered.
- **The park must be released on the result message _and_ in `finally`.** A
  generator left parked hangs the query, and the HTTP response with it.

Stop now **interrupts before it kills**. Killing through the AbortController
throws the turn away; `interrupt()` ends it, so partial work stays in the
session and the conversation is still resumable. The kill remains as a fallback
behind a 3s timeout, because a wedged CLI is exactly when someone presses Stop,
and a tool call in progress can delay the CLI servicing a control request.

**A successful interrupt does not end quietly.** The SDK raises
`"Claude Code returned an error result: [ede_diagnostic] result_type=user"`,
indistinguishable from a real failure at the catch site. `interruptedRequests`
records that the user asked for the stop, so the stream reports `aborted`
rather than putting an error in the transcript — which would be worse than the
kill path it replaced. The mark is set _before_ awaiting the interrupt, since
the turn can raise that error the moment it lands.

## Conversation Typography

The message transcript has its own typeface and text scale, chosen in Settings →
Conversation and stored in `AppSettings`. It defaults to **sans at Medium**,
which sits in the middle of the ladder so the control has room in both
directions. The scale in `index.css` is what carries the sizing decision: it was
shifted up one step, so Medium renders at what was previously Large and Small
bottoms out at Astryx's own base size rather than below it. Move the ladder, not
the default, if the transcript should read bigger or smaller overall.

Changing a default only affects **fresh** profiles: `getSettings()` layers
stored values over defaults, so an existing profile keeps whatever it already
had. Seeing a new default requires clearing the stored settings or changing it
in the UI.

**Scoped to the transcript only.** The wrapper carrying
`.conversation-typography` goes around `ChatMessages`, not the whole chat
region, so the composer stays an input control on the UI font.

Two things make this less trivial than a `font-family` on a container:

- **The size control has to redefine Astryx's `--font-size-*` tokens**, not set
  `font-size`. Those tokens are rem values resolved against the root element, so
  a container's font-size cannot touch them and Astryx text would ignore the
  setting entirely. That means restating their base values in `index.css`;
  `conversationTypography.test.ts` parses the shipped Astryx stylesheet and
  fails if any drift on an upgrade.
- **Astryx's chat surfaces set their own font.** Everything inherits correctly
  from the message list down and then `.astryx-chat-message-bubble` resets to
  the UI font. `.astryx-markdown` and `.astryx-text` do the same. All three are
  opted back in by the documented component classes.

### Bundled typefaces

The picker offers eleven faces. Eight families are **bundled** so every option
renders on a machine that has none of them installed, including the
single-binary release: Vite emits them into `dist/static/assets` and
`deno compile --include` embeds that, under the existing `/assets/*` mount.

**Four of the offered names are proprietary and are not bundled** — Bookman Old
Style, Helvetica, Proxima Nova, Georgia. Those stacks name the licensed font
first and fall back to an OFL family:

| Offered      | Falls back to | Substitution                 |
| ------------ | ------------- | ---------------------------- |
| Helvetica    | Arimo         | metric-compatible, no reflow |
| Georgia      | Gelasio       | metric-compatible, no reflow |
| Proxima Nova | Nunito Sans   | style only, metrics differ   |
| Bookman      | Bitter        | style only, not a true clone |

The two style-only substitutes lay text out differently from the licensed font,
so the same message wraps differently on machines that do and don't have it.
The picker surfaces each substitution in the dropdown rather than failing over
silently. `THIRD-PARTY-LICENSES.md` carries the OFL attribution that
redistribution requires.

`@font-face` is declared by hand in `src/fonts.css`, not by importing each
package's stylesheet. Those advertise a legacy `.woff` beside every `.woff2`,
and Vite emits both — 604 kB of copies that no browser here can reach, since
the app's own CSS uses `light-dark()`. Only the Latin subset at weights 400 and
700 ships; the packages' default entry points pull every subset.
`conversationTypography.test.ts` fails if a picker entry has no font stack, or
if a bundled family stops being imported.

Code is deliberately exempt — diffs and tool output depend on column alignment.
That rule doubles `.conversation-typography` in its selector purely for
specificity, so it outranks the `.astryx-markdown` rule that would otherwise
make fenced code serif.

Secondary text uses `em` rather than another absolute size, so it keeps its
proportion as the scale changes; a nested `.astryx-text` inside the metadata row
is reset to `inherit` to stop the two rules compounding to 64%.

Adding a setting is a non-event: `getSettings()` layers stored values **over**
defaults, so a profile written before a field existed reads the default rather
than `undefined`, and only a change to an existing field's meaning needs a
version bump.

## Permission Mode Switching

UI-driven permission mode switching, cycling all four Claude CLI modes: `bypassPermissions` → `default` → `plan` → `acceptEdits`.

**Default is `bypassPermissions`** — sessions start with approval prompts disabled, so Claude runs every tool (including `Bash`) unattended in the selected working directory.

- **UI default**: `INITIAL_PERMISSION_MODE` in `frontend/src/hooks/chat/usePermissionMode.ts`
- **API default** (requests that omit `permissionMode`): `DEFAULT_PERMISSION_MODE` in `backend/utils/permissions.ts`

Set **both** to `"default"` to restore approval prompts everywhere.

`resolvePermissionMode()` validates the field at runtime and rejects unknown values with a 400 — the wire type in `shared/types.ts` is erased at compile time and cannot be relied on to keep arbitrary strings off the CLI's `--permission-mode` flag.

Because there is no authentication on the API, this default means anything that can reach the port can run shell commands. The server binds `127.0.0.1` unless `--host` says otherwise, and `warnIfPermissionsExposed()` logs a warning at startup on a non-loopback bind.

Note the CLI can decline to honour the mode: a `permissions.disableBypassPermissionsMode` setting — including one from managed policy settings — takes precedence, in which case prompts return and `PermissionInputPanel` handles them as before.

**Implementation**: `usePermissionMode` hook, `backend/utils/permissions.ts`, `PermissionInputPanel` / `PlanPermissionInputPanel` components
**Usage**: Cycle via the chat input footer or `Ctrl+Shift+M`; in plan mode, send a message → review plan → choose action

## Testing

**Frontend**: Vitest + Testing Library (`make test-frontend`)
**Backend**: Deno test runner (`make test-backend`)  
**Unified**: `make test` runs both, `make check` includes in quality validation

## Single Binary Distribution

```bash
cd backend && deno task build  # Local building
```

**Automated**: see [Release Process](#release-process) — GitHub Actions builds
Linux (x64/arm64) and macOS (x64/arm64). Windows is not supported.

The release build installs backend dependencies with
`npm ci --omit=dev --omit=optional` and compiles with
`--node-modules-dir=manual --no-check`. Both omissions matter: `deno compile`
embeds the whole `node_modules` tree, so devDependencies and the ~245 MB
platform-specific `@anthropic-ai/claude-agent-sdk-<platform>` package would
otherwise ship inside every binary. That package is a full Claude Code native
executable this app never runs, because `chat.ts` passes an explicit
`pathToClaudeCodeExecutable`. macOS arm64 went from 428 MB to 94 MB, and to
38 MB once packaged as a compressed disk image.

**Every platform ships compressed.** macOS as a UDZO disk image, Linux as a
`.tar.gz` holding a single executable named `pdlc-studio`. The packaging step
deletes the unpackaged binary afterwards, so each platform has exactly one
obvious download. Linux went from 145 MB raw to 41 MB; it had been shipping
uncompressed only because the DMG gave macOS compression for free and nothing
did the equivalent for Linux.

`.tar.gz` rather than `.tar.xz` on purpose: xz reaches 29 MB but needs
`xz-utils` present to extract, and a failed extract on a minimal image costs
more than 12 MB saves. Switching is a one-word change (`-czf` to `-cJf`) if that
tradeoff ever flips.

`--no-check` is required because dropping devDependencies removes
`@types/node`, which a JSR dependency needs to resolve types. Types are already
checked by `make check` on every PR.

## Claude Agent SDK Dependency Management

The SDK package is **`@anthropic-ai/claude-agent-sdk`**. The former
`@anthropic-ai/claude-code` package is the legacy name and is no longer used
here — its `1.x` versions do not correspond to Agent SDK versions at all, so
don't carry an old pin across. The Agent SDK's own `package.json` records the
Claude Code release it tracks in a `claudeCodeVersion` field.

**Policy**: Fixed versions (no caret `^`) for consistency across frontend/backend.
It is pinned in four places: `frontend/package.json`, `backend/package.json`
(both `dependencies` and `peerDependencies`), and `backend/deno.json`.

**Update Procedure**:

1. Check versions: `grep -rn "@anthropic-ai/claude-agent-sdk" frontend/package.json backend/package.json backend/deno.json`
2. Update frontend package.json and `npm install`
3. Update backend deno.json imports and `rm deno.lock && deno cache cli/deno.ts`
4. Update backend package.json (dependencies **and** peerDependencies) and `npm install`
5. Verify: `make check`

**Expect type churn on upgrades.** The SDK re-exports Anthropic API types, and
`make check` typechecks test and demo fixtures via the frontend build (`tsc -b`),
which is stricter than `tsc --noEmit` in either workspace alone. New required
fields on `BetaUsage` / `BetaMessage` / `SDKSystemMessage` surface as fixture
errors — add them to the factories in `frontend/src/utils/sdkFixtures.ts` rather
than at each call site.

The SDK declares `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, and `zod` as
peer dependencies; npm installs them automatically and nothing here imports them
directly. It also ships the Claude Code executable as platform-specific
optional dependencies, but this app keeps passing its own detected
`pathToClaudeCodeExecutable` (see below).

## Commands for Claude

### Unified Commands (from project root)

- `make format` - Format both frontend and backend
- `make lint` - Lint both
- `make typecheck` - Type check both
- `make test` - Test both
- `make check` - All quality checks
- `make sync-brand` - Copy `brand/` mark SVGs into `frontend/public/`
- `make format-files FILES="file1 file2"` - Format specific files

### Individual Commands

- Development: `make dev` runs both servers in one terminal; `make dev-backend`
  / `make dev-frontend` still run them separately
- `make dev-debug` is the same with per-message SDK payload logging on the
  backend, which is off by default because it logs the full JSON of every
  message and buries anything worth reading
- Testing: `make test-frontend` / `make test-backend`
- Build: `make build-backend` / `make build-frontend`

## Development Workflow

### Pull Request Process

1. Create feature branch: `git checkout -b feature/name`
2. Commit changes (Lefthook runs `make check`)
3. Push and create PR with appropriate labels:
   ```bash
   gh pr create --title "..." --body "..." --label "bug"
   ```
4. Include Type of Change checkboxes and description
5. Request review and merge after approval

### Labels

Only GitHub's default label set exists on this repo — check with
`gh label list` before using one, since `gh pr create` fails outright on an
unknown label:

`bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`,
`help wanted`, `invalid`, `question`, `wontfix`

An earlier revision of this file documented a richer scheme (`feature`,
`breaking`, `refactor`, `backend`, `frontend`, …) that was never created. Create
those labels first if you want them; nothing depends on them now that version
selection is explicit rather than label-driven.

### Release Process

Releases run entirely from `.github/workflows/release.yml`. One command:

```bash
gh workflow run release.yml -f version=0.3.0    # no "v" prefix
```

Or use the **Run workflow** button on the Release workflow in the Actions tab.

That single run does everything: bumps `backend/package.json`, commits it to the
branch you dispatched from, creates and pushes the tag, builds all five
binaries, and publishes the GitHub Release with auto-generated notes.

Version numbers are plain semver with **no `v` prefix** (`0.3.0`, not `v0.3.0`)
— the workflow rejects the prefixed form so tags stay consistent with `0.2.0`.
Re-releasing an existing version is refused rather than silently overwriting.

`backend/package.json` is the single source of truth for the version:
`generate-version.js` reads it to produce the gitignored `cli/version.ts`, so
`pdlc-studio --version` follows automatically.

**Pushing a tag by hand still works** (`git tag 0.3.0 && git push origin 0.3.0`)
and skips only the bump — remember to bump `backend/package.json` yourself, or
the binaries will report the previous version.

**npm publishing is opt-in.** The `npm-publish` job only runs when the
`ENABLE_NPM_PUBLISH` repository variable is `true`. `pdlc-studio` has never
been published, and npm publication is effectively irreversible (unpublish is
limited to 72 hours and a version can never be reused), so releasing does not
touch the registry unless you ask it to. The first publish will likely also
need a `NODE_AUTH_TOKEN`, since OIDC trusted publishing must be configured
against an npm package that already exists.

#### Why not tagpr

`tagpr` was removed. It required a Personal Access Token, because a tag pushed
with the built-in `GITHUB_TOKEN` does not trigger other workflows — so its
auto-created tag would never have started a release build. Keeping the whole
release in one workflow run sidesteps that entirely and leaves no expiring
credential to rotate. (tagpr had also never succeeded in this repo: every run
failed on a missing `GH_PAT`, and no `CHANGELOG.md` was ever produced.)

The tradeoff is no generated `CHANGELOG.md` and no label-driven version
selection — you choose the version explicitly. `generate_release_notes: true`
means GitHub still assembles release notes from merged PRs.

### GitHub Sub-Issues API

```bash
gh issue create --title "Sub-issue" --label "feature"
SUB_ISSUE_ID=$(gh api repos/pdlc-os/pdlc-studio/issues/NUM --jq '.id')
gh api repos/pdlc-os/pdlc-studio/issues/PARENT/sub_issues --method POST --field sub_issue_id=$SUB_ISSUE_ID
```

### Viewing Copilot Review Comments

```bash
gh api repos/pdlc-os/pdlc-studio/pulls/PR_NUMBER/comments
```

**Important**: Always run commands from project root. Use full paths for cd commands to avoid directory navigation issues.
