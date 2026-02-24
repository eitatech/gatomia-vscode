# Feature Specification: GatomIA for JetBrains IDEs

**Feature Branch**: `claude/jetbrains-extension-plan-jB2yS`
**Created**: 2026-02
**Status**: Draft
**Type**: New Product — JetBrains Plugin

---

## 1. Resumo Executivo

Criar uma versão da extensão **GatomIA** para os produtos JetBrains (IntelliJ IDEA, PyCharm, WebStorm, GoLand, Rider, etc.), mantendo paridade de funcionalidades com a extensão VSCode existente. O plugin JetBrains deve oferecer a mesma experiência de Spec-Driven Development Agêntico, integrando-se com as ferramentas de IA disponíveis no ecossistema JetBrains.

---

## 2. Contexto do Produto

### 2.1 O que é a GatomIA (VSCode)

A GatomIA é um toolkit de **Agentic Spec-Driven Development** que oferece:

| Módulo | Descrição |
|---|---|
| **Spec Management** | Criação e gestão de especificações com SpecKit/OpenSpec |
| **Copilot Agents** | Integração com GitHub Copilot Chat como participantes de chat |
| **Steering** | Gestão de Constitution, AGENTS.md e instruction rules |
| **Hooks & Automation** | Automação via MCP (Model Context Protocol) |
| **Prompt Management** | Gestão de prompts `.github/prompts` |
| **Wiki Management** | Sincronização de documentação do repositório |
| **Welcome Screen** | Onboarding interativo e diagnósticos |

### 2.2 Dependências Críticas da Versão VSCode

A versão VSCode depende fortemente de:

1. **`vscode` API** — Tree views, WebViews, CodeLens, commands, workspace, etc.
2. **`vscode.lm` API** — Language Model API para interação com modelos de IA
3. **`vscode.chat` API** — Participantes de chat do GitHub Copilot
4. **GitHub Copilot Chat** — Extensão externa obrigatória (pré-requisito)
5. **`vscode.languages` API** — CodeLens providers
6. **WebView com React** — UI complexa (formulários, previews, hooks configurator)

---

## 3. Escopo da Versão JetBrains

### 3.1 Features In-Scope (MVP)

- [x] Spec Explorer — Tree view com visualização e gestão de specs
- [x] Criar Nova Spec — Formulário de criação via painel embarcado (JCEF)
- [x] Executar Tasks — Ação para executar tasks de spec files
- [x] Steering Explorer — Gestão de Constitution/AGENTS.md e instruction rules
- [x] Actions Explorer — Gestão de prompts e agents do `.github/`
- [x] Hooks Explorer — Configuração e gestão de hooks MCP
- [x] Document Preview — Preview de specs e planos com markdown
- [x] Welcome Screen — Tela de boas-vindas e diagnósticos
- [x] SpecKit Integration — Execução do CLI `specify` como processo externo
- [x] OpenSpec Integration — Execução do CLI `openspec` como processo externo
- [x] Settings — Configurações do plugin via painel de Settings do JetBrains
- [x] Notifications — Feedback de operações via balloon notifications

### 3.2 Features Out-of-Scope (MVP, planejadas para v2)

- [ ] Chat Participants / Copilot Agents (dependente de API pública estável de JetBrains AI ou Copilot)
- [ ] CodeLens inline em task files
- [ ] Wiki Management automatizado
- [ ] Migration wizard (OpenSpec → SpecKit)

---

## 4. Análise de Gaps: VSCode → JetBrains

### 4.1 Mapeamento de APIs

| Conceito VSCode | Equivalente JetBrains | Complexidade |
|---|---|---|
| `ExtensionContext` | `Project`, `Disposable` (services) | Média |
| `TreeDataProvider` | `AbstractTreeStructure` / `TreeModel` | Alta |
| `WebviewPanel` | JCEF `JBCefBrowser` | Alta |
| `commands.registerCommand` | `AnAction` / `ActionManager` | Baixa |
| `workspace.onDidChangeConfiguration` | `AppSettingsListener` / `ProjectSettingsListener` | Média |
| `window.showInformationMessage` | `Notifications.Bus.notify()` | Baixa |
| `vscode.lm` (LM API) | JetBrains AI Assistant API / MCP Client | Alta |
| `vscode.chat` (Copilot Chat) | Sem equivalente público direto no MVP | N/A MVP |
| `languages.registerCodeLensProvider` | `LineMarkerProvider` / `EditorLinePainter` | Alta |
| `OutputChannel` | `ConsoleView` / `ToolWindowManager` | Média |
| `FileSystemWatcher` | `VirtualFileListener` / `BulkFileListener` | Média |
| `window.createTerminal` | `TerminalRunner` / `GeneralCommandLine` | Baixa |
| `workspace.fs` | `VirtualFileSystem` / `LocalFileSystem` | Baixa |
| `StatusBarItem` | `StatusBarWidget` | Baixa |
| `Uri` | `VirtualFile` / `Path` | Baixa |

