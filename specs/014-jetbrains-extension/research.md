# Research: GatomIA for JetBrains — Technical Analysis

**Feature**: `014-jetbrains-extension`
**Created**: 2026-02-23

---

## 1. Análise da Extensão VSCode Existente

### 1.1 Estrutura de Código

```
src/
├── extension.ts              # Entry point — registra todos os providers, commands, watchers
├── constants.ts              # Namespace de configuração VSC_CONFIG_NAMESPACE
├── features/
│   ├── spec/
│   │   ├── spec-manager.ts         # Gerencia specs (SpecKit/OpenSpec)
│   │   ├── spec-kit-manager.ts     # Operações específicas SpecKit
│   │   ├── spec-submission-strategy.ts
│   │   └── create-spec-input-controller.ts
│   ├── hooks/
│   │   ├── hook-manager.ts         # CRUD de hooks (persistência em globalState)
│   │   ├── hook-executor.ts        # Execução de hooks com template variables
│   │   ├── trigger-registry.ts     # Registro de triggers disponíveis
│   │   ├── agent-registry.ts       # Descoberta de agents
│   │   └── services/
│   │       ├── agent-discovery-service.ts
│   │       ├── extension-monitor-service.ts
│   │       └── file-watcher-service.ts
│   ├── agents/
│   │   ├── agent-loader.ts         # Carrega agents de resources/agents/
│   │   ├── chat-participant-registry.ts  # Registra como chat participants
│   │   └── tools/                  # Tool handlers para agentes
│   └── steering/
│       ├── steering-manager.ts     # Gerencia Constitution/AGENTS.md
│       ├── constitution-manager.ts
│       └── instruction-rules.ts
├── providers/
│   ├── spec-explorer-provider.ts    # TreeDataProvider para specs
│   ├── hooks-explorer-provider.ts   # TreeDataProvider para hooks
│   ├── steering-explorer-provider.ts
│   ├── actions-explorer-provider.ts
│   ├── copilot-provider.ts          # Integração com GitHub Copilot
│   └── interactive-view-provider.ts
├── services/
│   ├── agent-service.ts
│   ├── configuration-service.ts
│   ├── refinement-gateway.ts       # Envia prompts para Copilot Chat
│   └── prompt-loader.ts
└── utils/
    ├── chat-prompt-runner.ts        # sendPromptToChat() via vscode.commands
    ├── config-manager.ts            # Singleton de configurações
    ├── copilot-mcp-utils.ts         # MCP via vscode.lm
    └── platform-utils.ts            # paths cross-platform
```

### 1.2 Integração com GitHub Copilot Chat

O ponto central da extensão VSCode é `sendPromptToChat()`:

```typescript
// utils/chat-prompt-runner.ts
export const sendPromptToChat = async (
    prompt: string,
    context?: ChatContext,
    files?: Uri[]
): Promise<void> => {
    // Aplica language e custom instructions ao prompt
    // Depois executa:
    await commands.executeCommand("workbench.action.chat.open", {
        query: finalPrompt,
        isPartialQuery: false,
        ...(supportsFilesParam() && files?.length ? { files } : {}),
    });
};
```

Toda a "IA" da extensão é terceirizada para o GitHub Copilot Chat. O plugin apenas:
1. Monta o prompt correto
2. Abre o chat com o prompt pré-preenchido
3. O usuário interage com o Copilot Chat
4. Copilot gera os arquivos
5. File watchers detectam os novos arquivos

### 1.3 Persistência de Dados

- **Settings**: `vscode.workspace.getConfiguration()` → JetBrains: `PersistentStateComponent`
- **Hooks**: `context.globalState` → JetBrains: `PersistentStateComponent` ou arquivo JSON no `~/.gatomia/`
- **Spec data**: Arquivos em disco (sem banco de dados)

### 1.4 UI React (WebView)

```
ui/src/
├── features/
│   ├── create-spec-view/      # Formulário de criação de spec
│   ├── hooks-view/            # Gerenciador de hooks
│   ├── preview/               # Preview de documentos markdown
│   ├── steering-view/         # (views do steering)
│   └── welcome/               # Tela de boas-vindas
└── bridge/                    # Comunicação WebView ↔ Extension
    └── (abstração de postMessage)
```

A bridge usa `acquireVsCodeApi().postMessage()` e `window.addEventListener('message')`.

