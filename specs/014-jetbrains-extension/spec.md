# Feature Specification: GatomIA for JetBrains IDEs

**Feature Branch**: `claude/jetbrains-extension-plan-jB2yS`
**Created**: 2026-02
**Status**: Draft
**Type**: New Product — JetBrains Plugin

---

## 1. Executive Summary

Create a **GatomIA** extension for JetBrains products (IntelliJ IDEA, PyCharm, WebStorm, GoLand, Rider, etc.), maintaining feature parity with the existing VSCode extension. The JetBrains plugin should offer the same Agentic Spec-Driven Development experience, integrating with the AI tools available in the JetBrains ecosystem.

---

## 2. Product Context

### 2.1 What is GatomIA (VSCode)

GatomIA is an **Agentic Spec-Driven Development** toolkit that provides:

| Module | Description |
|---|---|
| **Spec Management** | Creation and management of specifications with SpecKit/OpenSpec |
| **Copilot Agents** | Integration with GitHub Copilot Chat as chat participants |
| **Steering** | Management of Constitution, AGENTS.md, and instruction rules |
| **Hooks & Automation** | Automation via MCP (Model Context Protocol) |
| **Prompt Management** | Management of `.github/prompts` prompts |
| **Wiki Management** | Repository documentation synchronization |
| **Welcome Screen** | Interactive onboarding and diagnostics |

### 2.2 Critical Dependencies of the VSCode Version

The VSCode version strongly depends on:

1. **`vscode` API** — Tree views, WebViews, CodeLens, commands, workspace, etc.
2. **`vscode.lm` API** — Language Model API for interaction with AI models
3. **`vscode.chat` API** — GitHub Copilot Chat participants
4. **GitHub Copilot Chat** — Required external extension (prerequisite)
5. **`vscode.languages` API** — CodeLens providers
6. **WebView with React** — Complex UI (forms, previews, hooks configurator)

---

## 3. JetBrains Version Scope

### 3.1 Features In-Scope (MVP)

- [x] Spec Explorer — Tree view with spec visualization and management
- [x] Create New Spec — Creation form via embedded panel (JCEF)
- [x] Run Tasks — Action to execute spec file tasks
- [x] Steering Explorer — Management of Constitution/AGENTS.md and instruction rules
- [x] Actions Explorer — Management of `.github/` prompts and agents
- [x] Hooks Explorer — MCP hooks configuration and management
- [x] Document Preview — Preview of specs and plans with markdown
- [x] Welcome Screen — Welcome screen and diagnostics
- [x] SpecKit Integration — Execution of `specify` CLI as external process
- [x] OpenSpec Integration — Execution of `openspec` CLI as external process
- [x] Settings — Plugin configuration via JetBrains Settings panel
- [x] Notifications — Operation feedback via balloon notifications

### 3.2 Features Out-of-Scope (MVP, planned for v2)

- [ ] Chat Participants / Copilot Agents (dependent on stable public API from JetBrains AI or Copilot)
- [ ] Inline CodeLens in task files
- [ ] Automated Wiki Management
- [ ] Migration wizard (OpenSpec → SpecKit)

---

## 4. Gap Analysis: VSCode → JetBrains

### 4.1 API Mapping

| VSCode Concept | JetBrains Equivalent | Complexity |
|---|---|---|
| `ExtensionContext` | `Project`, `Disposable` (services) | Medium |
| `TreeDataProvider` | `AbstractTreeStructure` / `TreeModel` | High |
| `WebviewPanel` | JCEF `JBCefBrowser` | High |
| `commands.registerCommand` | `AnAction` / `ActionManager` | Low |
| `workspace.onDidChangeConfiguration` | `AppSettingsListener` / `ProjectSettingsListener` | Medium |
| `window.showInformationMessage` | `Notifications.Bus.notify()` | Low |
| `vscode.lm` (LM API) | JetBrains AI Assistant API / MCP Client | High |
| `vscode.chat` (Copilot Chat) | No direct public equivalent in MVP | N/A MVP |
| `languages.registerCodeLensProvider` | `LineMarkerProvider` / `EditorLinePainter` | High |
| `OutputChannel` | `ConsoleView` / `ToolWindowManager` | Medium |
| `FileSystemWatcher` | `VirtualFileListener` / `BulkFileListener` | Medium |
| `window.createTerminal` | `TerminalRunner` / `GeneralCommandLine` | Low |
| `workspace.fs` | `VirtualFileSystem` / `LocalFileSystem` | Low |
| `StatusBarItem` | `StatusBarWidget` | Low |
| `Uri` | `VirtualFile` / `Path` | Low |

