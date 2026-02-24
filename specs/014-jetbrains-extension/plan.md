# Implementation Plan: GatomIA for JetBrains IDEs

**Feature**: `014-jetbrains-extension`
**Branch**: `claude/jetbrains-extension-plan-jB2yS`
**Created**: 2026-02-23

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        gatomia-jetbrains                           │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Tool Windows    │  │    Services      │  │     Actions      │  │
│  │  ─────────────   │  │  ─────────────   │  │  ─────────────   │  │
│  │  SpecExplorer    │  │  SpecManager     │  │  CreateSpec      │  │
│  │  HooksExplorer   │◀─│  HookManager     │  │  RunTask         │  │
│  │  SteeringExp.    │  │  SteeringManager │  │  AddHook         │  │
│  │  ActionsExp.     │  │  PromptLoader    │  │  CreateRule      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│           │                    │                       │           │
│           ▼                    ▼                       ▼           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                       Core Layer                             │  │
│  │  CliRunner │ McpClient │ FileWatcher │ NotificationUtils     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│           │                    │                                   │
│           ▼                    ▼                                   │
│  ┌──────────────┐   ┌─────────────────────────────────────────┐    │
│  │  JCEF Panels │   │           Settings                      │    │
│  │  ─────────── │   │  GatomiaSettings (PersistentState)      │    │
│  │  CreateSpec  │   │  GatomiaSettingsConfigurable (UI page)  │    │
│  │  DocPreview  │   └─────────────────────────────────────────┘    │
│  │  HooksConfig │                                                  │
│  │  Welcome     │                                                  │
│  └──────────────┘                                                  │
└────────────────────────────────────────────────────────────────────┘
         │                 │
         ▼                 ▼
  ┌────────────┐    ┌─────────────┐
  │  SpecKit   │    │   OpenSpec  │
  │    CLI     │    │    CLI      │
  └────────────┘    └─────────────┘
```

---

## Phase 1: Foundation — Gradle Project + Base Tool Windows

### 1.1 Project Setup

**File**: `build.gradle.kts`

```kotlin
plugins {
    id("org.jetbrains.kotlin.jvm") version "1.9.25"
    id("org.jetbrains.intellij.platform") version "2.3.0"
}

group = "com.eitatech"
version = "1.0.0-alpha"

kotlin { jvmToolchain(17) }

intellijPlatform {
    create(IntelliJPlatformType.IntellijIdeaCommunity, "2024.1")
    instrumentCode = false
}

dependencies {
    intellijPlatform {
        bundledPlugins("com.intellij.java", "Git4Idea")
        testFramework(TestFrameworkType.Platform)
    }
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")
    testImplementation("io.mockk:mockk:1.13.9")
}
```

**File**: `gradle.properties`

```properties
pluginName=GatomIA
pluginVersion=1.0.0-alpha
pluginSinceBuild=241
pluginUntilBuild=251.*
platformType=IC
platformVersion=2024.1
```

### 1.2 Plugin Descriptor

**File**: `src/main/resources/META-INF/plugin.xml`

Full structure with:

- ID: `com.eitatech.gatomia`
- Declared Tool Windows (Specs, Hooks, Steering, Actions)
- Registered Application/Project services
- Registered Actions with menu groups
- Registered Listeners
- Settings Configurable

### 1.3 Settings (PersistentStateComponent)

**File**: `src/main/kotlin/.../settings/GatomiaSettings.kt`

```kotlin
@State(name = "GatomiaSettings", storages = [Storage("gatomia.xml")])
@Service(Service.Level.APP)
class GatomiaSettings : PersistentStateComponent<GatomiaSettings.State> {

