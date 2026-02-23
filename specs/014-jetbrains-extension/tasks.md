# Tasks: GatomIA for JetBrains IDEs

**Feature**: `014-jetbrains-extension`
**Branch**: `claude/jetbrains-extension-plan-jB2yS`

---

## Fase 1 — Fundação e Estrutura

- [ ] **TASK-01** Criar repositório `gatomia-jetbrains` com template do IntelliJ Platform Plugin
  - Usar [intellij-platform-plugin-template](https://github.com/JetBrains/intellij-platform-plugin-template) como base
  - Configurar `build.gradle.kts` com IntelliJ Platform Gradle Plugin v2.3.0+
  - Configurar `gradle.properties` com versões (SDK: 2024.1, since-build: 241)
  - Configurar `.github/workflows/build.yml` para CI

- [ ] **TASK-02** Criar `plugin.xml` completo com todas as extensões declaradas
  - Tool Windows: Specs, Hooks, Steering, Actions
  - Application Services: GatomiaSettings
  - Project Services: SpecManagerService, HookManagerService, SteeringManagerService, PromptLoaderService
  - Listeners: ProjectOpenListener, FileChangeListener
  - Configurable: GatomiaSettingsConfigurable
  - Action groups e actions declaradas

- [ ] **TASK-03** Implementar `GatomiaSettings` (PersistentStateComponent)
  - Campos: specSystem, specsPath, promptsPath, chatLanguage, agentsResourcesPath, enableHotReload
  - Campos de visibilidade de views
  - Serialização XML automática via @State

- [ ] **TASK-04** Implementar `SpecManagerService` (Project Service)
  - Leitura de specs do diretório configurado (SpecKit ou OpenSpec)
  - Detecção automática do sistema ativo
  - Retorno de lista de specs com metadata (nome, status, datas)
  - Suporte a refresh manual

- [ ] **TASK-05** Implementar `SpecToolWindow` com tree view básico
  - Nós raiz: Current, Review, Archived
  - Subnós: spec folders com seus arquivos (spec.md, plan.md, tasks.md)
  - Renderer customizado com ícones
  - Toolbar: Create, Refresh, Settings
  - Double-click: abre arquivo no editor

- [ ] **TASK-06** Implementar `SteeringManagerService` e `SteeringToolWindow`
  - Lê Constitution, AGENTS.md, instruction rules (project + user)
  - Tree view com grupos: Constitution, Project Rules, User Rules
  - Toolbar: Create Constitution, Create Project Rule, Create User Rule, Refresh

- [ ] **TASK-07** Implementar `FileChangeListener` (BulkFileListener)
  - Monitora mudanças em arquivos de spec (*.md nas pastas de specs)
  - Notifica services via MessageBus para refresh das tree views
  - Configurável via `enableHotReload` setting

- [ ] **TASK-08** Implementar `ProjectOpenListener`
  - Inicializa services ao abrir projeto
  - Verifica dependências (SpecKit/OpenSpec CLIs)
  - Exibe Welcome Screen se primeira ativação

- [ ] **TASK-09** Testes unitários para SpecManagerService e SteeringManagerService
  - Cobertura: leitura de specs, detecção de sistema, parsing de frontmatter

---

## Fase 2 — Actions e CLI Integration

- [ ] **TASK-10** Implementar `CliRunner` utilitário
  - Execução de processos externos com streaming de output
  - Suporte a coroutines (Dispatchers.IO)
  - Detecção de CLI instalado (isInstalled check)
  - Timeout configurável

- [ ] **TASK-11** Implementar `DiagnosticsService`
  - Verifica: SpecKit CLI, OpenSpec CLI, Git, JetBrains AI Assistant
  - Retorna status de cada dependência
  - Usado pela Welcome Screen

- [ ] **TASK-12** Implementar `CreateSpecAction`
  - Diálogo nativo de input (campos: description, spec system)
  - Executa `specify specify` ou `openspec create` via CliRunner
  - Fallback: monta prompt e copia para clipboard + abre AI Chat
  - Notificação de sucesso/erro

- [ ] **TASK-13** Implementar `ImplTaskAction` e `RunTaskAction`
  - Lê tasks.md do spec selecionado
  - Parser de checklist markdown para extrair tasks pendentes
  - Apresenta lista de tasks em diálogo
  - Executa task via CLI ou abre AI com contexto

- [ ] **TASK-14** Implementar `DeleteSpecAction` com confirmação
  - Diálogo de confirmação antes de deletar
  - Move para Archived ou remove definitivamente

- [ ] **TASK-15** Implementar `ActionsToolWindow` (prompts/agents explorer)
  - Lê arquivos de `.github/prompts/`, `.github/instructions/`, `.github/agents/`
  - Tree view com grupos: Prompts, Instructions, Agents, Skills
  - Ações: Run Prompt, Create Prompt, Rename, Delete

- [ ] **TASK-16** Implementar `CreatePromptAction` e `RunPromptAction`
  - Create: cria arquivo `.md` em `.github/prompts/` com template
  - Run: lê conteúdo do arquivo de prompt, copia/envia para AI

- [ ] **TASK-17** Implementar `CreateConstitutionAction`, `CreateUserRuleAction`, `CreateProjectRuleAction`
  - Diálogo de nome/descrição
  - Cria arquivo no local correto com template
  - Abre arquivo no editor

- [ ] **TASK-18** Implementar `GatomiaSettingsConfigurable` (Settings UI)
  - Painel de configurações com campos de UI nativa (Kotlin UI DSL)
  - Grupos: General, Spec Management, Views, Agents
  - Apply/Reset/Cancel funcionando corretamente

- [ ] **TASK-19** Implementar `NotificationUtils`
  - Wrappers para diferentes tipos de notificação
  - Suporte a ações clicáveis nas notificações
  - Group ID consistente

- [ ] **TASK-20** Testes unitários para CliRunner, CreateSpecAction, parsers

---

## Fase 3 — JCEF UI

- [ ] **TASK-21** Criar bridge JCEF no lado TypeScript (`ui/src/bridge/jcef-bridge.ts`)
  - Implementa mesma interface da VSCode bridge
  - Usa `window.cefQuery` para enviar mensagens ao Kotlin
  - Usa `CustomEvent` para receber mensagens do Kotlin
  - Feature detection: detecta se está rodando em JCEF ou VSCode

- [ ] **TASK-22** Adaptar build da UI para target `jcef`
  - Novo script `npm run build:jcef` em `ui/package.json`
  - Output vai para `../gatomia-jetbrains/src/main/resources/webview/`
  - Substituição de bridge em build time

- [ ] **TASK-23** Implementar `GatomiaJcefPanel` base (Kotlin)
  - Wrapper sobre `JBCefBrowser`
  - Setup do message router (CefQueryHandler)
  - Método `sendToUI(type, payload)` via executeJavaScript
  - Método abstrato `handleMessage(type, payload)`
  - Verificação de disponibilidade de JCEF

- [ ] **TASK-24** Implementar `CreateSpecPanel` (JCEF)
  - Abre a UI React de criação de spec dentro do JetBrains
  - Handlers para: form submit, cancel, attach image
  - Fecha painel após criação bem-sucedida

- [ ] **TASK-25** Implementar `DocumentPreviewPanel` (JCEF)
  - Carrega a UI React de preview de documentos
  - Sincronização com arquivo em disco via VirtualFileListener
  - Ações de refinamento (Refine, Edit)

- [ ] **TASK-26** Implementar `WelcomePanel` (JCEF)
  - Reutiliza Welcome Screen React
  - Handlers para: install dependency, open settings, run command
  - Diagnósticos via DiagnosticsService

- [ ] **TASK-27** Fallback nativo para quando JCEF não disponível
  - `CreateSpecDialog` nativo (Kotlin UI DSL) com campos básicos
  - Notificação quando features avançadas não disponíveis

- [ ] **TASK-28** Testes de integração JCEF cross-platform
  - Linux (X11), Linux (Wayland), macOS, Windows
  - Verificar carregamento da UI React
  - Verificar comunicação bidirecional

---

## Fase 4 — Hooks e MCP

- [ ] **TASK-29** Implementar `McpClient` (JSON-RPC sobre stdio)
  - Inicialização de processo MCP server via ProcessBuilder
  - Handshake `initialize` / `initialized`
  - `tools/list` para descobrir ferramentas disponíveis
  - `tools/call` para executar ferramentas
  - Gestão de lifecycle (start, keepalive, stop)
  - Timeout e retry logic

- [ ] **TASK-30** Implementar `HookManagerService`
  - Persistência de hooks (PersistentStateComponent ou arquivo JSON)
  - CRUD: add, edit, enable, disable, delete
  - Import/export de hooks (JSON)
  - Lista de hooks por trigger

- [ ] **TASK-31** Implementar `HookExecutor`
  - Leitura de template variables (`$agentOutput`, `$clipboardContent`, etc.)
  - Substituição de variáveis em parâmetros de action
  - Execução de ação MCP via McpClient
  - Logging com timestamps
  - Error handling com retry

- [ ] **TASK-32** Implementar `TriggerRegistry`
  - Registro de triggers disponíveis (after-spec-create, after-task-run, etc.)
  - Dispatch de hooks quando trigger ocorre
  - Suporte a timing: before/after

- [ ] **TASK-33** Implementar `HooksToolWindow`
  - Tree view: lista de hooks com status (enabled/disabled)
  - Log panel: execuções recentes com timestamps
  - Toolbar: Add Hook, Import, Export, View Logs, Refresh

- [ ] **TASK-34** Implementar `HooksConfigPanel` (JCEF) ou nativo
  - Formulário de configuração de hook
  - Seletor de MCP server e tool (via McpClient.listTools())
  - Mapeamento de parâmetros

- [ ] **TASK-35** Implementar ações de hooks: AddHook, EditHook, EnableHook, DeleteHook

- [ ] **TASK-36** Implementar leitura de MCP config
  - Detectar arquivo mcp.json (GitHub Copilot config path)
  - Parsear lista de servers configurados
  - Fallback para config própria do GatomIA

- [ ] **TASK-37** Testes de integração para McpClient e HookExecutor

---

## Fase 5 — AI Integration e Polimento

- [ ] **TASK-38** Implementar `AiAssistantService`
  - Detecção de disponibilidade do JetBrains AI Assistant plugin
  - Envio de prompt para AI Chat quando disponível
  - Fallback para clipboard quando não disponível

- [ ] **TASK-39** Implementar `RefinementGatewayService`
  - Porta do `refinement-gateway.ts` para Kotlin
  - Mapeamento de document type → agent command
  - Formatação de prompt de refinamento

- [ ] **TASK-40** Implementar `AgentService` e descoberta de agents
  - Lê agents de `resources/agents/*.agent.md`
  - Parseia frontmatter YAML dos agent files
  - Registra agents disponíveis no ActionsToolWindow

- [ ] **TASK-41** Implementar `TaskLineMarkerProvider` (equivalente ao CodeLens)
  - Detecta linhas `- [ ] description` em arquivos `tasks.md`
  - Exibe marcador lateral "▶ Run Task"
  - Clique abre ação de execução da task

- [ ] **TASK-42** Adicionar ícones customizados do plugin
  - Ícone principal (gatomia.svg) para sidebar do JetBrains
  - Ícones para cada tipo de item nos tree views
  - Versão dark/light dos ícones

- [ ] **TASK-43** Polimento de UX
  - Tooltips em todos os botões de toolbar
  - Atalhos de teclado para ações principais
  - Context menus (right-click) nos tree nodes
  - Mensagens de erro amigáveis

- [ ] **TASK-44** Documentação do plugin
  - README.md atualizado para JetBrains
  - CHANGELOG.md
  - Guia de contribuição
  - Screenshots e GIFs para o Marketplace

- [ ] **TASK-45** Configuração de publicação no JetBrains Marketplace
  - Conta de publisher criada
  - Token de publicação configurado como GitHub Secret
  - `./gradlew publishPlugin` testado
  - Plugin description page preparada

- [ ] **TASK-46** Testes E2E no IDE sandbox
  - Fluxo completo: instalar plugin → criar spec → ver no explorer
  - Fluxo de hooks: configurar hook → executar spec → hook executa
  - Fluxo de steering: criar instruction rule → ver no explorer

- [ ] **TASK-47** Teste em múltiplos IDEs
  - IntelliJ IDEA Community 2024.1
  - IntelliJ IDEA Community 2024.3
  - PyCharm Community 2024.1
  - WebStorm 2024.1
