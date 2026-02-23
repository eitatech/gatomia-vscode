# Implementation Plan: GatomIA for JetBrains IDEs

**Feature**: `014-jetbrains-extension`
**Branch**: `claude/jetbrains-extension-plan-jB2yS`
**Created**: 2026-02-23

---

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        gatomia-jetbrains                             │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Tool Windows    │  │    Services       │  │     Actions      │  │
│  │  ─────────────   │  │  ─────────────    │  │  ─────────────   │  │
│  │  SpecExplorer    │  │  SpecManager      │  │  CreateSpec      │  │
│  │  HooksExplorer   │◀─│  HookManager      │  │  RunTask         │  │
│  │  SteeringExp.    │  │  SteeringManager  │  │  AddHook         │  │
│  │  ActionsExp.     │  │  PromptLoader     │  │  CreateRule      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│           │                    │                       │             │
│           ▼                    ▼                       ▼             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                       Core Layer                              │   │
│  │  CliRunner │ McpClient │ FileWatcher │ NotificationUtils      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           │                    │                                     │
│           ▼                    ▼                                     │
│  ┌──────────────┐   ┌─────────────────────────────────────────┐    │
│  │  JCEF Panels │   │           Settings                       │    │
│  │  ─────────── │   │  GatomiaSettings (PersistentState)       │    │
│  │  CreateSpec  │   │  GatomiaSettingsConfigurable (UI page)   │    │
│  │  DocPreview  │   └─────────────────────────────────────────┘    │
│  │  HooksConfig │                                                   │
│  │  Welcome     │                                                   │
│  └──────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘
         │                 │
         ▼                 ▼
  ┌────────────┐    ┌─────────────┐
  │  SpecKit   │    │   OpenSpec  │
  │    CLI     │    │    CLI      │
  └────────────┘    └─────────────┘
```

---

## Fase 1: Fundação — Projeto Gradle + Tool Windows Base

### 1.1 Setup do Projeto

**Arquivo**: `build.gradle.kts`
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

**Arquivo**: `gradle.properties`
```properties
pluginName=GatomIA
pluginVersion=1.0.0-alpha
pluginSinceBuild=241
pluginUntilBuild=251.*
platformType=IC
platformVersion=2024.1
```

### 1.2 Plugin Descriptor

**Arquivo**: `src/main/resources/META-INF/plugin.xml`

Estrutura completa com:
- ID: `com.eitatech.gatomia`
- Tool Windows declarados (Specs, Hooks, Steering, Actions)
- Application/Project services registrados
- Actions registradas com grupos de menu
- Listeners registrados
- Configurável de Settings

### 1.3 Settings (PersistentStateComponent)

**Arquivo**: `src/main/kotlin/.../settings/GatomiaSettings.kt`

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

**Arquivo**: `src/main/kotlin/.../services/SpecManagerService.kt`

Porta direta da lógica de `SpecManager` (TypeScript) para Kotlin:
- Lê specs do diretório configurado
- Detecta sistema ativo (SpecKit vs OpenSpec)
- Retorna lista de specs com metadata
- Suporte a watch de mudanças via `BulkFileListener`

### 1.5 SpecToolWindow (Tree View)

**Arquivo**: `src/main/kotlin/.../toolwindow/spec/SpecToolWindow.kt`

```
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

Toolbar com botões:
- `+` Create New Spec
- `↺` Refresh
- `⚙` Settings

---

## Fase 2: Actions e CLI Integration

### 2.1 CliRunner

**Arquivo**: `src/main/kotlin/.../utils/CliRunner.kt`

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

Fluxo:
1. Usuário aciona "Create New Spec"
2. Se JCEF disponível → abre `CreateSpecPanel` (JCEF)
3. Senão → diálogo nativo Kotlin com campos básicos
4. Usuário preenche campos e clica "Create"
5. Plugin chama `CliRunner.execute(["specify", "specify", "--description", desc])`
6. OU: monta prompt e envia para JetBrains AI Assistant
7. FileChangeListener detecta arquivos criados
8. SpecToolWindow atualiza automaticamente

