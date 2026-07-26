# PDLC Studio - Development Tasks

.PHONY: format format-check lint typecheck test build dev clean install install-frontend install-backend sync-brand

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
dev-frontend:
	cd frontend && npm run dev
dev-backend:
	cd backend && deno task dev

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