### 4.2 View Mapping

| VSCode | JetBrains |
|---|---|
| Activity Bar with custom icon | Tool Window with icon in sidebar |
| `TreeView` in sidebar | `SimpleToolWindowPanel` with `Tree` |
| `WebviewPanel` in column | Tool Window with `JBCefBrowser` |
| `WebviewView` in sidebar | Tool Window with embedded `JBCefBrowser` |
| Settings panel (`package.json` contributes) | `Configurable` / Settings page |

### 4.3 AI Integration

The most critical point of difference is the AI integration:

**VSCode**: Uses `vscode.lm` + `vscode.chat` to create participants in GitHub Copilot Chat. The extension sends prompts directly to the Copilot chat.

**JetBrains — Options**:

| Option | Description | MVP Viability |
|---|---|---|
| **A — JetBrains AI Assistant** | Public API available since 2024.x for integration with AI Assistant. Supports inline prompts and tool calls. | High |
| **B — Copilot Plugin JetBrains** | GitHub Copilot for JetBrains exists, but does not expose a public API for third-party extensions to create "agents". | Low |
| **C — Direct MCP** | JetBrains 2025.1+ supports MCP. The plugin can act as an MCP server or client for AI tools. | High (v2) |
| **D — Terminal/CLI** | Execute specialized via CLI (SpecKit, OpenSpec) and display results. Does not require AI directly. | High (MVP) |

**Decision for MVP**: Hybrid approach:
1. The plugin manages all UIs, workflows, and files
2. For actions requiring AI: open the prompt file in JetBrains AI Chat (via clipboard + AI Assistant) or run CLI tools (SpecKit/OpenSpec)
3. For hooks/MCP: direct integration via JSON-RPC/stdio

---

## 5. Proposed Architecture

### 5.1 Technology Stack

```
JetBrains Plugin (Kotlin + IntelliJ Platform SDK)
├── plugin.xml                    # Plugin descriptor (actions, tool windows, services)
├── src/main/kotlin/
│   ├── actions/                  # AnAction implementations (equivalent commands)
│   ├── toolwindow/               # Tool Windows (Spec Explorer, Hooks, Steering, etc.)
│   │   ├── spec/
│   │   ├── hooks/
│   │   ├── steering/
│   │   └── actions/
│   ├── services/                 # Application & Project services (singletons)
│   │   ├── SpecManagerService
│   │   ├── HookManagerService
│   │   ├── ConfigurationService
│   │   ├── PromptLoaderService
│   │   └── AgentService
│   ├── ui/                       # UI components
│   │   ├── jcef/                 # JCEF browser panels (reused React webviews)
│   │   └── native/               # Kotlin UI DSL components
│   ├── listeners/                # File system and project listeners
│   ├── settings/                 # Settings configurables
│   └── utils/                    # Shared utilities
└── src/main/resources/
    ├── META-INF/plugin.xml
    └── icons/                    # SVG icons
```

### 5.2 UI Strategy

**Native Kotlin Components (simple Tool Windows)**:
- Spec Explorer tree
- Hooks Explorer tree
- Steering Explorer tree
- Actions Explorer tree

**JCEF (Reuse of existing React UI)**:
- "Create New Spec" form (complex, multi-step)
- Hooks Configurator (MCP servers/tools selector)
- Document Preview (markdown with mermaid/plantuml)
- Welcome Screen

This approach allows reusing the existing React/TypeScript code (`ui/`) with minimal adaptations in the communication bridge (replacing `vscode.postMessage` with `JBCefBrowser.postMessage`).

### 5.3 Communication Bridge (JCEF ↔ Kotlin)

```
WebView (React)                    Plugin (Kotlin)
    │                                    │
    │ window.postMessage(msg) ───────────▶ JBCefBrowser.addLoadHandler
    │                                    │   .onMessage(msg)
    │                                    │
    │ window.receiveMessage ◀─────────── JBCefBrowser.executeJavaScript(
    │                                    │   "window.receiveMessage(data)")
```