### 2.3 RunTaskAction

Fluxo:
1. Usuário clica "Run Task" no SpecToolWindow (item tasks.md)
2. Plugin lê o arquivo tasks.md
3. Extrai tasks pendentes (parser de checklist markdown)
4. Apresenta diálogo com tasks disponíveis
5. Abre tasks.md no editor + AI Assistant com contexto da task
6. OU: executa `specify implement` via CLI

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

## Fase 3: JCEF UI

### 3.1 Estratégia de Reutilização da UI React

A UI React existente (`ui/`) será compilada para dois alvos:

**Novo build target** em `ui/vite.config.ts`:
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

**Nova bridge JCEF** em `ui/src/bridge/jcef-bridge.ts`:
```typescript
// Substitui a postMessage do VSCode pela API JCEF
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

        // Handler para mensagens da UI → Kotlin
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

Reutiliza a feature de preview de documentos (spec.md, plan.md, tasks.md) com:
- Markdown renderizado com mermaid/plantuml
- Botões de ação (Edit, Refine, etc.)
- Sincronização com arquivo em disco via `VirtualFileListener`

---

## Fase 4: Hooks e MCP

### 4.1 HooksToolWindow

```
GatomIA Hooks
├── 🟢 after-spec-create → MCP: create-github-issue
├── 🟢 after-task-run → MCP: slack-notify
└── 🔴 before-review → (desabilitado)

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

Porta do `HookExecutor.ts` para Kotlin:
- Substituição de template variables (`$agentOutput`, `$clipboardContent`, etc.)
- Execução sequencial/paralela de hooks
- Logging com timestamps
- Tratamento de erros com retry

---

## Fase 5: AI Integration e Polimento

### 5.1 JetBrains AI Assistant Integration

```kotlin
// Integração via AI Assistant plugin API
// Plugin dependency: com.intellij.ml.llm (opcional)
class AiAssistantService(private val project: Project) {

    fun sendPrompt(prompt: String, onChunk: (String) -> Unit) {
        // Verifica se AI Assistant está disponível
        val aiPlugin = PluginManagerCore.getPlugin(PluginId.getId("com.intellij.ml.llm"))
        if (aiPlugin == null || !aiPlugin.isEnabled) {
            // Fallback: copiar para clipboard
            CopyPasteManager.getInstance().setContents(StringSelection(prompt))
            Notifications.Bus.notify(
                Notification("GatomIA", "Prompt copiado",
                    "O prompt foi copiado para o clipboard. Cole no seu AI Chat preferido.",
                    NotificationType.INFORMATION)
            )
            return
        }

        // Usar reflection ou serviços públicos disponíveis
        // para comunicar com o AI Assistant
    }
}
```

### 5.2 CodeMarker para tasks.md

Substituição do CodeLens do VSCode:

```kotlin
class TaskLineMarkerProvider : LineMarkerProvider {
    override fun getLineMarkerInfo(element: PsiElement): LineMarkerInfo<*>? {
        // Detecta linhas "- [ ] Task description" em tasks.md
        if (element is PsiFile && element.name == "tasks.md") {
            // Retorna marcador com botão "▶ Run Task"
        }
        return null
    }
}
```

---

## Decisões de Design

### D1: Repositório Separado vs Monorepo

**Decisão**: Repositório separado `gatomia-jetbrains`.

**Razão**: O JetBrains plugin usa Kotlin/Gradle, completamente diferente do Node.js/TypeScript do VSCode. Um monorepo adicionaria complexidade sem benefício significativo.

**Exceção**: A pasta `ui/` pode ser um **git submodule** compartilhado entre os dois repositórios, permitindo que a UI React seja mantida em um único lugar.

