---
version: "1.0"
owner: "Italo A. G."
---

# Implementation Plan: Automatic Document Version and Author Tracking

**Branch**: `012-spec-version-tracking` | **Date**: 2026-01-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-spec-version-tracking/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement automatic version tracking ({major}.{minor} format: 1.0→1.9→2.0) and author attribution (from Git) for all SpecKit documents (spec.md, plan.md, tasks.md). The system will automatically initialize VERSION and OWNER fields in document frontmatter, increment versions on save (with 30-second debounce), and persist version history (50 entries per document with FIFO rotation). Implementation via post-processing hooks ensures SpecKit template updateability is preserved.

**Technical Approach**: VS Code Extension API (FileSystemWatcher + workspace.onDidSaveTextDocument) + gray-matter for YAML frontmatter parsing + workspace state for version history persistence + Git CLI integration for author info.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)  
**Primary Dependencies**: VS Code Extension API 1.84.0+, gray-matter (YAML frontmatter parsing), Node.js child_process (Git CLI)  
**Storage**: VS Code Workspace State API (version history metadata, 50 entries per document with FIFO)  
**Testing**: Vitest 3.2+ (unit tests + integration tests for file watch scenarios)  
**Target Platform**: VS Code Extension Host (Node.js environment)  
**Project Type**: VS Code Extension (single project structure with src/ and tests/)  
**Performance Goals**: <100ms save latency overhead, <1s version display update in Spec Explorer  
**Constraints**: No modification of SpecKit templates, atomic version updates (prevent race conditions), 30-second debounce for version increments  
**Scale/Scope**: 100+ spec documents per workspace, 50 version history entries per document

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Kebab-Case File Naming ✅ PASS

- All new files will follow kebab-case: `document-version-service.ts`, `git-user-info.ts`, `version-history-manager.ts`
- Test files: `document-version-service.test.ts`, `git-user-info.test.ts`
- No violations expected

### II. TypeScript-First Development ✅ PASS

- All code written in TypeScript 5.3+ with `strict: true`
- No `any` types without explicit justification
- Complete type definitions for:
  - DocumentMetadata interface
  - VersionHistoryEntry interface
  - GitUserInfo interface
  - DocumentVersionService class API

### III. Test-First Development (TDD) ✅ PASS

- Tests will be written BEFORE implementation:
  1. Unit tests for version increment logic
  2. Unit tests for Git user info extraction
  3. Integration tests for file watch + version update
  4. Integration tests for debounce mechanism
  5. Integration tests for FIFO rotation
- Red-Green-Refactor cycle mandatory
- Target: 90%+ test coverage for new code

### IV. Observability & Instrumentation ✅ PASS

- Telemetry for version increments (success/failure rates)
- Logging for all version changes to extension output channel (FR-009)
- Error logging for Git config failures, YAML parsing errors, infinite save loop detection
- Performance instrumentation for save latency overhead (<100ms target)
- Debug context for all error scenarios (malformed versions, Git unavailable, etc.)

### V. Simplicity & YAGNI ✅ PASS

- Implementing ONLY what is needed NOW:
  - Version increment on save ✅
  - Owner field population ✅
  - History persistence (50 entries) ✅
  - Reset command ✅
  - Spec Explorer display ✅
- NOT implementing:
  - Full version history UI (out of scope)
  - Version comparison/diff (out of scope)
  - Custom versioning schemes (out of scope)
  - Export functionality (out of scope)
- No premature abstractions; refactor when patterns emerge (Rule of Three)

## Project Structure

### Documentation (this feature)