### 4.2 Mapeamento de Views

| VSCode | JetBrains |
|---|---|
| Activity Bar com ícone customizado | Tool Window com ícone no sidebar |
| `TreeView` na sidebar | `SimpleToolWindowPanel` com `Tree` |
| `WebviewPanel` em coluna | Tool Window com `JBCefBrowser` |
| `WebviewView` na sidebar | Tool Window com `JBCefBrowser` embarcado |
| Painel de configurações (`package.json` contributes) | `Configurable` / Settings page |

### 4.3 Integração de IA

O ponto mais crítico de diferença é a integração com IA:

**VSCode**: Usa `vscode.lm` + `vscode.chat` para criar participantes no GitHub Copilot Chat. A extensão envia prompts diretamente para o chat do Copilot.

**JetBrains — Opções**:

| Opção | Descrição | Viabilidade MVP |
|---|---|---|
| **A — JetBrains AI Assistant** | API pública desde 2024.x para integração com AI Assistant. Suporte a prompts inline e tool calls. | Alta |
| **B — Copilot Plugin JetBrains** | GitHub Copilot para JetBrains existe, mas não expõe API pública para extensões terceiras criarem "agentes". | Baixa |
| **C — MCP direto** | JetBrains 2025.1+ suporta MCP. O plugin pode atuar como servidor MCP ou cliente MCP para AI tools. | Alta (v2) |
| **D — Terminal/CLI** | Executar especializados via CLI (SpecKit, OpenSpec) e exibir resultados. Não requer AI diretamente. | Alta (MVP) |

**Decisão para MVP**: Abordagem híbrida:
1. O plugin gerencia todas as UIs, workflows e arquivos
2. Para ações que requerem IA: abrir o arquivo de prompt no AI Chat do JetBrains (via clipboard + AI Assistant) ou executar CLI tools (SpecKit/OpenSpec)
3. Para hooks/MCP: integração direta via JSON-RPC/stdio

---

## 5. Arquitetura Proposta

### 5.1 Stack Tecnológico

```
Plugin JetBrains (Kotlin + IntelliJ Platform SDK)
├── plugin.xml                    # Plugin descriptor (actions, tool windows, services)
├── src/main/kotlin/
│   ├── actions/                  # AnAction implementations (commands equivalentes)
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
│   │   ├── jcef/                 # JCEF browser panels (React webviews reutilizados)
│   │   └── native/               # Kotlin UI DSL components
│   ├── listeners/                # File system and project listeners
│   ├── settings/                 # Settings configurables
│   └── utils/                    # Utilities compartilhadas
└── src/main/resources/
    ├── META-INF/plugin.xml
    └── icons/                    # SVG icons
```

### 5.2 Estratégia de UI

**Componentes Nativos Kotlin (Tool Windows simples)**:
- Spec Explorer tree
- Hooks Explorer tree
- Steering Explorer tree
- Actions Explorer tree

**JCEF (Reutilização da UI React existente)**:
- Formulário "Create New Spec" (complexo, multi-step)
- Hooks Configurator (seletor de MCP servers/tools)
- Document Preview (markdown com mermaid/plantuml)
- Welcome Screen

Essa abordagem permite reutilizar o código React/TypeScript já existente (`ui/`) com adaptações mínimas na bridge de comunicação (substituir `vscode.postMessage` por `JBCefBrowser.postMessage`).

### 5.3 Bridge de Comunicação (JCEF ↔ Kotlin)

```
WebView (React)                    Plugin (Kotlin)
    │                                    │
    │ window.postMessage(msg) ───────────▶ JBCefBrowser.addLoadHandler
    │                                    │   .onMessage(msg)
    │                                    │
    │ window.receiveMessage ◀─────────── JBCefBrowser.executeJavaScript(
    │                                    │   "window.receiveMessage(data)")
```

O arquivo `ui/src/bridge/` já contém abstração de comunicação. Para JetBrains, criar um adapter que substitui a bridge VSCode pela bridge JCEF.

---

## 6. Estrutura do Projeto JetBrains

```
gatomia-jetbrains/                      # Novo repositório (ou módulo no monorepo)
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
│   │   │       │   ├── GatomiaToolWindowFactory.kt   # Registra todos os tool windows
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
└── ui/                                 # Reutilizado do gatomia-vscode (symlink ou submodule)
    └── src/
        └── bridge/
            ├── vscode-bridge.ts        # Bridge atual (VSCode)
            └── jcef-bridge.ts          # Nova bridge para JetBrains (NOVO)
```

---

## 7. Configuração do Plugin (`plugin.xml`)

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
    <!-- ... demais ações ... -->
  </actions>