---

## 2. JetBrains Platform SDK — APIs Relevantes

### 2.1 Tool Windows

```kotlin
// Declaração em plugin.xml
<toolWindow id="GatomIA Specs"
    anchor="left"
    secondary="false"
    icon="AllIcons.General.Modified"
    factoryClass="com.eitatech.gatomia.toolwindow.SpecToolWindowFactory"/>

// Implementação
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
        // Adiciona nós
        reload()
    }
}
```

### 2.3 File System Watchers

```kotlin
// Registrado em plugin.xml como listener
class FileChangeListener : BulkFileListener {
    override fun after(events: List<VFileEvent>) {
        val specFiles = events.filter { it.file?.name?.endsWith("spec.md") == true }
        if (specFiles.isNotEmpty()) {
            ApplicationManager.getApplication().invokeLater {
                // Notifica SpecToolWindow para atualizar
                project.messageBus.syncPublisher(SPEC_CHANGED_TOPIC).onSpecChanged()
            }
        }
    }
}
```

### 2.4 JCEF (JetBrains Chromium Embedded Framework)

```kotlin
// Disponível desde IntelliJ 2020.1
// Verificar disponibilidade:
if (!JBCefApp.isSupported()) {
    // Fallback para UI nativa
}

val browser = JBCefBrowser()
browser.loadURL("file:///path/to/index.html")

// Enviar dados para JS:
browser.executeJavaScript("window.receiveData(${json})", "", 0)

// Receber dados do JS:
val handler = object : CefQueryHandler {
    override fun onQuery(
        browser: CefBrowser, frame: CefFrame,
        queryId: Long, request: String,
        persistent: Boolean, callback: CefQueryCallback
    ): Boolean {
        // `request` contém a mensagem do JS
        handleMessage(request)
        callback.success("")
        return true
    }
}
```

### 2.5 Actions (Commands)

```kotlin
// Registrado em plugin.xml
<action id="gatomia.spec.create"
    class="com.eitatech.gatomia.actions.spec.CreateSpecAction"
    text="Create New Spec"
    icon="AllIcons.General.Add">
    <add-to-group group-id="GatomiaSpecGroup" anchor="first"/>
</action>

// Implementação
class CreateSpecAction : AnAction("Create New Spec") {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val specService = project.getService(SpecManagerService::class.java)
        // Abre diálogo ou JCEF panel
    }
}
```

### 2.6 Settings (Configurable)

```kotlin
// Registrado em plugin.xml
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
// Simples
Notifications.Bus.notify(
    Notification("GatomIA", "Spec criada!", "spec.md foi gerado com sucesso.",
        NotificationType.INFORMATION)
)

// Com ação
Notification("GatomIA", "Erro", "SpecKit CLI não encontrado.",
    NotificationType.ERROR
).apply {
    addAction(NotificationAction.create("Instalar SpecKit") { _, notification ->
        BrowserUtil.browse("https://github.com/github/spec-kit")
        notification.expire()
    })
}.also { Notifications.Bus.notify(it) }
```

### 2.8 Process Execution

```kotlin
// Executar CLI de forma assíncrona
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

### 3.1 Status da API (2025)

A JetBrains disponibilizou API pública para o AI Assistant a partir da versão 2024.2 do plugin `com.intellij.ml.llm`.

**Funcionalidades disponíveis**:
- Enviar prompts para o chat do AI Assistant
- Criar ações personalizadas que aparecem no contexto do AI

**Documentação**:
- [AI Assistant Extension Development](https://plugins.jetbrains.com/docs/intellij/ai-assistant-api.html)

### 3.2 Uso básico (quando disponível)

```kotlin
// Verificar se AI Assistant está disponível
val isAiAvailable = PluginManagerCore.getPlugin(
    PluginId.getId("com.intellij.ml.llm")
)?.isEnabled == true

