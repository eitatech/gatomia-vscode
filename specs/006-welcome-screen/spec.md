# Feature Specification: Extension Welcome Screen

**Feature Branch**: `006-welcome-screen`  
**Created**: December 16, 2025  
**Status**: Draft  
**Input**: User description: "create the extension welcome screen, with all configurations details, useful information about how use the hole extension capabilities with all functionalities with clear, smooth and fluid use."

## Clarifications

### Session 2025-12-16

- Q: How should the system determine "first time" for automatic welcome screen display - globally across all workspaces, per-workspace, based on config file detection, or always show? → A: Track per-workspace (show once per workspace, stored in workspaceState) - allows different projects to trigger welcome
- Q: How many errors/warnings should be displayed and how far back should the system look - current session only, time-limited with count, unlimited with count, or all errors grouped by severity? → A: Show last 5 errors/warnings from the past 24 hours (time-limited + count-limited)
- Q: Which settings should be editable from the welcome screen - all settings, only 3 core settings, 5-7 most impactful settings, or read-only with navigation button? → A: Only settings related to which agent will be used (spec system selection: OpenSpec, SpecKit, Auto, and related path configurations)
- Q: Should installation links for missing dependencies execute installations automatically, open marketplace/copy commands, provide text documentation links only, or show copyable code blocks? → A: Open Extensions marketplace for extensions + copy CLI install commands to clipboard with instructions
- Q: What should be the order and hierarchy of sections on the welcome screen? → A: Setup → Features → Configuration → Status → Learning

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-Time Extension Activation (Priority: P1)

A developer installs GatomIA for the first time and opens VS Code. They see a welcoming screen that immediately shows them what the extension does and guides them through essential setup steps (GitHub Copilot Chat dependency, choosing SpecKit or OpenSpec).

**Why this priority**: This is the critical first impression that determines whether users successfully onboard or abandon the extension. Without this, users may be confused about prerequisites and how to start.

**Independent Test**: Install extension in a fresh VS Code workspace with no prior configuration. Welcome screen should appear automatically, display prerequisite status (GitHub Copilot Chat installed/missing), and provide clear next steps. User can complete setup without consulting external documentation.

**Acceptance Scenarios**:

1. **Given** a user installs GatomIA for the first time, **When** they open VS Code, **Then** the welcome screen appears automatically in a new editor tab
2. **Given** the welcome screen is open, **When** GitHub Copilot Chat is not installed, **Then** a prominent alert shows the missing prerequisite with an "Install" button that opens the Extensions marketplace to the GitHub Copilot Chat extension page
3. **Given** the welcome screen is open, **When** GitHub Copilot Chat is installed, **Then** a success indicator shows the dependency is satisfied
4. **Given** the welcome screen displays setup options, **When** the user selects "SpecKit" or "OpenSpec", **Then** the system provides guided initialization with clear instructions
5. **Given** the user completes initial setup, **When** they click "Get Started", **Then** the welcome screen shows next steps for creating their first spec

---

### User Story 2 - Quick Access to Features and Commands (Priority: P2)

An existing user returns to GatomIA and wants to quickly access key features (create spec, manage prompts, configure hooks). They open the welcome screen from the command palette and see an organized dashboard with direct links to all major features.

**Why this priority**: Reduces friction for returning users who know the extension exists but need a quick reference to access specific capabilities without hunting through menus.

**Independent Test**: Open welcome screen via command palette. User can navigate to any major feature (Spec Management, Prompt Management, Hooks, Steering) with a single click. Each feature section displays available actions clearly.

**Acceptance Scenarios**:

1. **Given** the user opens the command palette, **When** they run "GatomIA: Show Welcome Screen", **Then** the welcome screen opens in the current editor
2. **Given** the welcome screen is displayed, **When** the user views the feature sections, **Then** they see organized cards for Spec Management, Prompt Management, Hooks, and Steering
3. **Given** the user clicks a feature action button, **When** the action requires a command, **Then** the corresponding VS Code command executes immediately
4. **Given** the user clicks a documentation link, **When** the link is to an external resource, **Then** the resource opens in the default browser

---

### User Story 3 - Interactive Configuration Overview (Priority: P2)

A user wants to review and adjust GatomIA settings without navigating through VS Code's settings UI. They open the welcome screen and see a "Configuration" section displaying current settings with inline edit capabilities for common options.

**Why this priority**: Centralizes configuration management in a user-friendly interface, making it easier to understand what each setting does and adjust values without context switching.