The `ui/src/bridge/` file already contains a communication abstraction. For JetBrains, create an adapter that replaces the VSCode bridge with the JCEF bridge.

---

## 6. JetBrains Project Structure

```
gatomia-jetbrains/                      # New repository (or monorepo module)
├── build.gradle.kts                    # Gradle build file
├── settings.gradle.kts
├── gradle.properties                   # Plugin version, SDK version
├── src/
│   ├── main/
│   │   ├── kotlin/
│   │   │   └── com/eitatech/gatomia/
│   │   │       ├── GatomiaPlugin.kt          # Plugin initialization
│   │   │       ├── actions/
│   │   │       │   ├── spec/
│   │   │       │   │   ├── CreateSpecAction.kt
│   │   │       │   │   ├── RefreshSpecsAction.kt
│   │   │       │   │   ├── DeleteSpecAction.kt
│   │   │       │   │   ├── ImplTaskAction.kt
│   │   │       │   │   └── RunTaskAction.kt
│   │   │       │   ├── hooks/
│   │   │       │   │   ├── AddHookAction.kt
│   │   │       │   │   ├── EditHookAction.kt
│   │   │       │   │   ├── EnableHookAction.kt
│   │   │       │   │   ├── DeleteHookAction.kt
│   │   │       │   │   └── ViewLogsAction.kt
│   │   │       │   ├── steering/
│   │   │       │   │   ├── CreateConstitutionAction.kt
│   │   │       │   │   ├── CreateUserRuleAction.kt
│   │   │       │   │   └── CreateProjectRuleAction.kt
│   │   │       │   ├── actions/
│   │   │       │   │   ├── CreatePromptAction.kt
│   │   │       │   │   ├── RunPromptAction.kt
│   │   │       │   │   └── CreateAgentAction.kt
│   │   │       │   └── settings/
│   │   │       │       └── OpenSettingsAction.kt
│   │   │       ├── toolwindow/
│   │   │       │   ├── GatomiaToolWindowFactory.kt   # Registers all tool windows
│   │   │       │   ├── spec/
│   │   │       │   │   ├── SpecToolWindow.kt
│   │   │       │   │   ├── SpecTreeModel.kt
│   │   │       │   │   └── SpecTreeNode.kt
│   │   │       │   ├── hooks/
│   │   │       │   │   ├── HooksToolWindow.kt
│   │   │       │   │   └── HooksTreeModel.kt
│   │   │       │   ├── steering/
│   │   │       │   │   ├── SteeringToolWindow.kt
│   │   │       │   │   └── SteeringTreeModel.kt
│   │   │       │   └── actions/
│   │   │       │       ├── ActionsToolWindow.kt
│   │   │       │       └── ActionsTreeModel.kt
│   │   │       ├── services/
│   │   │       │   ├── SpecManagerService.kt         # @Service(LIGHT_SERVICES)
│   │   │       │   ├── HookManagerService.kt
│   │   │       │   ├── SteeringManagerService.kt
│   │   │       │   ├── PromptLoaderService.kt
│   │   │       │   ├── ConfigurationService.kt
│   │   │       │   ├── AgentService.kt
│   │   │       │   ├── RefinementGatewayService.kt
│   │   │       │   └── DiagnosticsService.kt
│   │   │       ├── ui/
│   │   │       │   ├── jcef/
│   │   │       │   │   ├── GatomiaJcefPanel.kt       # Base JCEF panel
│   │   │       │   │   ├── CreateSpecPanel.kt
│   │   │       │   │   ├── HooksConfigPanel.kt
│   │   │       │   │   ├── DocumentPreviewPanel.kt
│   │   │       │   │   └── WelcomePanel.kt
│   │   │       │   └── native/
│   │   │       │       ├── SpecTreeCellRenderer.kt
│   │   │       │       └── HooksTreeCellRenderer.kt
│   │   │       ├── listeners/
│   │   │       │   ├── ProjectOpenListener.kt         # Triggers on project open
│   │   │       │   ├── FileChangeListener.kt          # VirtualFileListener
│   │   │       │   └── ConfigChangeListener.kt
│   │   │       ├── settings/
│   │   │       │   ├── GatomiaSettings.kt             # PersistentStateComponent
│   │   │       │   ├── GatomiaSettingsConfigurable.kt # Settings UI
│   │   │       │   └── GatomiaSettingsPanel.kt
│   │   │       ├── hooks/
│   │   │       │   ├── HookExecutor.kt
│   │   │       │   ├── HookManager.kt
│   │   │       │   ├── McpClient.kt                   # MCP JSON-RPC client
│   │   │       │   └── TriggerRegistry.kt
│   │   │       └── utils/
│   │   │           ├── CliRunner.kt                   # Executes SpecKit/OpenSpec CLIs
│   │   │           ├── FileUtils.kt
│   │   │           ├── MarkdownUtils.kt
│   │   │           ├── NotificationUtils.kt
│   │   │           └── PlatformUtils.kt
│   │   └── resources/
│   │       ├── META-INF/
│   │       │   └── plugin.xml
│   │       └── icons/
│   │           ├── gatomia.svg
│   │           ├── spec.svg
│   │           ├── hook.svg
│   │           └── steering.svg
│   └── test/
│       └── kotlin/
│           └── com/eitatech/gatomia/
│               ├── services/
│               │   ├── SpecManagerServiceTest.kt
│               │   └── HookManagerServiceTest.kt
│               └── utils/
│                   └── CliRunnerTest.kt
└── ui/                                 # Reused from gatomia-vscode (symlink or submodule)
    └── src/
        └── bridge/
            ├── vscode-bridge.ts        # Current bridge (VSCode)
            └── jcef-bridge.ts          # New bridge for JetBrains (NEW)
```

