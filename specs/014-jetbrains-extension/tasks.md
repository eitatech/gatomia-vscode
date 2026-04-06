# Tasks: GatomIA for JetBrains IDEs

**Feature**: `014-jetbrains-extension`
**Branch**: `claude/jetbrains-extension-plan-jB2yS`

---

## Phase 1 — Foundation and Structure

- [ ] **TASK-01** Create `gatomia-jetbrains` repository with IntelliJ Platform Plugin template
  - Use [intellij-platform-plugin-template](https://github.com/JetBrains/intellij-platform-plugin-template) as a base
  - Configure `build.gradle.kts` with IntelliJ Platform Gradle Plugin v2.3.0+
  - Configure `gradle.properties` with versions (SDK: 2024.1, since-build: 241)
  - Configure `.github/workflows/build.yml` for CI

- [ ] **TASK-02** Create complete `plugin.xml` with all declared extensions
  - Tool Windows: Specs, Hooks, Steering, Actions
  - Application Services: GatomiaSettings
  - Project Services: SpecManagerService, HookManagerService, SteeringManagerService, PromptLoaderService
  - Listeners: ProjectOpenListener, FileChangeListener
  - Configurable: GatomiaSettingsConfigurable
  - Action groups and declared actions

- [ ] **TASK-03** Implement `GatomiaSettings` (PersistentStateComponent)
  - Fields: specSystem, specsPath, promptsPath, chatLanguage, agentsResourcesPath, enableHotReload
  - View visibility fields
  - Automatic XML serialization via @State

- [ ] **TASK-04** Implement `SpecManagerService` (Project Service)
  - Read specs from configured directory (SpecKit or OpenSpec)
  - Automatic detection of active system
  - Return list of specs with metadata (name, status, dates)
  - Support for manual refresh

- [ ] **TASK-05** Implement `SpecToolWindow` with basic tree view
  - Root nodes: Current, Review, Archived
  - Sub-nodes: spec folders with their files (spec.md, plan.md, tasks.md)
  - Custom renderer with icons
  - Toolbar: Create, Refresh, Settings
  - Double-click: opens file in editor

- [ ] **TASK-06** Implement `SteeringManagerService` and `SteeringToolWindow`
  - Reads Constitution, AGENTS.md, instruction rules (project + user)
  - Tree view with groups: Constitution, Project Rules, User Rules
  - Toolbar: Create Constitution, Create Project Rule, Create User Rule, Refresh

- [ ] **TASK-07** Implement `FileChangeListener` (BulkFileListener)
  - Monitors changes in spec files (*.md in spec folders)
  - Notifies services via MessageBus to refresh tree views
  - Configurable via `enableHotReload` setting

- [ ] **TASK-08** Implement `ProjectOpenListener`
  - Initializes services when project opens
  - Verifies dependencies (SpecKit/OpenSpec CLIs)
  - Displays Welcome Screen on first activation

- [ ] **TASK-09** Unit tests for SpecManagerService and SteeringManagerService
  - Coverage: spec reading, system detection, frontmatter parsing

---

## Phase 2 — Actions and CLI Integration

- [ ] **TASK-10** Implement `CliRunner` utility
  - External process execution with output streaming
  - Coroutines support (Dispatchers.IO)
  - CLI installation detection (isInstalled check)
  - Configurable timeout

- [ ] **TASK-11** Implement `DiagnosticsService`
  - Verifies: SpecKit CLI, OpenSpec CLI, Git, JetBrains AI Assistant
  - Returns status of each dependency
  - Used by Welcome Screen

- [ ] **TASK-12** Implement `CreateSpecAction`
  - Native input dialog (fields: description, spec system)
  - Runs `specify specify` or `openspec create` via CliRunner
  - Fallback: assembles prompt and copies to clipboard + opens AI Chat
  - Success/error notification

- [ ] **TASK-13** Implement `ImplTaskAction` and `RunTaskAction`
  - Reads tasks.md from selected spec
  - Markdown checklist parser to extract pending tasks
  - Presents task list in dialog
  - Runs task via CLI or opens AI with task context

- [ ] **TASK-14** Implement `DeleteSpecAction` with confirmation
  - Confirmation dialog before deleting
  - Move to Archived or permanently remove

- [ ] **TASK-15** Implement `ActionsToolWindow` (prompts/agents explorer)
  - Reads files from `.github/prompts/`, `.github/instructions/`, `.github/agents/`
  - Tree view with groups: Prompts, Instructions, Agents, Skills
  - Actions: Run Prompt, Create Prompt, Rename, Delete

- [ ] **TASK-16** Implement `CreatePromptAction` and `RunPromptAction`
  - Create: creates `.md` file in `.github/prompts/` from template
  - Run: reads prompt file content, copies/sends to AI

- [ ] **TASK-17** Implement `CreateConstitutionAction`, `CreateUserRuleAction`, `CreateProjectRuleAction`
  - Name/description dialog
  - Creates file in correct location from template
  - Opens file in editor

- [ ] **TASK-18** Implement `GatomiaSettingsConfigurable` (Settings UI)
  - Settings panel with native UI fields (Kotlin UI DSL)
  - Groups: General, Spec Management, Views, Agents
  - Apply/Reset/Cancel working correctly

- [ ] **TASK-19** Implement `NotificationUtils`
  - Wrappers for different notification types
  - Support for clickable actions in notifications
  - Consistent Group ID

- [ ] **TASK-20** Unit tests for CliRunner, CreateSpecAction, parsers

---

## Phase 3 — JCEF UI

- [ ] **TASK-21** Create JCEF bridge on the TypeScript side (`ui/src/bridge/jcef-bridge.ts`)
  - Implements same interface as the VSCode bridge
  - Uses `window.cefQuery` to send messages to Kotlin
  - Uses `CustomEvent` to receive messages from Kotlin
  - Feature detection: detects if running in JCEF or VSCode

- [ ] **TASK-22** Adapt UI build for `jcef` target
  - New script `npm run build:jcef` in `ui/package.json`
  - Output goes to `../gatomia-jetbrains/src/main/resources/webview/`
  - Bridge replacement at build time

- [ ] **TASK-23** Implement `GatomiaJcefPanel` base (Kotlin)
  - Wrapper over `JBCefBrowser`
  - Message router setup (CefQueryHandler)
  - `sendToUI(type, payload)` method via executeJavaScript
  - Abstract method `handleMessage(type, payload)`
  - JCEF availability check

- [ ] **TASK-24** Implement `CreateSpecPanel` (JCEF)
  - Opens the React spec creation UI inside JetBrains
  - Handlers for: form submit, cancel, attach image
  - Closes panel after successful creation

- [ ] **TASK-25** Implement `DocumentPreviewPanel` (JCEF)
  - Loads the React document preview UI
  - Synchronization with file on disk via VirtualFileListener
  - Refinement actions (Refine, Edit)

- [ ] **TASK-26** Implement `WelcomePanel` (JCEF)
  - Reuses React Welcome Screen
  - Handlers for: install dependency, open settings, run command
  - Diagnostics via DiagnosticsService

- [ ] **TASK-27** Native fallback when JCEF is unavailable
  - Native `CreateSpecDialog` (Kotlin UI DSL) with basic fields
  - Notification when advanced features are unavailable

- [ ] **TASK-28** JCEF cross-platform integration tests
  - Linux (X11), Linux (Wayland), macOS, Windows
  - Verify React UI loading
  - Verify bidirectional communication

---

## Phase 4 — Hooks and MCP

- [ ] **TASK-29** Implement `McpClient` (JSON-RPC over stdio)
  - MCP server process initialization via ProcessBuilder
  - `initialize` / `initialized` handshake
  - `tools/list` to discover available tools
  - `tools/call` to execute tools
  - Lifecycle management (start, keepalive, stop)
  - Timeout and retry logic

- [ ] **TASK-30** Implement `HookManagerService`
  - Hook persistence (PersistentStateComponent or JSON file)
  - CRUD: add, edit, enable, disable, delete
  - Hook import/export (JSON)
  - List of hooks by trigger

- [ ] **TASK-31** Implement `HookExecutor`
  - Template variable reading (`$agentOutput`, `$clipboardContent`, etc.)
  - Variable substitution in action parameters
  - MCP action execution via McpClient
  - Logging with timestamps
  - Error handling with retry

- [ ] **TASK-32** Implement `TriggerRegistry`
  - Registry of available triggers (after-spec-create, after-task-run, etc.)
  - Hook dispatch when trigger occurs
  - Timing support: before/after

- [ ] **TASK-33** Implement `HooksToolWindow`
  - Tree view: list of hooks with status (enabled/disabled)
  - Log panel: recent executions with timestamps
  - Toolbar: Add Hook, Import, Export, View Logs, Refresh

- [ ] **TASK-34** Implement `HooksConfigPanel` (JCEF) or native
  - Hook configuration form
  - MCP server and tool selector (via McpClient.listTools())
  - Parameter mapping

- [ ] **TASK-35** Implement hook actions: AddHook, EditHook, EnableHook, DeleteHook

- [ ] **TASK-36** Implement MCP config reading
  - Detect mcp.json file (GitHub Copilot config path)
  - Parse list of configured servers
  - Fallback to GatomIA's own config

- [ ] **TASK-37** Integration tests for McpClient and HookExecutor

---

## Phase 5 — AI Integration and Polish

- [ ] **TASK-38** Implement `AiAssistantService`
  - Detection of JetBrains AI Assistant plugin availability
  - Send prompt to AI Chat when available
  - Fallback to clipboard when unavailable

- [ ] **TASK-39** Implement `RefinementGatewayService`
  - Port of `refinement-gateway.ts` to Kotlin
  - Mapping of document type → agent command
  - Refinement prompt formatting

- [ ] **TASK-40** Implement `AgentService` and agent discovery
  - Reads agents from `resources/agents/*.agent.md`
  - Parses YAML frontmatter of agent files
  - Registers available agents in ActionsToolWindow

- [ ] **TASK-41** Implement `TaskLineMarkerProvider` (equivalent to CodeLens)
  - Detects `- [ ] description` lines in `tasks.md` files
  - Displays lateral marker "▶ Run Task"
  - Click opens task execution action

- [ ] **TASK-42** Add custom plugin icons
  - Main icon (gatomia.svg) for JetBrains sidebar
  - Icons for each item type in tree views
  - Dark/light versions of icons

- [ ] **TASK-43** UX polish
  - Tooltips on all toolbar buttons
  - Keyboard shortcuts for main actions
  - Context menus (right-click) on tree nodes
  - User-friendly error messages

- [ ] **TASK-44** Plugin documentation
  - Updated README.md for JetBrains
  - CHANGELOG.md
  - Contribution guide
  - Screenshots and GIFs for the Marketplace

- [ ] **TASK-45** JetBrains Marketplace publishing setup
  - Publisher account created
  - Publishing token configured as GitHub Secret
  - `./gradlew publishPlugin` tested
  - Plugin description page prepared

- [ ] **TASK-46** E2E tests in IDE sandbox
  - Full flow: install plugin → create spec → see in explorer
  - Hooks flow: configure hook → run spec → hook executes
  - Steering flow: create instruction rule → see in explorer

- [ ] **TASK-47** Test on multiple IDEs
  - IntelliJ IDEA Community 2024.1
  - IntelliJ IDEA Community 2024.3
  - PyCharm Community 2024.1
  - WebStorm 2024.1
