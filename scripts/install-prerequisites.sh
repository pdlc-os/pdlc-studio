#!/usr/bin/env bash
#
# Installs the prerequisites for PDLC Studio on macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/pdlc-os/pdlc-studio/main/scripts/install-prerequisites.sh | bash
#
# Installs:
#   - Claude CLI      required by every install method
#
# Verifies but does NOT install:
#   - Node.js >= 22.9 and Deno, needed only for development mode
#
# Runtimes are checked rather than installed on purpose. Most developers manage
# Node through nvm, asdf, volta or similar, and having this script drop another
# copy in front of that is how you end up with the "Claude CLI not found"
# class of problem the README's Troubleshooting section exists for. The exact
# command to install one is printed instead.
#
# Safe to re-run: anything already present is left alone.

set -euo pipefail

readonly REQUIRED_NODE_MAJOR=22
readonly REQUIRED_NODE_MINOR=9

# Only colourise when attached to a terminal, so piped output stays clean.
if [ -t 1 ]; then
  BOLD=$(printf '\033[1m'); DIM=$(printf '\033[2m'); RESET=$(printf '\033[0m')
  GREEN=$(printf '\033[32m'); YELLOW=$(printf '\033[33m'); RED=$(printf '\033[31m')
else
  BOLD=""; DIM=""; RESET=""; GREEN=""; YELLOW=""; RED=""
fi

step() { printf '\n%s==>%s %s%s%s\n' "$BOLD" "$RESET" "$BOLD" "$1" "$RESET"; }
ok()   { printf '  %sok%s      %s\n' "$GREEN" "$RESET" "$1"; }
warn() { printf '  %swarn%s    %s\n' "$YELLOW" "$RESET" "$1"; }
fail() { printf '  %serror%s   %s\n' "$RED" "$RESET" "$1"; }
info() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }

have() { command -v "$1" >/dev/null 2>&1; }

case "$(uname -s)" in
  Darwin) OS=macos ;;
  Linux)  OS=linux ;;
  *)
    fail "Unsupported platform: $(uname -s). PDLC Studio supports macOS and Linux only."
    exit 1
    ;;
esac

printf '%sPDLC Studio prerequisites%s  %s(%s)%s\n' "$BOLD" "$RESET" "$DIM" "$OS" "$RESET"

# ---------------------------------------------------------------- Claude CLI

step "Claude CLI"
if have claude; then
  ok "already installed — $(claude --version 2>/dev/null | head -1)"
else
  info "installing from https://claude.ai/install.sh"
  curl -fsSL https://claude.ai/install.sh | bash

  # The installer puts claude in ~/.local/bin, which may not be on PATH yet in
  # this shell.
  if ! have claude && [ -x "$HOME/.local/bin/claude" ]; then
    export PATH="$HOME/.local/bin:$PATH"
    warn "added ~/.local/bin to PATH for this run"
    info "add it to your shell profile to make that permanent:"
    info "  export PATH=\"\$HOME/.local/bin:\$PATH\""
  fi

  if have claude; then
    ok "installed — $(claude --version 2>/dev/null | head -1)"
  else
    fail "install completed but 'claude' is still not on PATH"
    exit 1
  fi
fi

info "run 'claude' once to authenticate if you have not already"

# ------------------------------------------------------- runtimes (dev only)

step "Development runtimes (skip if you only run the release binary)"

if have node; then
  # Compared as major.minor, not major alone: the floor is 22.9, the release
  # that added --env-file-if-exists, so a v22.5 would pass a major-only check
  # and then fail the moment `npm run dev` loads .env.
  node_major=$(node -v | sed -E 's/^v([0-9]+).*/\1/')
  node_minor=$(node -v | sed -E 's/^v[0-9]+\.([0-9]+).*/\1/')
  if [ "$node_major" -gt "$REQUIRED_NODE_MAJOR" ] ||
    { [ "$node_major" -eq "$REQUIRED_NODE_MAJOR" ] && [ "$node_minor" -ge "$REQUIRED_NODE_MINOR" ]; }; then
    ok "Node.js $(node -v)"
  else
    warn "Node.js $(node -v) is older than the required v${REQUIRED_NODE_MAJOR}.${REQUIRED_NODE_MINOR}"
    if [ "$OS" = macos ]; then info "upgrade with: brew install node"; else info "see https://nodejs.org/en/download"; fi
  fi
else
  warn "Node.js not found (needed for development mode only)"
  if [ "$OS" = macos ]; then info "install with: brew install node"; else info "see https://nodejs.org/en/download"; fi
fi

if have deno; then
  ok "Deno $(deno --version 2>/dev/null | head -1 | awk '{print $2}')"
else
  info "Deno not found — optional, the backend also runs on Node.js"
  info "install with: curl -fsSL https://deno.land/install.sh | sh"
fi

step "Done"
info "Binary release:    ./pdlc-studio    then open http://localhost:8080"
info "Development mode:  make dev-backend  and  make dev-frontend"
