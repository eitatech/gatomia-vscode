# Changelog

Notable published releases for GatomIA.

This file tracks tagged versions only and focuses on user-facing changes.
Versions earlier than `v0.26.0` predate this changelog format.

## v0.37.0 - 2026-04-21

### Added

- Added FIRE workflow definitions for orchestrator, planner, and builder
  agents.

### Changed

- Refreshed release metadata and lockfile for the `0.37.0` release.

## v0.36.0 - 2026-04-17

### Added

- Added AIDE workflow commands for AI-driven engineering flows.
- Added `speckit.critique.run` and
  `speckit.security-review.audit` commands.
- Added code preview support and retrospective artifacts for the extension
  docs tree work.
- Initialized Beads issue tracking for repository task management.

### Fixed

- Fixed `npm run check` violations and audit-related regressions before
  release.

### Changed

- Updated Rollup-related package source URLs to the npm registry.

## v0.35.0 - 2026-04-06

### Added

- Expanded cloud agent support with better session lifecycle management,
  cancellation, PR tracking, polling, and error handling.
- Added full spec dispatch support and multi-provider groundwork for cloud
  agents.
- Added Ralph autonomous implementation loop commands and shipped the Ralph
  extension as a submodule.

### Fixed

- Improved cloud agent polling reliability and file-save confirmation
  behavior.

### Changed

- Improved webview loading with lazy loading and CSP updates for Vite dynamic
  imports.
- Updated build dependencies, including Rollup and
  `copy-webpack-plugin`.

## v0.34.2 - 2026-02-24

### Added

- Added planning artifacts for the JetBrains extension effort, including
  spec, plan, research, and tasks.
- Improved the install-dependencies flow and related welcome-screen UI.

### Fixed

- Fixed prerequisite logic, CLI detection, error propagation, and test issues
  found during review.
- Normalized skill naming to lowercase for consistency.

### Changed

- Translated planning artifacts from Portuguese to English.
- Ignored the `.beads/` directory in the repository.

## v0.34.1 - 2026-02-20

### Added

- Redesigned the Create Spec form to use a single description field and image
  attachments.
- Added ACP Agent support to the MCP Tools Selector and Trigger Action
  Selector.
- Expanded unit and integration coverage for known-agent detection, hook
  preferences, spec explorer behavior, and activation flows.
- Refreshed generated project documentation.

### Fixed

- Refined replace-warning regex handling and adjusted the performance test
  threshold.

### Changed

- Updated development dependencies and test code for Vitest 4 compatibility.

## v0.34.0 - 2026-02-18

### Added

- Added global resource access consent management and related extension
  settings.

### Fixed

- Ignored `.opencode/bun.lockb` to keep local tooling artifacts out of
  version control.

## v0.33.1 - 2026-02-18

### Fixed

- Corrected `markdown-it` dependency versioning.

### Changed

- Removed stale documentation files and added unit coverage for
  `DocumentPreviewService`.

## v0.33.0 - 2026-02-04

### Added

- Added wiki and document preview enhancements, including YAML frontmatter
  parsing, Mermaid rendering, and a Wiki Explorer provider.
- Improved preview and refine UI with richer trigger labels, icon-based
  actions, and document metadata in the footer.
- Added GatomIA skill resources and related documentation for the hooks
  automation platform.

### Changed

- Hardened HTML sanitization to reduce DOM text reinterpretation risks.

## v0.32.2 - 2026-01-30

### Changed

- Updated Copilot and VS Code guidance, normalized action naming, and refined
  feature actions.

## v0.32.1 - 2026-01-29

### Added

- Added automatic MCP config path detection for VS Code and compatible IDEs.
- Added GitHub Copilot CLI options for model execution, permissions, output
  logging, and session configuration.

### Fixed

- Resolved pre-existing hooks test failures and dependency-related issues.

### Changed

- Improved hook validation, agent discovery, documentation, and test coverage
  for the custom agent hooks experience.

## v0.32.0 - 2026-01-29

### Added

- Added hook timing controls for before/after execution.
- Added hook output capture variables:
  `$agentOutput`, `$clipboardContent`, and `$outputPath`.
- Added richer hook UI for template variables and background/local agent
  execution.

### Changed

- Updated hook execution, command completion, and template parsing to support
  timing and captured outputs.
- Expanded tests and documentation for the new hooks behavior.

## v0.31.0 - 2026-01-24

### Added

- Added Copilot Agents integration with agent discovery, registration, tool
  execution, resource loading, hot reload, settings, and example resources.
- Added comprehensive documentation and test coverage for the agent feature
  set.

### Changed

- Applied follow-up polish across UI content, skills, and constitution-related
  project guidance.

## v0.30.1 - 2026-01-24

### Added

- Added the Actions Explorer to manage multiple action types in place of the
  old Prompts Explorer.
- Added configuration and test coverage for agent and skill paths.

### Changed

- Refactored Steering Explorer child item generation and cleaned up related
  tests.

## v0.30.0 - 2026-01-07

### Added

- Added real MCP server discovery and UI tool selection.

### Changed

- Streamlined the steering UI and instruction-rule system.
- Refreshed branding assets and cleaned up unit-test implementation details.

## v0.29.0 - 2026-01-05

### Added

- Added steering instruction rules for project and user scopes, with filename
  normalization, template generation, and no-overwrite protection.
- Added constitution creation from the Steering toolbar through Copilot Chat.
- Consolidated the Steering explorer structure and added quick toolbar actions
  for project instructions, user instructions, and constitution creation.

### Changed

- Simplified Steering view grouping and expanded README coverage for the new
  workflows.

## v0.28.0 - 2026-01-05

### Added

- Added automatic transition from Current to Review when specs are complete.
- Added commands to reopen specs from Review back to Current.
- Added shared command-argument resolution for Spec Explorer items.

### Changed

- Improved review-flow persistence, pending summaries, and blocker messaging.

### Fixed

- Made archive and send-to-review commands more robust for Spec Explorer item
  arguments.

## v0.27.1 - 2025-12-18

### Added

- Added the Welcome Screen with Zustand-based state management and VS Code
  integration.

### Fixed

- Disabled unfinished header actions and cleaned up related documentation and
  wording issues.

## v0.27.0 - 2025-12-17

### Added

- Added the continuous delivery workflow for the extension.

### Changed

- Landed maintenance fixes ahead of the welcome-screen rollout.

## v0.26.0 - 2025-12-17

### Added

- Added MCP hooks integration for GitHub Copilot-configured MCP servers and
  tools.
- Added hook execution with parameter mapping, availability indicators,
  validation, retry handling, and test coverage.
- Added end-user documentation for configuring and using MCP-powered hooks.

### Changed

- Improved hook validation, MCP discovery integration, and cache behavior.

### Fixed

- Improved graceful handling when MCP servers are unavailable and when hook
  parameters are invalid.
