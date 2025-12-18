# Repository Guidelines

This file provides guidance to AI agents when working with code in this repository.

## MANDATORY ACTIONS

- Always run `npm run check` before marking any task as complete. This ensures code quality and formatting standards are met.
- Never use emoji in solidity files (from global user instructions).

## Project Constitution (NON-NEGOTIABLE)

This project follows strict principles defined in [.specify/memory/constitution.md](.specify/memory/constitution.md):

### I. Kebab-Case File Naming (MANDATORY)

- **All source files MUST use kebab-case** (e.g., `preview-store.ts`, `document-preview-panel.ts`)
- ❌ NO camelCase, PascalCase, or snake_case files
- Linter will fail on non-compliant filenames
- Exceptions: Config files requiring specific naming (`package.json`, `tsconfig.json`, `README.md`)

### II. TypeScript-First Development

- All code MUST be TypeScript with `strict: true`
- No `any` types without explicit justification
- All public APIs MUST have complete type definitions

### III. Test-First Development (TDD)

- Tests MUST be written BEFORE implementation
- Red-Green-Refactor cycle strictly enforced
- PRs without tests are rejected
- Test coverage MUST NOT decrease
- Integration tests required for new features

### IV. Observability & Instrumentation

- Significant operations MUST include telemetry, logging, and error reporting
- Performance-critical paths MUST include instrumentation
- Errors MUST be logged with sufficient debug context
- No silent failures

### V. Simplicity & YAGNI

- Implement only what is needed NOW
- No features or abstractions for potential future use
- Challenge unnecessary abstractions in code reviews
- Refactor when patterns emerge (Rule of Three)

## Quick Start: Common Commands

```bash
# Install all dependencies (root + ui)
npm run install:all

# Development workflow
npm run build          # Full build (prompts + extension + webview)
npm run watch          # TypeScript watch + webview dev server
npm run build-prompts  # Compile markdown prompts to TypeScript
npm run build:ext      # Bundle extension only (esbuild)
npm run build:webview  # Build React webview (Vite)

# Testing and Quality (MUST pass before commits)
npm test               # Run all tests (Vitest)
npm run test:watch     # Watch mode for tests
npm run test:coverage  # Generate coverage report
npm run lint           # Lint with Biome
npm run format         # Format code with Biome
npm run check          # Run all checks (lint + format validation) - MANDATORY

# Running specific tests
npm test -- path/to/test-file.test.ts           # Run single test file
npm test -- -t "test name pattern"               # Run tests matching pattern

# Packaging and Publishing
npm run package        # Create VSIX file for VS Code Marketplace
npm run compile        # Build then package (used for CI/CD)

# Webview development
npm --prefix ui run dev  # Run webview dev server in isolation

# Launch extension in debug mode
Press F5 in VS Code to launch the Extension Development Host
```

## Code Quality Standards

### Formatting & Style

- Tab indentation (configured in formatter)
- Double quotes for strings
- Semicolons required
- `npm run format` MUST pass before commit
- `npm run lint` MUST pass before merge

### Documentation

- Public APIs MUST include JSDoc comments
- Complex algorithms MUST include explanatory comments
- README files MUST be kept up-to-date with feature changes

### Error Handling

- All async operations MUST handle errors explicitly
- User-facing errors MUST be actionable and clear
- Internal errors MUST include sufficient debug context

## Architecture Overview

### High-Level Structure

This is a VS Code extension that provides Agentic Spec-Driven Development capabilities, integrating with **SpecKit**, **OpenSpec**, and **GitHub Copilot**.

#### Extension (src/)

- **Main Entry**: `src/extension.ts` - Registers all commands, providers, and services
- **Features**: Domain-specific modules (specs, hooks, steering, documents)
  - `features/spec/` - Spec management and review flow
  - `features/hooks/` - MCP hooks and automation
  - `features/steering/` - Constitution/agents management
  - `features/documents/` - Document preview and refinement
- **Providers**: VS Code Tree Views and UI providers
  - `providers/spec-explorer-provider.ts` - Specs tree view
  - `providers/hooks-explorer-provider.ts` - Hooks tree view
  - `providers/prompts-explorer-provider.ts` - Prompts tree view