// Usar via reflection para evitar hard dependency
if (isAiAvailable) {
    // Chamar API do AI Assistant
} else {
    // Fallback: copiar para clipboard
    copyToClipboard(prompt)
    showNotification("Prompt copiado! Cole no seu AI Chat preferido.")
}
```

---

## 4. MCP no JetBrains

### 4.1 Suporte Nativo JetBrains

A partir de 2025.1, o JetBrains AI Assistant tem suporte nativo a MCP servers.

Para o plugin GatomIA, o `McpClient` deve:
1. Ler a configuração de MCP servers (de `mcp.json` padrão ou arquivo customizado)
2. Iniciar processos de MCP servers via `ProcessBuilder`
3. Comunicar via JSON-RPC sobre stdin/stdout
4. Gerenciar lifecycle dos processos (start, health check, stop)

### 4.2 Localização do mcp.json no JetBrains

O JetBrains não tem o mesmo arquivo `mcp.json` que o VS Code. Opções:
- Usar o mesmo arquivo `~/.config/github-copilot/mcp.json` (se o usuário usa Copilot)
- Ter configuração própria do GatomIA para MCP servers
- Ler da configuração do JetBrains AI Assistant (quando API disponível)

---

## 5. Riscos Técnicos Detalhados

### 5.1 JCEF em Linux

O JCEF no Linux pode ter problemas de:
- Renderização com Wayland (usar `GDK_BACKEND=x11` como workaround)
- Performance em VMs/containers
- Fontes e DPI

**Mitigação**: Testar cedo em Ubuntu 22.04 (Wayland) e 20.04 (X11). Ter UI nativa de fallback para formulários críticos.

### 5.2 Cross-Platform Path Handling

VSCode usa `Uri` que abstrai paths. No JetBrains:
- Usar `VirtualFile` para arquivos dentro do projeto
- Usar `Path.of()` para arquivos do sistema (nunca `String` concatenation)
- `FileUtil.toSystemIndependentName()` para normalização

### 5.3 Threading no IDE

O JetBrains IDE tem regras estritas:
- **EDT** (Event Dispatch Thread): Apenas operações de UI
- **Read Action**: Leitura do PSI (índice de código)
- **Write Action**: Modificação de arquivos
- **IO Dispatch**: Operações de I/O

```kotlin
// Correto: operação de arquivo fora da EDT
ApplicationManager.getApplication().executeOnPooledThread {
    val content = VfsUtil.loadText(virtualFile)
    ApplicationManager.getApplication().invokeLater {
        // Atualizar UI na EDT
        treeModel.reload()
    }
}
```

### 5.4 Plugin.xml Validation

O JetBrains Marketplace faz validação estrita do `plugin.xml`. Pontos críticos:
- Todos os `id` de actions devem ser únicos globalmente (usar `com.eitatech.gatomia.*`)
- Tool Window IDs devem ser únicos
- Versões `since-build` e `until-build` precisam ser corretas

---

## 6. Tooling e Build

### 6.1 IntelliJ Platform Gradle Plugin

```kotlin
plugins {
    id("org.jetbrains.intellij.platform") version "2.3.0"
}
```

Tarefas Gradle úteis:
- `./gradlew buildPlugin` — Gera arquivo `.zip` do plugin
- `./gradlew runIde` — Lança IDE sandbox com plugin instalado
- `./gradlew verifyPlugin` — Valida compatibilidade
- `./gradlew publishPlugin` — Publica no Marketplace (requer token)

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

## 7. Referências e Recursos

### Documentação Oficial
- [IntelliJ Platform SDK Docs](https://plugins.jetbrains.com/docs/intellij/welcome.html)
- [IntelliJ Platform Plugin Template](https://github.com/JetBrains/intellij-platform-plugin-template)
- [JCEF Guide](https://plugins.jetbrains.com/docs/intellij/jcef.html)
- [Tool Windows Guide](https://plugins.jetbrains.com/docs/intellij/tool-windows.html)
- [Gradle IntelliJ Platform Plugin](https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin.html)

### Plugins Open Source de Referência
- [GitToolBox](https://github.com/zielu/GitToolBox) — Exemplo de plugin complexo com Kotlin
- [Rainbow Brackets](https://github.com/izhangzhihao/intellij-rainbow-brackets) — Exemplo com JCEF
- [CodeWithMe](https://plugins.jetbrains.com/plugin/14896-code-with-me) — Exemplo de tool windows complexos

### Projetos Relacionados
- [SpecKit](https://github.com/github/spec-kit) — CLI base usado pela GatomIA
- [OpenSpec](https://github.com/Fission-AI/OpenSpec) — Alternativa ao SpecKit
- [MCP Specification](https://modelcontextprotocol.io/) — Protocolo MCP para hooks