```text
specs/012-spec-version-tracking/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── document-version-service.api.ts  # Service API contract
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── features/
│   └── documents/
│       └── version-tracking/
│           ├── document-version-service.ts      # Main service orchestrating version tracking
│           ├── version-history-manager.ts       # Manages workspace state persistence (50-entry FIFO)
│           ├── version-incrementer.ts           # Core logic for {major}.{minor} increment
│           ├── frontmatter-processor.ts         # YAML parsing/writing with gray-matter
│           └── debounce-tracker.ts              # 30-second debounce for version increments
├── utils/
│   ├── git-user-info.ts                         # Git CLI integration for user.name/email
│   └── file-change-detector.ts                  # Detects body content changes (excludes frontmatter)
├── providers/
│   └── spec-explorer-provider.ts                # MODIFY: Add version display to tree items
├── commands/
│   └── reset-document-version-command.ts        # Command: Reset version to 1.0
└── extension.ts                                 # MODIFY: Register commands, activate file watchers

tests/
├── unit/
│   ├── features/
│   │   └── documents/
│   │       └── version-tracking/
│   │           ├── version-incrementer.test.ts
│   │           ├── frontmatter-processor.test.ts
│   │           ├── version-history-manager.test.ts
│   │           └── debounce-tracker.test.ts
│   └── utils/
│       ├── git-user-info.test.ts
│       └── file-change-detector.test.ts
└── integration/
    └── document-version-tracking.test.ts        # End-to-end: create→edit→save→version increments
```

**Structure Decision**: Single project structure (Option 1) is appropriate. This feature is a self-contained extension feature that fits naturally into the existing `src/features/documents/` directory. The modular structure (service, manager, incrementer, processor, tracker) follows Single Responsibility Principle and enables TDD with focused unit tests.

**Key Design Decisions**:
- **Feature isolation**: All version tracking logic under `src/features/documents/version-tracking/` for clear ownership
- **Separation of concerns**: 
  - `document-version-service.ts` orchestrates the workflow
  - `version-incrementer.ts` contains pure version logic (easily testable)
  - `frontmatter-processor.ts` handles YAML I/O (mockable for tests)
  - `version-history-manager.ts` manages workspace state (mockable for tests)
  - `debounce-tracker.ts` implements time-based logic (easily testable with fake timers)
- **Shared utilities**: Git user info used by multiple features → `src/utils/`
- **Minimal modification**: Only two existing files modified (spec-explorer-provider.ts for display, extension.ts for registration)

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**Status**: ✅ No violations. All constitution checks passed.

This feature follows all established patterns:
- Kebab-case file naming (no exceptions needed)
- TypeScript strict mode (no `any` types)
- TDD approach (tests before implementation)
- Observability built-in (telemetry, logging, error reporting)
- YAGNI compliance (only implementing spec requirements, no premature abstractions)

---

## Phase 0: Research & Technology Decisions

*Output: `research.md` document resolving all unknowns from Technical Context*

**Research Status**: ✅ Complete (all technical decisions made during specification phase)

### Technology Stack Decisions

All technology choices are determined and no research needed:

#### 1. YAML Frontmatter Parsing Library
- **Decision**: gray-matter 4.x
- **Rationale**: De facto standard for YAML frontmatter parsing in Node.js; used by many static site generators (Gatsby, Jekyll, Hugo); excellent TypeScript support; handles edge cases (missing frontmatter, malformed YAML)
- **Alternatives Considered**:
  - front-matter: Less actively maintained, limited TypeScript support
  - remark-frontmatter: Tightly coupled to remark parser, overkill for simple YAML extraction
  - custom regex parsing: Error-prone, doesn't handle YAML edge cases (multiline strings, escaped characters)

#### 2. File Watching Mechanism
- **Decision**: VS Code API `workspace.onDidSaveTextDocument` + `vscode.workspace.createFileSystemWatcher`
- **Rationale**: Built into VS Code Extension API; automatically filters for workspace files; handles remote environments (SSH, WSL); provides document URI + content; no external dependencies
- **Alternatives Considered**:
  - chokidar: External dependency, redundant with VS Code built-in watchers
  - Node.js fs.watch: Lower-level API, doesn't handle remote environments
  - Polling: Inefficient, high resource usage for large workspaces

#### 3. Git User Information Extraction
- **Decision**: Node.js `child_process.execSync` with `git config user.name` and `git config user.email`
- **Rationale**: Lightweight, no external dependencies, standard Git CLI interface, works in all environments where Git is installed
- **Alternatives Considered**:
  - simple-git library: External dependency, overkill for two simple config reads
  - VS Code Git extension API: Coupling to another extension, availability not guaranteed
  - Environment variables ($GIT_AUTHOR_NAME): Not universally set, less reliable