---

## 7. Plugin Configuration (`plugin.xml`)

```xml
<idea-plugin>
  <id>com.eitatech.gatomia</id>
  <name>GatomIA</name>
  <version>1.0.0</version>
  <vendor url="https://github.com/eitatech">EITA</vendor>
  <description>Agentic Spec-Driven Development Toolkit for JetBrains IDEs</description>

  <depends>com.intellij.modules.platform</depends>

  <extensions defaultExtensionNs="com.intellij">
    <!-- Tool Windows -->
    <toolWindow id="GatomIA Specs" anchor="left" factoryClass="...SpecToolWindowFactory"/>
    <toolWindow id="GatomIA Hooks" anchor="left" factoryClass="...HooksToolWindowFactory"/>
    <toolWindow id="GatomIA Steering" anchor="left" factoryClass="...SteeringToolWindowFactory"/>
    <toolWindow id="GatomIA Actions" anchor="left" factoryClass="...ActionsToolWindowFactory"/>

    <!-- Settings -->
    <applicationConfigurable groupId="tools" instance="...GatomiaSettingsConfigurable"/>
    <applicationService serviceImplementation="...GatomiaSettings"/>

    <!-- Project Services -->
    <projectService serviceImplementation="...SpecManagerService"/>
    <projectService serviceImplementation="...HookManagerService"/>
    <projectService serviceImplementation="...SteeringManagerService"/>
    <projectService serviceImplementation="...PromptLoaderService"/>

    <!-- Listeners -->
    <postStartupActivity implementation="...ProjectOpenListener"/>
  </extensions>

  <actions>
    <!-- Spec Actions -->
    <action id="gatomia.spec.create" class="...CreateSpecAction" text="Create New Spec"/>
    <action id="gatomia.spec.refresh" class="...RefreshSpecsAction" text="Refresh Specs"/>
    <!-- ... other actions ... -->
  </actions>
</idea-plugin>
```

---

## 8. AI Integration (Strategy)

### 8.1 Flow Without Direct Chat API (MVP)

For the MVP, when the user triggers an operation that requires AI (create spec, generate constitution, etc.):

```
User clicks "Create Spec"
        │
        ▼
Plugin assembles the complete prompt
(same text that would be sent to Copilot Chat in VSCode)
        │
        ▼
Strategy A: JetBrains AI Assistant available?
  → Yes: Opens AI Chat panel with pre-filled prompt
  → No: Copies prompt to clipboard + notifies user
        │
        ▼
Expected result: AI generates the spec files
        │
        ▼
FileChangeListener detects new files
→ Spec Explorer updates automatically
```

