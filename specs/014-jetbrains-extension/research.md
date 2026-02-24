# Research: GatomIA for JetBrains — Technical Analysis

**Feature**: `014-jetbrains-extension`
**Created**: 2026-02-23

---

## 1. Analysis of the Existing VSCode Extension

### 1.1 Code Structure

```
src/
├── extension.ts              # Entry point — registers all providers, commands, watchers
├── constants.ts              # Configuration namespace VSC_CONFIG_NAMESPACE
├── features/
│   ├── spec/
│   │   ├── spec-manager.ts         # Manages specs (SpecKit/OpenSpec)
│   │   ├── spec-kit-manager.ts     # SpecKit-specific operations
│   │   ├── spec-submission-strategy.ts
│   │   └── create-spec-input-controller.ts
│   ├── hooks/
│   │   ├── hook-manager.ts         # Hook CRUD (persistence in globalState)
│   │   ├── hook-executor.ts        # Hook execution with template variables
│   │   ├── trigger-registry.ts     # Registry of available triggers
│   │   ├── agent-registry.ts       # Agent discovery
│   │   └── services/
│   │       ├── agent-discovery-service.ts
│   │       ├── extension-monitor-service.ts
│   │       └── file-watcher-service.ts
│   ├── agents/
│   │   ├── agent-loader.ts         # Loads agents from resources/agents/
│   │   ├── chat-participant-registry.ts  # Registers as chat participants
│   │   └── tools/                  # Tool handlers for agents
│   └── steering/
│       ├── steering-manager.ts     # Manages Constitution/AGENTS.md
│       ├── constitution-manager.ts
│       └── instruction-rules.ts
├── providers/
│   ├── spec-explorer-provider.ts    # TreeDataProvider for specs
│   ├── hooks-explorer-provider.ts   # TreeDataProvider for hooks
│   ├── steering-explorer-provider.ts
│   ├── actions-explorer-provider.ts
│   ├── copilot-provider.ts          # GitHub Copilot integration
│   └── interactive-view-provider.ts
├── services/
│   ├── agent-service.ts
│   ├── configuration-service.ts
│   ├── refinement-gateway.ts       # Sends prompts to Copilot Chat
│   └── prompt-loader.ts
└── utils/
    ├── chat-prompt-runner.ts        # sendPromptToChat() via vscode.commands
    ├── config-manager.ts            # Configuration singleton
    ├── copilot-mcp-utils.ts         # MCP via vscode.lm
    └── platform-utils.ts            # Cross-platform paths
```

### 1.2 Integration with GitHub Copilot Chat

The central point of the VSCode extension is `sendPromptToChat()`:

```typescript
// utils/chat-prompt-runner.ts
export const sendPromptToChat = async (
    prompt: string,
    context?: ChatContext,
    files?: Uri[]
): Promise<void> => {
    // Applies language and custom instructions to the prompt
    // Then executes:
    await commands.executeCommand("workbench.action.chat.open", {
        query: finalPrompt,
        isPartialQuery: false,
        ...(supportsFilesParam() && files?.length ? { files } : {}),
    });
};
```

All the "AI" of the extension is outsourced to GitHub Copilot Chat. The plugin only:
1. Assembles the correct prompt
2. Opens the chat with the pre-filled prompt
3. The user interacts with Copilot Chat
4. Copilot generates the files
5. File watchers detect the new files

### 1.3 Data Persistence

- **Settings**: `vscode.workspace.getConfiguration()` → JetBrains: `PersistentStateComponent`
- **Hooks**: `context.globalState` → JetBrains: `PersistentStateComponent` or JSON file in `~/.gatomia/`
- **Spec data**: Files on disk (no database)

### 1.4 React UI (WebView)

```
ui/src/
├── features/
│   ├── create-spec-view/      # Spec creation form
│   ├── hooks-view/            # Hooks manager
│   ├── preview/               # Markdown document preview
│   ├── steering-view/         # (steering views)
│   └── welcome/               # Welcome screen
└── bridge/                    # WebView ↔ Extension communication
    └── (postMessage abstraction)
```

The bridge uses `acquireVsCodeApi().postMessage()` and `window.addEventListener('message')`.

---

## 2. JetBrains Platform SDK — Relevant APIs

### 2.1 Tool Windows

```kotlin
// Declaration in plugin.xml
<toolWindow id="GatomIA Specs"
    anchor="left"
    secondary="false"
    icon="AllIcons.General.Modified"
    factoryClass="com.eitatech.gatomia.toolwindow.SpecToolWindowFactory"/>

// Implementation
class SpecToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = SpecToolWindowPanel(project)
        val content = ContentFactory.getInstance()
            .createContent(panel, "", false)
        toolWindow.contentManager.addContent(content)
    }
}
```

### 2.2 Tree Views