#### 4. Version History Persistence
- **Decision**: VS Code Workspace State API (`context.workspaceState.update/get`)
- **Rationale**: Built-in persistent storage per workspace; survives extension reloads; JSON serialization; no file I/O overhead
- **Alternatives Considered**:
  - Separate JSON file in `.vscode/`: Manual file I/O, potential conflicts, not atomic
  - Git notes: Complex API, not intended for application metadata
  - In-memory only: Lost on extension reload, defeats audit trail purpose

#### 5. Debounce Implementation
- **Decision**: Custom debounce tracker with Map<documentPath, lastIncrementTimestamp>
- **Rationale**: Simple, efficient, no external dependencies, easy to test with fake timers, integrates naturally with file watcher events
- **Alternatives Considered**:
  - lodash.debounce: External dependency for simple time tracking, over-engineered
  - RxJS throttle/debounce: Heavy dependency for single feature
  - No debounce: Version inflation on rapid saves (rejected per spec clarification)

### Architectural Patterns

#### 1. Post-Processing Hook Pattern
- **Decision**: Event-driven architecture using VS Code file watchers + document save events
- **Implementation**: 
  ```typescript
  workspace.onDidSaveTextDocument(async (document) => {
    if (isSpecKitDocument(document)) {
      await documentVersionService.processDocumentSave(document);
    }
  });
  ```
- **Rationale**: Non-invasive, doesn't modify templates, triggered automatically, aligns with VS Code extension patterns

#### 2. Service Layer Pattern
- **Decision**: DocumentVersionService as facade coordinating specialized components
- **Rationale**: Simplifies testing (mock dependencies), enforces SRP, makes workflow explicit
- **Component responsibilities**:
  - DocumentVersionService: Orchestration (entry point for save events)
  - VersionIncrementer: Pure version logic (1.0→1.1, 1.9→2.0)
  - FrontmatterProcessor: YAML I/O (extract metadata, update fields, write back)
  - VersionHistoryManager: Persistence (workspace state CRUD, FIFO rotation)
  - DebounceTracker: Time-based gating (prevent rapid increments)

#### 3. Error Recovery Strategy
- **Decision**: Graceful degradation with logging
- **Scenarios**:
  - Git not configured → Use system username, log warning
  - Malformed version → Normalize to 1.0, log correction
  - YAML parsing error → Skip version update, log error
  - Workspace state full → Rotate entries, log rotation event
- **No user interruption**: Errors don't block document saves, only version tracking fails

### Implementation Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Infinite save loop (save → update → trigger save) | High: Extension hangs, user data loss | Implement "dirty flag" tracking; only update if content actually changed; add recursion depth limit |
| Race condition on rapid saves | Medium: Incorrect version increments | Use debounce (30s minimum between increments); atomic workspace state updates |
| Large workspace performance degradation | Medium: Slow extension activation | Lazy initialization; cache version info; limit file watchers to `.specify/` and `specs/` directories |
| SpecKit template structure changes | Low: Feature breaks after update | Use defensive programming; handle missing frontmatter gracefully; add integration tests simulating template changes |
| Git not available in environment | Low: Owner field incorrect | Fallback to system username with placeholder email; log warning for user to configure Git |

### Best Practices Research

#### VS Code Extension File Watchers
- **Pattern**: Create watchers in `activate()`, dispose in `deactivate()`
- **Glob patterns**: Use `**/*.md` with path filtering (more efficient than watching all files)
- **Performance**: Debounce watcher events (builtin VS Code debouncing + our 30s debounce)
- **Remote environments**: VS Code API handles SSH/WSL automatically; no special handling needed

#### Workspace State Management
- **Storage limits**: No documented limit, but recommend <1MB per extension
- **Serialization**: Only JSON-serializable types (no functions, Date objects, circular references)
- **Versioning**: Include schema version in stored objects for future migrations
- **Cleanup**: Implement FIFO rotation to prevent unbounded growth

#### YAML Frontmatter Best Practices
- **Parsing**: Use strict mode to catch malformed YAML early
- **Writing**: Preserve original formatting where possible (gray-matter.stringify options)
- **Validation**: Check for required fields (title, status) to detect corrupted documents
- **Edge cases**: Handle empty frontmatter, missing delimiters, Unicode characters

---

**Research Complete**: All unknowns resolved. Ready for Phase 1 (Design & Contracts).