    data class State(
        var specSystem: String = "auto",         // "auto" | "speckit" | "openspec"
        var specsPath: String = "specs",
        var promptsPath: String = ".github/prompts",
        var chatLanguage: String = "English",
        var agentsResourcesPath: String = "resources",
        var enableHotReload: Boolean = true,
        var mcpConfigPath: String = "",
        // views visibility
        var specsViewVisible: Boolean = true,
        var hooksViewVisible: Boolean = true,
        var steeringViewVisible: Boolean = true,
        var actionsViewVisible: Boolean = true,
    )
    // ...
}
```

### 1.4 SpecManagerService

**File**: `src/main/kotlin/.../services/SpecManagerService.kt`

Direct port of the `SpecManager` (TypeScript) logic to Kotlin:

- Reads specs from the configured directory
- Detects the active system (SpecKit vs OpenSpec)
- Returns list of specs with metadata
- Support for change watching via `BulkFileListener`

### 1.5 SpecToolWindow (Tree View)

**File**: `src/main/kotlin/.../toolwindow/spec/SpecToolWindow.kt`

```bash
GatomIA Specs
├── 📁 Current
│   ├── 001-feature-a/
│   │   ├── spec.md
│   │   ├── plan.md
│   │   └── tasks.md
│   └── 002-feature-b/
├── 📁 Review
└── 📁 Archived
```

Toolbar buttons:

- `+` Create New Spec
- `↺` Refresh
- `⚙` Settings

---

## Phase 2: Actions and CLI Integration

### 2.1 CliRunner

**File**: `src/main/kotlin/.../utils/CliRunner.kt`

```kotlin
object CliRunner {
    data class CliResult(
        val exitCode: Int,
        val stdout: String,
        val stderr: String,
    )

    suspend fun execute(
        command: List<String>,
        workingDir: String,
        env: Map<String, String> = emptyMap(),
        onOutput: ((String) -> Unit)? = null
    ): CliResult {
        val process = ProcessBuilder(command)
            .directory(File(workingDir))
            .redirectErrorStream(false)
            .apply { environment().putAll(env) }
            .start()
        // ... streaming output, coroutine-based
    }

    suspend fun isInstalled(command: String): Boolean { ... }
}
```

### 2.2 CreateSpecAction

Flow:

1. User triggers "Create New Spec"
2. If JCEF available → opens `CreateSpecPanel` (JCEF)
3. Otherwise → native Kotlin dialog with basic fields
4. User fills in fields and clicks "Create"
5. Plugin calls `CliRunner.execute(["specify", "specify", "--description", desc])`
6. OR: assembles prompt and sends to JetBrains AI Assistant
7. FileChangeListener detects created files
8. SpecToolWindow updates automatically

### 2.3 RunTaskAction

Flow:

1. User clicks "Run Task" in SpecToolWindow (tasks.md item)
2. Plugin reads the tasks.md file
3. Extracts pending tasks (markdown checklist parser)
4. Presents dialog with available tasks
5. Opens tasks.md in editor + AI Assistant with task context
6. OR: runs `specify implement` via CLI

### 2.4 SteeringToolWindow + Actions

```
GatomIA Steering
├── 📄 Constitution (.specify/constitution.md)
├── 📁 Project Rules
│   ├── typescript-rules.instructions.md
│   └── api-rules.instructions.md
└── 📁 User Rules (~/.github/instructions/)
    └── personal-style.instructions.md
```

Toolbar:

- `+ Rule` Create Project Rule
- `+ User Rule` Create User Rule
- `+ Constitution` Create Constitution
- `↺` Refresh

---

## Phase 3: JCEF UI

### 3.1 React UI Reuse Strategy

The existing React UI (`ui/`) will be compiled for two targets:

**New build target** in `ui/vite.config.ts`:

```typescript
// vite.config.ts
export default defineConfig(({ mode }) => ({
    build: {
        outDir: mode === 'jcef'
            ? '../../gatomia-jetbrains/src/main/resources/webview'
            : '../dist/webview'
    }
}))
```

**New JCEF bridge** in `ui/src/bridge/jcef-bridge.ts`:

```typescript
// Replaces the VSCode postMessage with the JCEF API
export const bridge = {
    postMessage: (type: string, payload: unknown) => {
        if (window.gatomiaJcef) {
            window.gatomiaJcef.postMessage(JSON.stringify({ type, payload }))
        }
    },
    onMessage: (handler: (type: string, payload: unknown) => void) => {
        window.addEventListener('gatomia-message', (e: Event) => {
            const { type, payload } = JSON.parse((e as CustomEvent).detail)
            handler(type, payload)
        })
    }
}
```

### 3.2 GatomiaJcefPanel (Kotlin Base)

```kotlin
abstract class GatomiaJcefPanel(project: Project, pageName: String) : Disposable {

    val browser: JBCefBrowser = JBCefBrowser()