```kotlin
class SpecTreeModel(private val project: Project) : DefaultTreeModel(DefaultMutableTreeNode("Specs")) {
    fun refresh() {
        val specService = project.getService(SpecManagerService::class.java)
        val specs = specService.getSpecs()
        val root = root as DefaultMutableTreeNode
        root.removeAllChildren()
        // Add nodes
        reload()
    }
}
```

### 2.3 File System Watchers

```kotlin
// Registered in plugin.xml as listener
class FileChangeListener : BulkFileListener {
    override fun after(events: List<VFileEvent>) {
        val specFiles = events.filter { it.file?.name?.endsWith("spec.md") == true }
        if (specFiles.isNotEmpty()) {
            ApplicationManager.getApplication().invokeLater {
                // Notifies SpecToolWindow to update
                project.messageBus.syncPublisher(SPEC_CHANGED_TOPIC).onSpecChanged()
            }
        }
    }
}
```

### 2.4 JCEF (JetBrains Chromium Embedded Framework)

```kotlin
// Available since IntelliJ 2020.1
// Check availability:
if (!JBCefApp.isSupported()) {
    // Fallback to native UI
}

val browser = JBCefBrowser()
browser.loadURL("file:///path/to/index.html")

// Send data to JS:
browser.executeJavaScript("window.receiveData(${json})", "", 0)

// Receive data from JS:
val handler = object : CefQueryHandler {
    override fun onQuery(
        browser: CefBrowser, frame: CefFrame,
        queryId: Long, request: String,
        persistent: Boolean, callback: CefQueryCallback
    ): Boolean {
        // `request` contains the JS message
        handleMessage(request)
        callback.success("")
        return true
    }
}
```

### 2.5 Actions (Commands)

```kotlin
// Registered in plugin.xml
<action id="gatomia.spec.create"
    class="com.eitatech.gatomia.actions.spec.CreateSpecAction"
    text="Create New Spec"
    icon="AllIcons.General.Add">
    <add-to-group group-id="GatomiaSpecGroup" anchor="first"/>
</action>

// Implementation
class CreateSpecAction : AnAction("Create New Spec") {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val specService = project.getService(SpecManagerService::class.java)
        // Opens dialog or JCEF panel
    }
}
```

### 2.6 Settings (Configurable)

```kotlin
// Registered in plugin.xml
<applicationConfigurable
    groupId="tools"
    instance="com.eitatech.gatomia.settings.GatomiaSettingsConfigurable"
    id="com.eitatech.gatomia.settings"
    displayName="GatomIA"/>

// PersistentStateComponent
@State(name = "GatomiaSettings", storages = [Storage("gatomia.xml")])
@Service(Service.Level.APP)
class GatomiaSettings : PersistentStateComponent<GatomiaSettings.State> {
    var state: State = State()
    override fun getState() = state
    override fun loadState(state: State) { this.state = state }
}
```

### 2.7 Notifications

```kotlin
// Simple
Notifications.Bus.notify(
    Notification("GatomIA", "Spec created!", "spec.md was successfully generated.",
        NotificationType.INFORMATION)
)

// With action
Notification("GatomIA", "Error", "SpecKit CLI not found.",
    NotificationType.ERROR
).apply {
    addAction(NotificationAction.create("Install SpecKit") { _, notification ->
        BrowserUtil.browse("https://github.com/github/spec-kit")
        notification.expire()
    })
}.also { Notifications.Bus.notify(it) }
```

### 2.8 Process Execution

```kotlin
// Execute CLI asynchronously
suspend fun executeSpecKitCommand(project: Project, args: List<String>): String {
    return withContext(Dispatchers.IO) {
        val commandLine = GeneralCommandLine()
            .withWorkDirectory(project.basePath)
            .withExePath("specify")
            .withParameters(args)
            .withCharset(Charsets.UTF_8)

        val output = StringBuilder()
        val process = OSProcessHandler(commandLine)
        process.addProcessListener(object : ProcessAdapter() {
            override fun onTextAvailable(event: ProcessEvent, outputType: Key<*>) {
                output.append(event.text)
            }
        })
        process.startNotify()
        process.waitFor()
        output.toString()
    }
}
```

---

## 3. JetBrains AI Assistant API

### 3.1 API Status (2025)

JetBrains made the public API available for AI Assistant starting from version 2024.2 of the `com.intellij.ml.llm` plugin.

**Available features**:
- Send prompts to the AI Assistant chat
- Create custom actions that appear in the AI context

