# 📦 Changelog

---

## v0.27.0 2025-12-17

### Added

- add continuous delivery workflow

### Changed

- fix issues

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

---

## v0.3.3 2025-11-23

### Added

- implement "New Agent File" command and menu integration

### Changed

- feature/new-agent-file
- add "New Agent File" button to Prompts view with command integration and ordering
- add "New Agent File" button to Prompts view with command integration
- Merge pull request #10 from atman-33/version-bump/v0.3.2

## v0.3.2 2025-11-22

### Changed

- Merge remote-tracking branch 'origin/main'
- update screenshot images
- Merge pull request #9 from atman-33/version-bump/v0.3.1

## v0.3.1 2025-11-22

### Changed

- update icon image
- Merge remote-tracking branch 'origin/main'
- add Project Agents group and rename functionality in Prompts explorer
- Merge pull request #8 from atman-33/version-bump/v0.3.0

## v0.3.0 2025-11-22

### Added

- update SVG icon design for improved visual clarity
- add rename functionality for prompts in the explorer view

### Changed

- feature/improve-prompts-view
- add Project Agents group and rename functionality in Prompts explorer
- add project instructions display in Prompts view with separate grouping
- Merge pull request #6 from atman-33/version-bump/v0.2.1

## v0.2.1 2025-11-22

### Added

- add support for project instructions label in prompts explorer
- enhance PromptsExplorerProvider to include project instructions group and update related tests
- reorder sidebar views in Spec and Prompts Explorers

### Changed

- feature/show-github-instructions
- add design, proposal, spec, and tasks for displaying project instructions in Prompts view
- add display order requirements for Spec and Prompts Explorers
- add proposal and requirements for reordering sidebar views in Spec and Prompts Explorers
- Merge pull request #4 from atman-33/version-bump/v0.2.0

### Fixed

- update prompt and steering explorer descriptions for clarity

## v0.2.0 2025-11-22

### Added

- add support for custom instructions in prompts for GitHub Copilot integration

### Changed

- feature/prompt-custom-footer
- add custom instructions structure to ConfigManager tests
- implement custom prompt instructions injection for GitHub Copilot integration
- add support for custom prompt instructions in GitHub Copilot integration
- Merge pull request #2 from atman-33/version-bump/v0.1.7

## v0.1.7 2025-11-21

- Initial implementation of Spec UI for Copilot features.
