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
the ring below the threshold pass `variant="mark"` instead — the chat and demo
headers do, at 28px.

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

- Backend: Deno or Node.js (20.0.0+)
- Frontend: Node.js
- Claude CLI tool installed
- dotenvx: `npm install -g @dotenvx/dotenvx`

### Port Configuration

Create `.env` file in project root:

```bash
PORT=9000
```

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

- Development: `make dev-backend` / `make dev-frontend`
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
