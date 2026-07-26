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

### Frontend (React)

- **Location**: `frontend/` | **Port**: 3000 (configurable)
- **Technology**: Vite + React + SWC + TypeScript + Astryx design system + React Router
- **Purpose**: Project selection and chat interface with streaming responses

**Key Features**: Project directory selection, routing system, conversation history, demo mode, real-time streaming, theme toggle, auto-scroll, accessibility features, modular hook architecture, request abort functionality, permission dialog handling, configurable Enter key behavior.

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

### Shared Types

**Location**: `shared/` - TypeScript type definitions shared between backend and frontend

**Key Types**: `StreamResponse`, `ChatRequest`, `AbortRequest`, `ProjectInfo`, `ConversationSummary`, `ConversationHistory`

## Claude Command Integration

Backend uses Claude Code SDK executing commands with:

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

## Session Continuity

Conversation continuity using Claude Code SDK's session management:

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

## Claude Code SDK Types Reference

**SDK Types**: `frontend/node_modules/@anthropic-ai/claude-code/sdk.d.ts`

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

**Automated**: Push git tags → GitHub Actions builds for Linux/macOS (x64/ARM64)

## Claude Code Dependency Management

**Policy**: Fixed versions (no caret `^`) for consistency across frontend/backend

**Update Procedure**:

1. Check versions: `grep "@anthropic-ai/claude-code" frontend/package.json backend/deno.json`
2. Update frontend package.json and `npm install`
3. Update backend deno.json imports and `rm deno.lock && deno cache cli/deno.ts`
4. Update backend package.json and `npm install`
5. Verify: `make check`

## Commands for Claude

### Unified Commands (from project root)

- `make format` - Format both frontend and backend
- `make lint` - Lint both
- `make typecheck` - Type check both
- `make test` - Test both
- `make check` - All quality checks
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
   gh pr create --title "..." --body "..." --label "bug" --label "backend"
   ```
4. Include Type of Change checkboxes and description
5. Request review and merge after approval

### Labels

🐛 `bug`, ✨ `feature`, 💥 `breaking`, 📚 `documentation`, ⚡ `performance`, 🔨 `refactor`, 🧪 `test`, 🔧 `chore`, 🖥️ `backend`, 🎨 `frontend`

### Release Process (Automated with tagpr)

1. Feature PRs merged → tagpr creates release PR
2. Add version labels if needed (minor/major)
3. Merge release PR → automatic tag creation
4. GitHub Actions builds binaries automatically

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