### 8.2 JetBrains AI Assistant API

Starting from IntelliJ Platform 2024.2, the `com.intellij.ai.openapi` module allows:
- Sending prompts to the AI Assistant programmatically
- Receiving streaming responses
- Executing AI actions

```kotlin
// JetBrains AI Assistant integration example
val aiService = project.getService(AIAssistantService::class.java)
aiService.sendPrompt(
    prompt = compiledPrompt,
    onResponse = { response -> handleResponse(response) }
)
```

### 8.3 CLI as Robust Fallback

The SpecKit CLI (`specify`) and OpenSpec CLI (`openspec`) are command-line tools that already perform spec file generation. The plugin can execute them directly:

```kotlin
// CLI executor
val result = CliRunner.execute(
    command = listOf("specify", "specify", "--description", userDescription),
    workingDir = project.basePath!!
)
```

---

## 9. Implementation Phases

### Phase 1 — Foundation and Structure (Sprint 1-2)

**Objective**: Functional plugin with base structure and tree view explorers.

- [ ] Configure Gradle project with IntelliJ Platform Plugin (`intellij-platform-gradle-plugin`)
- [ ] Create `plugin.xml` with Tool Windows and Actions definitions
- [ ] Implement `GatomiaSettings` (PersistentStateComponent)
- [ ] Implement `ConfigurationService` (settings wrapper)
- [ ] Implement `SpecManagerService` (reading specs from disk)
- [ ] Implement `SpecToolWindow` with basic tree view
- [ ] Implement `SteeringManagerService` (reading constitution, rules)
- [ ] Implement `SteeringToolWindow` with tree view
- [ ] Implement `FileChangeListener` (monitors changes in spec files)
- [ ] Create `ProjectOpenListener` (services initialization)
- [ ] Configure CI/CD for plugin build (GitHub Actions)

**Deliverable**: Installable plugin that displays existing specs in the sidebar

---

### Phase 2 — Core Actions and CLI Integration (Sprint 3-4)

**Objective**: User can create specs and run tasks via CLI.

- [ ] Implement `CliRunner` (runs SpecKit/OpenSpec as external process)
- [ ] Implement `CreateSpecAction` with input dialog (Kotlin UI DSL)
- [ ] Implement `ImplTaskAction` and `RunTaskAction`
- [ ] Implement `DeleteSpecAction`
- [ ] Implement `CreateConstitutionAction`
- [ ] Implement `CreateUserRuleAction` and `CreateProjectRuleAction`
- [ ] Implement `ActionsToolWindow` (prompts/agents explorer)
- [ ] Implement `CreatePromptAction` and `RunPromptAction`
- [ ] Implement notification system (`NotificationUtils`)
- [ ] Implement `DiagnosticsService` (check SpecKit/OpenSpec installed)
- [ ] Implement Settings page with configurable fields
- [ ] Unit tests for Services and CliRunner

**Deliverable**: User can create complete specs via CLI and navigate the explorer

---

### Phase 3 — JCEF UI and Document Preview (Sprint 5-6)

**Objective**: React UI reused inside the JetBrains plugin via JCEF.

- [ ] Create `GatomiaJcefPanel` base with Kotlin ↔ JavaScript bridge
- [ ] Implement `jcef-bridge.ts` in the React UI (replaces `vscode-bridge.ts`)
- [ ] Adapt UI build to support two targets: `vscode` and `jcef`
- [ ] Implement `CreateSpecPanel` (JCEF with React form)
- [ ] Implement `DocumentPreviewPanel` (JCEF with markdown preview)
- [ ] Implement `WelcomePanel` (JCEF with React welcome screen)
- [ ] Test cross-platform rendering (Windows, macOS, Linux)

**Deliverable**: Rich UI reused inside the JetBrains IDE

---

### Phase 4 — Hooks and MCP Integration (Sprint 7-8)

**Objective**: Functional hooks system with MCP integration.

- [ ] Implement `McpClient` (JSON-RPC via stdio or HTTP)
- [ ] Implement `HookManager` (persistence and execution of hooks)
- [ ] Implement `HookExecutor` (execution with template variables)
- [ ] Implement `TriggerRegistry`
- [ ] Implement `HooksToolWindow` with tree view and logs
- [ ] Implement `HooksConfigPanel` (JCEF with React configurator)
- [ ] Implement `AddHookAction`, `EditHookAction`, `DeleteHookAction`
- [ ] Implement hooks import/export (JSON)
- [ ] Integration tests for MCP client