### D2: JCEF vs UI Nativa

**Decisão**: JCEF para UIs complexas, Kotlin nativo para explorers simples.

**Razão**: Reutilização de código e fidelidade de UX. A UI React existente já tem qualidade e funcionalidades avançadas (markdown preview, mermaid, etc.) que seriam custosas de replicar em Swing.

**Critério de uso de JCEF**:
- Formulários multi-step com validação complexa → JCEF
- Tree views simples → Kotlin nativo
- Preview de documentos → JCEF
- Diálogos simples de input → Kotlin nativo

### D3: AI Integration no MVP

**Decisão**: Fallback via clipboard para o MVP; integração com JetBrains AI API como feature adicional.

**Razão**: Reduz risco de dependência de API instável. O usuário pode usar qualquer AI Chat (JetBrains AI, ChatGPT, Claude, etc.) copiando o prompt gerado pelo plugin.

### D4: Kotlin Coroutines para operações async

**Decisão**: Usar `kotlinx.coroutines` com `CoroutineScope(Dispatchers.IO)` para todas as operações de I/O (CLI, MCP, filesystem).

**Razão**: Evitar bloqueio da EDT (Event Dispatch Thread) do Swing, que travaria a UI do IDE.

---

## Dependências e Versões

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

    // Markdown parsing (para tasks.md e specs)
    implementation("org.commonmark:commonmark:0.22.0")

    // YAML (para frontmatter de specs)
    implementation("com.charleskorn.kaml:kaml:0.57.0")

    // Tests
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")
    testImplementation("io.mockk:mockk:1.13.9")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.0")
}
```

---

## Estimativas de Complexidade por Componente

| Componente | Complexidade | Notas |
|---|---|---|
| Projeto Gradle + plugin.xml | Baixa | Template disponível |
| GatomiaSettings | Baixa | API estável e simples |
| SpecManagerService | Média | Porta lógica do TypeScript |
| SpecToolWindow | Média | Tree view com renderização customizada |
| CliRunner | Baixa | ProcessBuilder + coroutines |
| CreateSpecAction | Média | Diálogo nativo simples |
| SteeringToolWindow | Média | Semelhante ao SpecToolWindow |
| ActionsToolWindow | Média | Semelhante ao SpecToolWindow |
| JCEF Bridge (Kotlin) | Alta | API JCEF tem curva de aprendizado |
| JCEF Bridge (TypeScript) | Média | Adaptar bridge existente |
| CreateSpecPanel (JCEF) | Alta | Integração JCEF + React |
| DocumentPreviewPanel | Alta | JCEF + sync com disco |
| McpClient | Alta | Protocol JSON-RPC, process management |
| HookManager | Alta | Porta de lógica complexa |
| HooksToolWindow | Alta | JCEF + tree view + logs |
| AI Assistant Integration | Alta | API instável, requer investigação |
| TaskLineMarkerProvider | Média | API LineMarker disponível |
| DiagnosticsService | Baixa | Verificação de processos |
| CI/CD (GitHub Actions) | Baixa | Plugin template tem exemplo |

---

## Cronograma Sugerido

```
Fase 1 (Fundação)          ██████░░░░░░░░░░░░░░  Sprint 1-2
Fase 2 (Actions + CLI)     ░░░░░░██████░░░░░░░░  Sprint 3-4
Fase 3 (JCEF UI)           ░░░░░░░░░░░░██████░░  Sprint 5-6
Fase 4 (Hooks + MCP)       ░░░░░░░░░░░░░░░░████  Sprint 7-8
Fase 5 (AI + Polimento)    ░░░░░░░░░░░░░░░░░░██  Sprint 9-10
```

MVP funcional (Fases 1-2): após Sprint 4
Beta com UI completa (Fases 1-3): após Sprint 6
Release candidate (Fases 1-4): após Sprint 8
Launch (Fase 5): após Sprint 10
