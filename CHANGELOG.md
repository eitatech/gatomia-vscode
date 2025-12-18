# 📦 Changelog

---

## v0.27.0 2025-12-17

### Added

- **Welcome Screen**: Comprehensive onboarding and management interface for GatomIA extension
  - **First-Time Setup**: Interactive welcome screen appears automatically on first activation to guide users through extension setup
  - **Dependency Detection**: Real-time detection of GitHub Copilot Chat, SpecKit CLI, and OpenSpec CLI with installation guidance
  - **Configuration Management**: Inline editing of 6 key settings (spec system, paths) with validation and instant feedback
  - **Learning Resources**: Curated documentation, examples, and tutorials organized by category (Getting Started, Concepts, Advanced)
  - **Feature Discovery**: Quick-access buttons for all extension features (Spec Management, Hooks, Steering, etc.)
  - **System Health**: Real-time diagnostics with 24-hour rolling window and 5-entry limit, showing errors/warnings with suggested actions
  - **Performance**: Loads in <2 seconds, UI updates in <500ms (verified with automated tests)
  - **Accessibility**: Full ARIA labels, keyboard navigation, screen reader support
  - **Theme Support**: Automatic light/dark theme adaptation using VS Code CSS variables
  - **Error Recovery**: Comprehensive error boundary and graceful degradation for all failure modes
  - **Persistence**: "Don't show on startup" preference with workspace state tracking
  - **Test Coverage**: 1,204 automated tests (234 for welcome screen alone)

---

## v0.26.2 2025-12-15

### Added

- **Document Dependency Tracking**: Intelligent system to detect when documents need updates based on changes in their dependencies
  - Automatic dependency detection based on document type hierarchy (spec → plan → tasks → checklist)
  - Version tracking with content hashing to detect real changes vs. progress updates
  - Structural hash for tasks/checklists that ignores checkbox state changes (detects only content modifications)
  - "Update Document" button appears automatically when dependencies change
  - Formatted prompts sent to appropriate agents with context about changed dependencies
  - Visual indicators showing which dependencies changed and when
  - Optional additional context field for user-specific update instructions
  - Persistent tracking across workspace sessions
  - 14 comprehensive unit tests ensuring reliability

**Dependency Hierarchy**:
- `spec.md` (base) → no dependencies
- `plan.md` → depends on `spec.md`
- `tasks.md` → depends on `spec.md` + `plan.md`
- `checklist.md` → depends on `tasks.md`
- `data-model.md` → depends on `spec.md`
- `api.md` → depends on `spec.md` + `data-model.md`
- `quickstart.md` → depends on `spec.md` + `plan.md`
- `research.md` → independent (supports spec but no hard dependency)

---

## v0.26.1 2025-12-15

### Fixed

- **Document Refinement**: Refinement requests now properly send feedback to the appropriate agent instead of just creating annotations
  - Refinement requests are sent to the correct SpecKit/OpenSpec agent based on document type (spec → `/speckit.specify`, plan → `/speckit.plan`, etc.)
  - Formatted prompts include document ID, section reference, issue type, and detailed description
  - Status messages now accurately reflect what happens ("Refinement sent to agent" instead of fictitious "queued" messages)
  - Added comprehensive logging for all refinement operations
  - Error handling with detailed feedback when agent communication fails
  - 10 new unit tests to ensure reliability

- **Task Group Navigation**: Fixed bug where clicking on phase headers (e.g., "Phase 1: Foundation & Core Types") would incorrectly trigger task execution
  - Phase headers now only expand/collapse when clicked (expected behavior)
  - Task execution only happens via the dedicated inline button (intended behavior)
  - Maintains proper separation between navigation and execution actions

---

## v0.26.0 2025-12-05

### Added

- **MCP Hooks Integration**: Complete implementation of Model Context Protocol (MCP) server integration for hooks automation
  - Browse and select MCP servers and tools configured in GitHub Copilot
  - Configure hooks to execute MCP actions automatically after agent operations
  - Visual indicators for server availability (green/red/gray badges)
  - Parameter mapping with context variables, literals, and templates
  - Automatic retry logic for transient failures (1 retry with 2s delay)
  - Large payload truncation (>1MB) with warnings
  - Graceful error handling with detailed logging
  - Pre-execution validation to prevent invalid hook execution
  - Error notifications with "Update Hook" and "Remove Hook" actions
  - Comprehensive test coverage (40 unit tests, 16 integration tests)
  - Complete documentation in README.md and quickstart guide

### Changed

- Enhanced hook validation to async for MCP server verification
- Improved error handling across all MCP services
- Updated HookManager to support MCP discovery service integration
- Optimized cache TTL to 5 minutes for MCP server discovery

### Fixed

- Server availability checks with graceful degradation
- Hook stability when MCP servers become unavailable
- Parameter validation with detailed error messages