**Deliverable**: MCP hooks automation working in JetBrains

---

### Phase 5 — AI Integration and Polish (Sprint 9-10)

**Objective**: Integration with JetBrains AI Assistant and refinements.

- [ ] Implement integration with JetBrains AI Assistant API
- [ ] Implement `RefinementGatewayService` (port from VSCode)
- [ ] Implement `AgentService` (agent discovery from `resources/`)
- [ ] Add spec review flow actions
- [ ] Implement CodeMarker (equivalent to CodeLens) for tasks.md
- [ ] UI polish (icons, tooltips, keyboard shortcuts)
- [ ] Plugin documentation
- [ ] E2E tests with IDE sandbox
- [ ] Publish to JetBrains Marketplace

**Deliverable**: Plugin ready for launch on JetBrains Marketplace

---

## 10. Technical Requirements

### 10.1 IDE Compatibility

| IDE | Minimum Version | Tested on |
|---|---|---|
| IntelliJ IDEA (Community/Ultimate) | 2024.1+ | ✓ |
| PyCharm | 2024.1+ | ✓ |
| WebStorm | 2024.1+ | ✓ |
| GoLand | 2024.1+ | ✓ |
| Rider | 2024.1+ | Planned |
| Android Studio | 2024.1+ | Planned |

### 10.2 OS Compatibility

| OS | Supported |
|---|---|
| macOS (Intel + Apple Silicon) | ✓ |
| Windows 10/11 | ✓ |
| Linux (Ubuntu, Fedora) | ✓ |

### 10.3 External Dependencies

| Dependency | Version | Required |
|---|---|---|
| JDK | 17+ | Yes (via IDE) |
| SpecKit CLI (`specify`) | latest | No (optional feature) |
| OpenSpec CLI (`openspec`) | latest | No (optional feature) |
| MCP-compatible server | any | No (hooks feature) |
| JetBrains AI Assistant | any | No (AI feature) |

### 10.4 Build Requirements

```kotlin
// build.gradle.kts
intellijPlatform {
    create(IntelliJPlatformType.IntellijIdeaCommunity, "2024.1")
}

dependencies {
    intellijPlatform {
        bundledPlugins("com.intellij.java")
    }
}
```

---

## 11. Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| JetBrains AI Assistant API still unstable | High | Medium | Implement as optional layer; fallback to clipboard |
| JCEF not available in all environments | Medium | Low | Fallback to native Kotlin dialogs |
| JCEF performance on Linux | Medium | Medium | Test early; consider lazy loading |
| SpecKit CLI API changes | Low | Low | CLI versioning; version detection |
| Windows filesystem path differences | Medium | High | Use `Path.of()` and `VirtualFile` consistently |
| JetBrains Marketplace review process | Low | High | Prepare in advance; follow guidelines |

---

## 12. Success Metrics

| Metric | Target |
|---|---|
| Feature parity with VSCode | ≥ 80% of core features in MVP |
| Installation rate (6 months) | ≥ 500 installations |
| Marketplace rating | ≥ 4.0/5.0 |
| Test coverage | ≥ 70% |
| Build time | < 3 minutes |
| IDE compatibility | IntelliJ, PyCharm, WebStorm, GoLand |

---

## 13. References

- [IntelliJ Platform SDK](https://plugins.jetbrains.com/docs/intellij/welcome.html)
- [IntelliJ Platform Plugin Template](https://github.com/JetBrains/intellij-platform-plugin-template)
- [JCEF (JetBrains Chromium Embedded Framework)](https://plugins.jetbrains.com/docs/intellij/jcef.html)
- [Tool Windows Guide](https://plugins.jetbrains.com/docs/intellij/tool-windows.html)
- [Actions System](https://plugins.jetbrains.com/docs/intellij/basic-action-system.html)
- [JetBrains Marketplace Publishing](https://plugins.jetbrains.com/docs/marketplace/publishing-plugin.html)
- [GatomIA VSCode Source](https://github.com/eitatech/gatomia-vscode)