    init {
        val url = this::class.java.getResource("/webview/index.html")!!.toURI()
        browser.loadURL("$url?page=$pageName")

        // Handler for UI → Kotlin messages
        browser.jbCefClient.addMessageRouterHandler(
            object : CefMessageRouterHandlerAdapter() {
                override fun onQuery(
                    browser: CefBrowser, frame: CefFrame,
                    queryId: Long, request: String,
                    persistent: Boolean, callback: CefQueryCallback
                ): Boolean {
                    val msg = Json.decodeFromString<BridgeMessage>(request)
                    handleMessage(msg.type, msg.payload)
                    return true
                }
            },
            CefMessageRouterConfig()
        )
    }

    protected abstract fun handleMessage(type: String, payload: JsonElement)

    protected fun sendToUI(type: String, payload: JsonElement) {
        val json = Json.encodeToString(BridgeMessage(type, payload))
        browser.executeJavaScript(
            "window.dispatchEvent(new CustomEvent('gatomia-message', { detail: '$json' }))",
            "", 0
        )
    }
}
```

### 3.3 DocumentPreviewPanel

Reuses the document preview feature (spec.md, plan.md, tasks.md) with:

- Rendered markdown with mermaid/plantuml
- Action buttons (Edit, Refine, etc.)
- Synchronization with file on disk via `VirtualFileListener`

---

## Phase 4: Hooks and MCP

### 4.1 HooksToolWindow

```bash
GatomIA Hooks
├── 🟢 after-spec-create → MCP: create-github-issue
├── 🟢 after-task-run → MCP: slack-notify
└── 🔴 before-review → (disabled)

Logs:
  [12:34] Executed: create-github-issue ✓ (234ms)
  [12:35] Executed: slack-notify ✓ (456ms)
```

### 4.2 McpClient (Kotlin)

```kotlin
class McpClient(private val serverConfig: McpServerConfig) {

    private lateinit var process: Process
    private var requestId = AtomicLong(0)

    suspend fun connect() {
        process = ProcessBuilder(listOf(serverConfig.command) + serverConfig.args)
            .redirectErrorStream(false)
            .start()
        // Initialize handshake
        sendRequest("initialize", buildInitializeParams())
    }

    suspend fun callTool(name: String, arguments: Map<String, Any>): JsonElement {
        val id = requestId.incrementAndGet()
        val request = buildJsonObject {
            put("jsonrpc", "2.0")
            put("id", id)
            put("method", "tools/call")
            putJsonObject("params") {
                put("name", name)
                put("arguments", Json.encodeToJsonElement(arguments))
            }
        }
        return sendAndAwaitResponse(id, request)
    }

    suspend fun listTools(): List<McpTool> { ... }
}
```

### 4.3 HookExecutor

Port of `HookExecutor.ts` to Kotlin:

- Template variable substitution (`$agentOutput`, `$clipboardContent`, etc.)
- Sequential/parallel hook execution
- Logging with timestamps
- Error handling with retry

---

## Phase 5: AI Integration and Polish

### 5.1 JetBrains AI Assistant Integration

```kotlin
// Integration via AI Assistant plugin API
// Plugin dependency: com.intellij.ml.llm (optional)
class AiAssistantService(private val project: Project) {

