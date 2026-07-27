# PDLC Studio - Development Tasks

.PHONY: format format-check lint typecheck test build dev dev-debug dev-backend-debug clean install install-frontend install-backend sync-brand

# Formatting
format: format-frontend format-backend
format-frontend:
	cd frontend && npm run format
format-backend:
	cd backend && deno task format && npm run format

# Format checking  
format-check: format-check-frontend format-check-backend
format-check-frontend:
	cd frontend && npm run format:check
format-check-backend:
	cd backend && deno task format:check && npm run format:check

# Linting
lint: lint-frontend lint-backend
lint-frontend:
	cd frontend && npm run lint
lint-backend:
	cd backend && deno task lint && npm run lint

# Type checking
typecheck: typecheck-frontend typecheck-backend
typecheck-frontend:
	cd frontend && npm run typecheck
typecheck-backend:
	cd backend && deno task check && npm run typecheck

# Testing
test: test-frontend test-backend
test-frontend:
	cd frontend && npm run test:run
test-backend:
	cd backend && npm run test

# Building
build: build-frontend copy-dist build-backend
build-frontend:
	cd frontend && npm run build
# Delegates to the same script the release workflow uses. Copying straight to
# backend/dist would put the files one level above where cli/deno.ts looks
# (../dist/static) and where `deno compile --include ./dist/static` reads them,
# so `make build` would emit a binary serving nothing.
copy-dist:
	cd backend && node scripts/copy-frontend.js
build-backend:
	cd backend && deno task build

# Development
# Both servers in one terminal, backend first.
#
# The frontend is started only once the backend answers. Vite comes up happily
# without it — `GET /` returns 200 — but every proxied /api call returns 500
# until the backend is listening, so loading the app in that window shows a
# broken page that only a refresh fixes.
#
# `trap 'kill 0'` kills the process group on exit, so Ctrl-C stops both.
# Without it, interrupting make leaves the children holding :8080 and :3000,
# after which the next run dies with EADDRINUSE while a stale server quietly
# keeps serving old code.
#
# The wait is bounded. An unbounded `until` here would hang forever whenever
# the backend fails to start, which is exactly when you want to see its output.
DEV_BACKEND_TASK ?= dev
DEV_PORT ?= 8080
DEV_WAIT ?= 60

dev:
	@trap 'kill 0' EXIT INT TERM; \
	( cd backend && deno task $(DEV_BACKEND_TASK) ) & \
	printf 'waiting for backend on :$(DEV_PORT)'; \
	for i in $$(seq 1 $(DEV_WAIT)); do \
	  if curl -sf -o /dev/null http://127.0.0.1:$(DEV_PORT)/api/projects; then \
	    ready=1; break; \
	  fi; \
	  printf '.'; sleep 1; \
	done; \
	echo; \
	if [ -z "$$ready" ]; then \
	  echo "backend did not answer in $(DEV_WAIT)s — starting frontend anyway; see its output above"; \
	else \
	  echo "backend  -> http://localhost:$(DEV_PORT)"; \
	fi; \
	echo "frontend -> http://localhost:3000"; \
	echo "Ctrl-C stops both."; \
	( cd frontend && npm run dev ) & \
	wait

# Same, with per-message SDK payload logging on the backend.
dev-debug:
	@$(MAKE) dev DEV_BACKEND_TASK=dev:debug

dev-frontend:
	cd frontend && npm run dev
dev-backend:
	cd backend && deno task dev

# Same, with per-message SDK payload logging. Off by default: every turn logs
# the full JSON of every message, which buries anything worth reading.
dev-backend-debug:
	cd backend && deno task dev:debug

# Quality checks (run before commit)
check: format-check lint typecheck test build-frontend

# Install dependencies.
# Backend deps are needed for the Node.js dev path and for `make test-backend`;
# the Deno path resolves its own npm: specifiers and does not need them.
install: install-frontend install-backend
install-frontend:
	cd frontend && npm ci
install-backend:
	cd backend && npm ci

# Copy the canonical mark from brand/ into the places that serve it.
# AppIcon.test.tsx fails if these drift, so a forgotten sync is caught by
# `make check` rather than in review.
sync-brand:
	cp brand/pdlc-studio-mark.svg frontend/public/pdlc-studio-mark.svg
	cp brand/pdlc-studio-mark-small.svg frontend/public/pdlc-studio-favicon.svg
	@echo "Synced brand/ -> frontend/public/"

# Format specific files (usage: make format-files FILES="file1 file2")
format-files:
	@for file in $(FILES); do \
		echo "Formatting $$file"; \
		cd $(PWD)/frontend && npx prettier --write "../$$file"; \
	done

# Clean
clean:
	cd frontend && rm -rf node_modules dist
	cd backend && rm -rf ../dist dist