**Independent Test**: Open welcome screen and navigate to configuration section. Current settings display accurately. User can modify spec system settings (spec system selection and related paths) directly from the welcome screen and changes persist.

**Acceptance Scenarios**:

1. **Given** the welcome screen is open, **When** the user navigates to the Configuration section, **Then** they see current values for spec system-related settings (spec system, SpecKit paths, OpenSpec paths) and read-only display of other settings
2. **Given** the configuration section displays settings, **When** the user clicks an editable spec system setting, **Then** an inline editor appears appropriate for the setting type (dropdown for spec system selection, text input for path configurations)
3. **Given** the user modifies a setting value, **When** they confirm the change, **Then** the new value saves to VS Code settings and updates immediately in the UI
4. **Given** settings are displayed, **When** a setting has a description, **Then** a tooltip or help icon shows the setting's purpose and valid values

---

### User Story 4 - Learning Resources and Documentation (Priority: P3)

A user wants to understand advanced features like MCP Hooks integration or migration between spec systems. They open the welcome screen and find a "Learn More" section with tutorials, video links, and documentation organized by topic.

**Why this priority**: Empowers users to self-serve when exploring advanced features, reducing support burden and increasing feature adoption over time.

**Independent Test**: Open welcome screen and locate learning resources section. User can find documentation or tutorials for at least 5 major features. Links are accessible and properly categorized.

**Acceptance Scenarios**:

1. **Given** the welcome screen is open, **When** the user scrolls to the learning resources section, **Then** they see organized categories for Getting Started, Advanced Features, and Troubleshooting
2. **Given** learning resources are displayed, **When** the user clicks a documentation link, **Then** the relevant documentation opens in their default browser
3. **Given** the user views tutorials, **When** video content is available, **Then** preview thumbnails display with duration indicators
4. **Given** the user searches learning resources, **When** they enter a keyword, **Then** relevant resources filter in real-time

---

### User Story 5 - Extension Status and Health Check (Priority: P3)

A user experiencing issues with GatomIA opens the welcome screen to diagnose problems. They see a "System Status" section showing the health of dependencies (GitHub Copilot Chat, SpecKit/OpenSpec CLI), extension version, and recent errors.

**Why this priority**: Provides self-service troubleshooting capability, helping users identify and resolve common issues without creating support tickets.

**Independent Test**: Open welcome screen with various system states (missing dependencies, outdated CLI versions, extension errors). Status section accurately reflects current state and provides actionable remediation steps.

**Acceptance Scenarios**:

1. **Given** the welcome screen is open, **When** the user views the System Status section, **Then** they see indicators for GitHub Copilot Chat, SpecKit/OpenSpec CLI, and extension health
2. **Given** a dependency is missing or outdated, **When** the status displays, **Then** a warning indicator shows with a clear description and remediation action ("Install" button for extensions, "Copy Install Command" button for CLIs that copies the command to clipboard with instructions)
3. **Given** the extension has encountered errors, **When** the user views diagnostics, **Then** recent error messages display with timestamps and suggested solutions
4. **Given** all systems are healthy, **When** the status displays, **Then** success indicators show with version numbers and last-checked timestamps

---

### Edge Cases

- What happens when the welcome screen is opened while another instance is already open (prevent duplicates or focus existing tab)?
- How does the system handle welcome screen display when the workspace has no folder open (show limited information or prompt to open workspace)?
- What happens when network connectivity is unavailable and external resources need to be loaded (show cached content or offline indicator)?
- How does the system handle CLI detection when multiple versions are installed (show all versions or prioritize the active one)?
- What happens when the user's VS Code theme changes (ensure welcome screen styling adapts appropriately)?
- How does the screen handle very long setting values or descriptions (truncate with expand option)?


## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display the welcome screen automatically when the extension is activated for the first time in a workspace, tracking first-time status per workspace using workspace state storage (allows each workspace/project to trigger welcome screen independently)
- **FR-002**: System MUST provide a command "GatomIA: Show Welcome Screen" accessible from the command palette to open the welcome screen at any time
- **FR-003**: System MUST check for GitHub Copilot Chat extension installation status and display the result prominently on the welcome screen
- **FR-004**: System MUST detect the current spec system configuration (SpecKit, OpenSpec, or auto) and display relevant setup guidance
- **FR-005**: System MUST provide clickable action buttons for all major features (Create Spec, Manage Prompts, Configure Hooks, Create Constitution)
- **FR-006**: System MUST display current configuration values for all GatomIA settings in an organized format, distinguishing between editable and read-only settings
- **FR-007**: System MUST allow users to modify spec system-related settings directly from the welcome screen interface, while displaying other settings as read-only with option to open full settings UI. Editable settings (exact keys): `gatomia.specSystem` (enum: auto/speckit/openspec), `gatomia.speckit.specsPath` (string), `gatomia.speckit.memoryPath` (string), `gatomia.speckit.templatesPath` (string), `gatomia.openspec.path` (string), `gatomia.prompts.path` (string). All other settings are read-only from the welcome screen
- **FR-008**: System MUST persist setting changes immediately to VS Code's configuration storage
- **FR-009**: System MUST organize feature information into distinct, visually separated sections in the following order: Setup (dependencies and initialization), Features (Specs, Prompts, Hooks, Steering), Configuration (spec system settings), Status (diagnostics and health), Learning (documentation and tutorials)
- **FR-010**: System MUST display CLI installation status for SpecKit and OpenSpec when applicable
- **FR-011**: System MUST provide direct links to installation for missing dependencies - opening VS Code Extensions marketplace for GitHub Copilot Chat extension, and copying CLI installation commands to clipboard with notification and instructions for SpecKit/OpenSpec CLIs
- **FR-012**: System MUST show the extension version number and a link to the changelog
- **FR-013**: System MUST display recent errors or warnings from extension operations in a diagnostics section, showing the last 5 errors/warnings from the past 24 hours with timestamps and suggested solutions. Tracked operations include: spec file operations, hook execution, prompt generation, dependency detection, configuration updates, and system diagnostics. General VS Code errors are excluded
- **FR-014**: System MUST provide quick-start tutorials or walkthroughs for first-time users
- **FR-015**: System MUST categorize learning resources by user experience level (Beginner, Intermediate, Advanced) and display them ordered by: (1) Category sequence: Getting Started → Advanced Features → Troubleshooting, (2) Within each category: alphabetical by title, (3) Search results: relevance score (keyword match count descending) then alphabetical by title
- **FR-016**: System MUST support light and dark themes automatically based on VS Code's active color theme
- **FR-017**: System MUST prevent opening multiple instances of the welcome screen (focus existing tab if already open)
- **FR-018**: System MUST load the welcome screen within 2 seconds under normal conditions (defined as: workspace with <10,000 files and <100 MB total size, online network with <100ms latency, no other extensions performing intensive operations, system with available memory >500 MB)
- **FR-019**: System MUST provide a "Don't show on startup" option that users can toggle to control automatic display (preference can be changed at any time from the welcome screen, takes effect for subsequent workspace activations)
- **FR-020**: System MUST execute VS Code commands directly when feature action buttons are clicked (no intermediate navigation)

### Key Entities

- **Welcome Screen Tab**: The webview panel displaying the welcome interface with sections for setup, features, configuration, learning, and status
- **Feature Section**: Organized card or panel displaying information about a specific capability (Specs, Prompts, Hooks, Steering) with action buttons
- **Configuration Item**: Individual setting display showing current value, description, and edit controls
- **Dependency Status**: Health indicator for required components (GitHub Copilot Chat, SpecKit CLI, OpenSpec CLI)
- **Learning Resource**: Categorized documentation, tutorial, or video link with metadata (title, description, category, URL)
- **System Diagnostic**: Error or warning message with timestamp, severity level, and suggested remediation action


## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: First-time users can complete initial setup (verify dependencies, choose spec system) within 3 minutes using only the welcome screen
- **SC-002**: 90% of users who view the welcome screen can successfully create their first spec without consulting external documentation
- **SC-003**: Welcome screen loads and becomes interactive within 2 seconds of activation under normal conditions (as defined in FR-018: workspace <10,000 files/<100 MB, network <100ms latency, available memory >500 MB, no intensive extension operations)
- **SC-004**: Users can access any major feature (Create Spec, Manage Prompts, Configure Hooks) with maximum 2 clicks from the welcome screen
- **SC-005**: Configuration changes made through the welcome screen persist correctly in 100% of cases
- **SC-006**: System accurately detects and displays dependency status (GitHub Copilot Chat, CLIs) with zero false positives or negatives
- **SC-007**: Users can resolve at least 80% of common setup issues using only information and actions provided in the welcome screen
- **SC-008**: Extension remains responsive (UI updates within 500ms) while loading welcome screen content
- **SC-009**: Welcome screen adapts correctly to both light and dark themes with no visual artifacts
- **SC-010**: Users who disable "show on startup" can re-access the welcome screen via command palette 100% of the time