    fun sendPrompt(prompt: String, onChunk: (String) -> Unit) {
        // Check if AI Assistant is available
        val aiPlugin = PluginManagerCore.getPlugin(PluginId.getId("com.intellij.ml.llm"))
        if (aiPlugin == null || !aiPlugin.isEnabled) {
            // Fallback: copy to clipboard
            CopyPasteManager.getInstance().setContents(StringSelection(prompt))
            Notifications.Bus.notify(
                Notification("GatomIA", "Prompt copied",
                    "The prompt was copied to the clipboard. Paste it in your preferred AI Chat.",
                    NotificationType.INFORMATION)
            )
            return
        }

        // Use reflection or available public services
        // to communicate with the AI Assistant
    }
}
```

### 5.2 CodeMarker for tasks.md

VSCode CodeLens replacement:

```kotlin
class TaskLineMarkerProvider : LineMarkerProvider {
    override fun getLineMarkerInfo(element: PsiElement): LineMarkerInfo<*>? {
        // Detects lines "- [ ] Task description" in tasks.md
        if (element is PsiFile && element.name == "tasks.md") {
            // Returns marker with "▶ Run Task" button
        }
        return null
    }
}
```

---

## Design Decisions

### D1: Separate Repository vs Monorepo

**Decision**: Separate repository `gatomia-jetbrains`.

**Reason**: The JetBrains plugin uses Kotlin/Gradle, completely different from the VSCode Node.js/TypeScript. A monorepo would add complexity without significant benefit.

**Exception**: The `ui/` folder can be a **git submodule** shared between the two repositories, allowing the React UI to be maintained in a single place.

### D2: JCEF vs Native UI

**Decision**: JCEF for complex UIs, native Kotlin for simple explorers.

**Reason**: Code reuse and UX fidelity. The existing React UI already has quality and advanced features (markdown preview, mermaid, etc.) that would be costly to replicate in Swing.

**JCEF usage criteria**:

- Multi-step forms with complex validation → JCEF
- Simple tree views → Native Kotlin
- Document previews → JCEF
- Simple input dialogs → Native Kotlin

### D3: AI Integration in MVP

**Decision**: Fallback via clipboard for the MVP; integration with JetBrains AI API as an additional feature.

**Reason**: Reduces risk of dependency on an unstable API. The user can use any AI Chat (JetBrains AI, ChatGPT, Claude, etc.) by pasting the prompt generated by the plugin.

### D4: Kotlin Coroutines for Async Operations

**Decision**: Use `kotlinx.coroutines` with `CoroutineScope(Dispatchers.IO)` for all I/O operations (CLI, MCP, filesystem).

**Reason**: Avoid blocking the EDT (Event Dispatch Thread) of Swing, which would freeze the IDE UI.

---

## Dependencies and Versions

```kotlin
// build.gradle.kts - dependencies
dependencies {
    // IntelliJ Platform
    intellijPlatform {
        create(IntelliJPlatformType.IntellijIdeaCommunity, "2024.1")
        bundledPlugins("com.intellij.java")
    }

    // Kotlin
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")

    // Markdown parsing (for tasks.md and specs)
    implementation("org.commonmark:commonmark:0.22.0")

    // YAML (for spec frontmatter)
    implementation("com.charleskorn.kaml:kaml:0.57.0")

    // Tests
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")
    testImplementation("io.mockk:mockk:1.13.9")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.0")
}
```

---

## Complexity Estimates by Component

| Component | Complexity | Notes |
|---|---|---|
| Gradle project + plugin.xml | Low | Template available |
| GatomiaSettings | Low | Stable and simple API |
| SpecManagerService | Medium | Port logic from TypeScript |
| SpecToolWindow | Medium | Tree view with custom rendering |
| CliRunner | Low | ProcessBuilder + coroutines |
| CreateSpecAction | Medium | Simple native dialog |
| SteeringToolWindow | Medium | Similar to SpecToolWindow |
| ActionsToolWindow | Medium | Similar to SpecToolWindow |
| JCEF Bridge (Kotlin) | High | JCEF API has a learning curve |
| JCEF Bridge (TypeScript) | Medium | Adapt existing bridge |
| CreateSpecPanel (JCEF) | High | JCEF + React integration |
| DocumentPreviewPanel | High | JCEF + disk sync |
| McpClient | High | JSON-RPC protocol, process management |
| HookManager | High | Port of complex logic |
| HooksToolWindow | High | JCEF + tree view + logs |
| AI Assistant Integration | High | Unstable API, requires investigation |
| TaskLineMarkerProvider | Medium | LineMarker API available |
| DiagnosticsService | Low | Process verification |
| CI/CD (GitHub Actions) | Low | Plugin template has example |

---

## Suggested Schedule

```
Phase 1 (Foundation)          ██████░░░░░░░░░░░░░░  Sprint 1-2
Phase 2 (Actions + CLI)       ░░░░░░██████░░░░░░░░  Sprint 3-4
Phase 3 (JCEF UI)             ░░░░░░░░░░░░██████░░  Sprint 5-6
Phase 4 (Hooks + MCP)         ░░░░░░░░░░░░░░░░████  Sprint 7-8
Phase 5 (AI + Polish)         ░░░░░░░░░░░░░░░░░░██  Sprint 9-10
```

Functional MVP (Phases 1-2): after Sprint 4
Beta with full UI (Phases 1-3): after Sprint 6
Release candidate (Phases 1-4): after Sprint 8
Launch (Phase 5): after Sprint 10