- **Services**: Core business logic
  - `services/prompt-loader.ts` - Loads and compiles markdown prompts
  - `services/document-preview-service.ts` - Handles document rendering
- **Panels**: Webview panels for rich UI
  - `panels/document-preview-panel.ts` - Preview/refinement UI

#### Webview (ui/)

- **React 18** SPA with TypeScript
- **Components**: Reusable UI components in `ui/src/components/`
  - `spec-explorer/` - Spec review flow components
  - `hooks-view/` - Hook management components
  - `ui/` - Shared UI components (buttons, forms, etc.)
- **Bridge**: VS Code extension ↔ webview communication via `ui/src/bridge/`
- **Stores**: State management in `ui/src/stores/`
- **Build**: Vite for bundling

### Key Architectural Patterns

1. **Dual-Build System**:
   - Extension: esbuild (Node.js bundle)
   - Webview: Vite (browser bundle)
   - Dependencies installed in both root and `ui/` directories

2. **Message Passing**: Extension communicates with webview via VS Code postMessage API
   - Commands sent from webview → extension
   - State updates sent from extension → webview

3. **MCP Integration**: Hooks system integrates with GitHub Copilot's Model Context Protocol
   - `MCPDiscoveryService` discovers available MCP servers/tools
   - `HookExecutor` executes MCP actions based on triggers

4. **Review Flow**: Spec lifecycle management with status transitions
   - States: draft → review → reopened → archived
   - Change requests block archival until addressed
   - Telemetry tracks all state transitions

5. **Test Configuration**: Vitest with dual dependency resolution
   - UI dependencies in `ui/node_modules/`
   - Testing libraries in root `node_modules/`
   - Aliases configured in `vitest.config.ts` to resolve both

## Development Workflow

### Adding a New Feature

1. **Write tests first** (TDD is mandatory)
   - Unit tests: `tests/unit/`
   - Integration tests: `tests/integration/`
   - Webview tests: `ui/tests/` or `tests/unit/webview/`

2. **Implement feature**
   - Follow kebab-case naming
   - Use strict TypeScript
   - Add telemetry/logging for significant operations

3. **Before committing**

   ```bash
   npm test           # All tests must pass
   npm run check      # Linting and formatting must pass
   ```

4. **File a PR**
   - Tests included and passing
   - Constitution compliance verified
   - No test coverage decrease

### Running Tests for Specific Areas

```bash
# Extension tests
npm test -- tests/unit/features/spec/
npm test -- tests/integration/

# Webview tests
npm test -- ui/tests/
npm test -- tests/unit/webview/

# Specific feature
npm test -- -t "Review Flow"
npm test -- -t "MCP"
```

## Key Technologies

- **VS Code Extension API**: 1.84.0+
- **TypeScript**: 5.3+ (target: ES2022, strict mode)
- **React**: 18.3+ (webview only)
- **Vitest**: 3.2+ (testing framework)
- **Biome**: Linting and formatting
- **esbuild**: Extension bundling
- **Vite**: Webview bundling
- **GitHub Copilot Chat**: AI integration
- **MCP (Model Context Protocol)**: Automation hooks

## Integration Points

### GitHub Copilot Chat

- Extension sends prompts to Copilot Chat via `sendPromptToChat()`
- Prompts compiled from markdown files in `src/prompts/`
- Custom instructions configurable per operation type

### SpecKit / OpenSpec

- Extension detects spec system automatically
- Adapters in `utils/spec-kit-adapter.ts` provide unified interface
- SpecKit: `.specify/` directory structure
- OpenSpec: `openspec/` directory structure

### MCP Servers

- Discovered via GitHub Copilot Chat configuration
- Hooks can trigger MCP tools (create issues, send notifications, etc.)
- Graceful degradation when MCP unavailable

## Troubleshooting

### Tests Failing with "Cannot resolve import"

- Ensure UI dependencies installed: `npm run install:all`
- Check `vitest.config.ts` aliases are correct
- UI deps should be in `ui/node_modules/`

### Extension Not Loading

- Build extension: `npm run build:ext`
- Check output channel: "GatomIA" in VS Code
- Verify VS Code version >= 1.84.0

### Webview Not Rendering

- Build webview: `npm run build:webview`
- Check browser console in webview (Ctrl+Shift+I)
- Verify bridge communication in extension logs