</idea-plugin>
```

---

## 8. Integração com IA (Estratégia)

### 8.1 Fluxo sem API de Chat direta (MVP)

Para o MVP, quando o usuário acionar uma operação que requer IA (criar spec, gerar constitution, etc.):

```
Usuário clica "Create Spec"
        │
        ▼
Plugin monta o prompt completo
(mesmo texto que seria enviado ao Copilot Chat no VSCode)
        │
        ▼
Estratégia A: JetBrains AI Assistant disponível?
  → Sim: Abre painel AI Chat com prompt pré-preenchido
  → Não: Copia prompt para clipboard + notifica usuário
        │
        ▼
Resultado esperado: IA gera os arquivos de spec
        │
        ▼
FileChangeListener detecta novos arquivos
→ Spec Explorer atualiza automaticamente
```

### 8.2 JetBrains AI Assistant API

A partir do IntelliJ Platform 2024.2, existe a `com.intellij.ai.openapi` que permite:
- Enviar prompts para o AI Assistant programaticamente
- Receber streaming de respostas
- Executar actions do AI

```kotlin
// Exemplo de integração com JetBrains AI Assistant
val aiService = project.getService(AIAssistantService::class.java)
aiService.sendPrompt(
    prompt = compiledPrompt,
    onResponse = { response -> handleResponse(response) }
)
```

### 8.3 CLI como fallback robusto

O SpecKit CLI (`specify`) e OpenSpec CLI (`openspec`) são ferramentas de linha de comando que já realizam a geração de spec files. O plugin pode executá-los diretamente:

```kotlin
// Executor de CLI
val result = CliRunner.execute(
    command = listOf("specify", "specify", "--description", userDescription),
    workingDir = project.basePath!!
)
```

---

## 9. Fases de Implementação

### Fase 1 — Fundação e Estrutura (Sprint 1-2)

**Objetivo**: Plugin funcional com estrutura base e explorers de tree view.

- [ ] Configurar projeto Gradle com IntelliJ Platform Plugin (`intellij-platform-gradle-plugin`)
- [ ] Criar `plugin.xml` com definições de Tool Windows e Actions
- [ ] Implementar `GatomiaSettings` (PersistentStateComponent)
- [ ] Implementar `ConfigurationService` (wrapper das settings)
- [ ] Implementar `SpecManagerService` (leitura de specs do disco)
- [ ] Implementar `SpecToolWindow` com tree view básico
- [ ] Implementar `SteeringManagerService` (leitura de constitution, rules)
- [ ] Implementar `SteeringToolWindow` com tree view
- [ ] Implementar `FileChangeListener` (monitora mudanças em spec files)
- [ ] Criar `ProjectOpenListener` (inicialização dos services)
- [ ] Configurar CI/CD para build do plugin (GitHub Actions)

**Entregável**: Plugin instalável que exibe specs existentes no sidebar

---

### Fase 2 — Ações Core e CLI Integration (Sprint 3-4)

**Objetivo**: Usuário pode criar specs e executar tasks via CLI.

- [ ] Implementar `CliRunner` (executa SpecKit/OpenSpec como processo externo)
- [ ] Implementar `CreateSpecAction` com diálogo de input (Kotlin UI DSL)
- [ ] Implementar `ImplTaskAction` e `RunTaskAction`
- [ ] Implementar `DeleteSpecAction`
- [ ] Implementar `CreateConstitutionAction`
- [ ] Implementar `CreateUserRuleAction` e `CreateProjectRuleAction`
- [ ] Implementar `ActionsToolWindow` (prompts/agents explorer)
- [ ] Implementar `CreatePromptAction` e `RunPromptAction`
- [ ] Implementar sistema de notificações (`NotificationUtils`)
- [ ] Implementar `DiagnosticsService` (checar SpecKit/OpenSpec instalados)
- [ ] Implementar Settings page com campos configuráveis
- [ ] Testes unitários para Services e CliRunner

**Entregável**: Usuário pode criar specs completas via CLI e navegar no explorer

---

### Fase 3 — JCEF UI e Document Preview (Sprint 5-6)

**Objetivo**: UI React reutilizada dentro do plugin JetBrains via JCEF.

- [ ] Criar `GatomiaJcefPanel` base com bridge Kotlin ↔ JavaScript
- [ ] Implementar `jcef-bridge.ts` na UI React (substitui `vscode-bridge.ts`)
- [ ] Adaptar build da UI para suportar dois alvos: `vscode` e `jcef`
- [ ] Implementar `CreateSpecPanel` (JCEF com formulário React)
- [ ] Implementar `DocumentPreviewPanel` (JCEF com markdown preview)
- [ ] Implementar `WelcomePanel` (JCEF com welcome screen React)
- [ ] Testar renderização cross-platform (Windows, macOS, Linux)

**Entregável**: UI rica reutilizada dentro do JetBrains IDE

---

### Fase 4 — Hooks e MCP Integration (Sprint 7-8)

**Objetivo**: Sistema de hooks funcional com integração MCP.

- [ ] Implementar `McpClient` (JSON-RPC via stdio ou HTTP)
- [ ] Implementar `HookManager` (persistência e execução de hooks)
- [ ] Implementar `HookExecutor` (execução com template variables)
- [ ] Implementar `TriggerRegistry`
- [ ] Implementar `HooksToolWindow` com tree view e logs
- [ ] Implementar `HooksConfigPanel` (JCEF com configurador React)
- [ ] Implementar `AddHookAction`, `EditHookAction`, `DeleteHookAction`
- [ ] Implementar import/export de hooks (JSON)
- [ ] Testes de integração para MCP client

**Entregável**: Automação via hooks MCP funcionando no JetBrains

---

### Fase 5 — AI Integration e Polimento (Sprint 9-10)

**Objetivo**: Integração com JetBrains AI Assistant e refinamentos.

- [ ] Implementar integração com JetBrains AI Assistant API
- [ ] Implementar `RefinementGatewayService` (porta do VSCode)
- [ ] Implementar `AgentService` (descoberta de agents do `resources/`)
- [ ] Adicionar ações de spec review flow
- [ ] Implementar CodeMarker (equivalente ao CodeLens) para tasks.md
- [ ] Polimento de UI (ícones, tooltips, atalhos de teclado)
- [ ] Documentação do plugin
- [ ] Testes E2E com IDE sandbox
- [ ] Publicação no JetBrains Marketplace

**Entregável**: Plugin pronto para lançamento no JetBrains Marketplace

---

## 10. Requisitos Técnicos

### 10.1 Compatibilidade de IDEs

| IDE | Versão Mínima | Testado em |
|---|---|---|
| IntelliJ IDEA (Community/Ultimate) | 2024.1+ | ✓ |
| PyCharm | 2024.1+ | ✓ |
| WebStorm | 2024.1+ | ✓ |
| GoLand | 2024.1+ | ✓ |
| Rider | 2024.1+ | Planejado |
| Android Studio | 2024.1+ | Planejado |

### 10.2 Compatibilidade de SO

| SO | Suportado |
|---|---|
| macOS (Intel + Apple Silicon) | ✓ |
| Windows 10/11 | ✓ |
| Linux (Ubuntu, Fedora) | ✓ |

### 10.3 Dependências Externas

| Dependência | Versão | Obrigatória |
|---|---|---|
| JDK | 17+ | Sim (via IDE) |
| SpecKit CLI (`specify`) | latest | Não (feature opcional) |
| OpenSpec CLI (`openspec`) | latest | Não (feature opcional) |
| MCP-compatible server | any | Não (hooks feature) |
| JetBrains AI Assistant | qualquer | Não (AI feature) |

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

## 11. Riscos e Mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| API do JetBrains AI Assistant ainda instável | Alto | Média | Implementar como layer opcional; fallback para clipboard |
| JCEF não disponível em todos os ambientes | Médio | Baixa | Fallback para diálogos nativos Kotlin |
| Performance do JCEF em Linux | Médio | Média | Testar cedo; considerar lazy loading |
| SpecKit CLI mudanças de API | Baixo | Baixa | Versionamento de CLI; detecção de versão |
| Diferenças de filesystem paths Windows | Médio | Alta | Usar `Path.of()` e `VirtualFile` consistently |
| JetBrains Marketplace review process | Baixo | Alta | Preparar com antecedência; seguir guidelines |

---

## 12. Métricas de Sucesso

| Métrica | Target |
|---|---|
| Paridade de features com VSCode | ≥ 80% das features core no MVP |
| Taxa de instalação (6 meses) | ≥ 500 instalações |
| Rating no Marketplace | ≥ 4.0/5.0 |
| Cobertura de testes | ≥ 70% |
| Build time | < 3 minutos |
| Compatibilidade de IDEs | IntelliJ, PyCharm, WebStorm, GoLand |

---

## 13. Referências

- [IntelliJ Platform SDK](https://plugins.jetbrains.com/docs/intellij/welcome.html)
- [IntelliJ Platform Plugin Template](https://github.com/JetBrains/intellij-platform-plugin-template)
- [JCEF (JetBrains Chromium Embedded Framework)](https://plugins.jetbrains.com/docs/intellij/jcef.html)
- [Tool Windows Guide](https://plugins.jetbrains.com/docs/intellij/tool-windows.html)
- [Actions System](https://plugins.jetbrains.com/docs/intellij/basic-action-system.html)
- [JetBrains Marketplace Publishing](https://plugins.jetbrains.com/docs/marketplace/publishing-plugin.html)
- [GatomIA VSCode Source](https://github.com/eitatech/gatomia-vscode)
