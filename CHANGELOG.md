# 📦 Changelog

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