**Documentation**:
- [AI Assistant Extension Development](https://plugins.jetbrains.com/docs/intellij/ai-assistant-api.html)

### 3.2 Basic Usage (when available)

```kotlin
// Check if AI Assistant is available
val isAiAvailable = PluginManagerCore.getPlugin(
    PluginId.getId("com.intellij.ml.llm")
)?.isEnabled == true

// Use via reflection to avoid hard dependency
if (isAiAvailable) {
    // Call AI Assistant API
} else {
    // Fallback: copy to clipboard
    copyToClipboard(prompt)
    showNotification("Prompt copied! Paste it in your preferred AI Chat.")
}
```

---

## 4. MCP in JetBrains

### 4.1 Native JetBrains Support

Starting from 2025.1, the JetBrains AI Assistant has native support for MCP servers.

For the GatomIA plugin, the `McpClient` should:
1. Read the MCP servers configuration (from the standard `mcp.json` or a custom file)
2. Start MCP server processes via `ProcessBuilder`
3. Communicate via JSON-RPC over stdin/stdout
4. Manage process lifecycle (start, health check, stop)

### 4.2 Location of mcp.json in JetBrains

JetBrains does not have the same `mcp.json` file as VS Code. Options:
- Use the same `~/.config/github-copilot/mcp.json` file (if the user uses Copilot)
- Have a GatomIA-specific configuration for MCP servers
- Read from the JetBrains AI Assistant configuration (when API available)

---

## 5. Detailed Technical Risks

### 5.1 JCEF on Linux

JCEF on Linux may have issues with:
- Rendering with Wayland (use `GDK_BACKEND=x11` as a workaround)
- Performance in VMs/containers
- Fonts and DPI

**Mitigation**: Test early on Ubuntu 22.04 (Wayland) and 20.04 (X11). Have a native UI fallback for critical forms.

### 5.2 Cross-Platform Path Handling

VSCode uses `Uri` which abstracts paths. In JetBrains:
- Use `VirtualFile` for files within the project
- Use `Path.of()` for system files (never `String` concatenation)
- `FileUtil.toSystemIndependentName()` for normalization

### 5.3 IDE Threading

The JetBrains IDE has strict rules:
- **EDT** (Event Dispatch Thread): UI operations only
- **Read Action**: PSI (code index) reading
- **Write Action**: File modification
- **IO Dispatch**: I/O operations

```kotlin
// Correct: file operation outside EDT
ApplicationManager.getApplication().executeOnPooledThread {
    val content = VfsUtil.loadText(virtualFile)
    ApplicationManager.getApplication().invokeLater {
        // Update UI on EDT
        treeModel.reload()
    }
}
```

### 5.4 Plugin.xml Validation

The JetBrains Marketplace performs strict validation of `plugin.xml`. Critical points:
- All action `id` values must be globally unique (use `com.eitatech.gatomia.*`)
- Tool Window IDs must be unique
- `since-build` and `until-build` versions must be correct

---

## 6. Tooling and Build

### 6.1 IntelliJ Platform Gradle Plugin

```kotlin
plugins {
    id("org.jetbrains.intellij.platform") version "2.3.0"
}
```

Useful Gradle tasks:
- `./gradlew buildPlugin` — Generates plugin `.zip` file
- `./gradlew runIde` — Launches IDE sandbox with plugin installed
- `./gradlew verifyPlugin` — Validates compatibility
- `./gradlew publishPlugin` — Publishes to Marketplace (requires token)

### 6.2 CI/CD (GitHub Actions)

```yaml
# .github/workflows/build.yml
name: Build Plugin

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '17', distribution: 'corretto' }
      - name: Build UI
        run: cd ui && npm ci && npm run build:jcef
      - name: Build Plugin
        run: ./gradlew buildPlugin verifyPlugin
      - uses: actions/upload-artifact@v4
        with:
          name: plugin-artifact
          path: build/distributions/*.zip
```

---

## 7. References and Resources

### Official Documentation
- [IntelliJ Platform SDK Docs](https://plugins.jetbrains.com/docs/intellij/welcome.html)
- [IntelliJ Platform Plugin Template](https://github.com/JetBrains/intellij-platform-plugin-template)
- [JCEF Guide](https://plugins.jetbrains.com/docs/intellij/jcef.html)
- [Tool Windows Guide](https://plugins.jetbrains.com/docs/intellij/tool-windows.html)
- [Gradle IntelliJ Platform Plugin](https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin.html)

### Open Source Reference Plugins
- [GitToolBox](https://github.com/zielu/GitToolBox) — Example of a complex plugin with Kotlin
- [Rainbow Brackets](https://github.com/izhangzhihao/intellij-rainbow-brackets) — Example with JCEF
- [CodeWithMe](https://plugins.jetbrains.com/plugin/14896-code-with-me) — Example of complex tool windows

### Related Projects
- [SpecKit](https://github.com/github/spec-kit) — Base CLI used by GatomIA
- [OpenSpec](https://github.com/Fission-AI/OpenSpec) — Alternative to SpecKit
- [MCP Specification](https://modelcontextprotocol.io/) — MCP protocol for hooks
