# Implementation Plan: Custom Agent Hooks Refactoring

**Branch**: `011-custom-agent-hooks` | **Date**: 2026-01-26 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/011-custom-agent-hooks/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Refactor the hooks mechanism to support custom agent selection through a dropdown UI, integrating agents from both local `.agent.md` files in `.github/agents/` and registered VS Code extensions. The system will automatically detect agent types (Local vs Background), support dynamic template variables for passing trigger context to agents, provide real-time agent list refresh via file system watchers and extension events, and implement comprehensive logging for execution visibility. This enhancement transforms the hooks system from manual agent name entry to a guided selection experience with robust error handling and observability.

## Technical Context

**Language/Version**: TypeScript 5.3+ (strict mode, target: ES2022)  
**Primary Dependencies**: VS Code Extension API 1.84.0+, React 18.3+ (webview), Vitest 3.2+ (testing), Biome (linting/formatting), gray-matter (YAML frontmatter parsing), VS Code FileSystemWatcher (file watching)  
**Storage**: VS Code Workspace State API (hooks configuration), File System (`.github/agents/*.agent.md` files)  
**Testing**: Vitest with dual dependency resolution (root + ui/node_modules), integration tests for agent discovery and extension registry  
**Target Platform**: VS Code Extension Host (Node.js environment) + Webview (browser environment with React)  
**Project Type**: VS Code Extension (dual-build: esbuild for extension, Vite for webview)  
**Performance Goals**: Agent dropdown appears in <2 seconds, file system changes reflected in <5 seconds, template variable replacement completes in <100ms  
**Constraints**: VS Code Extension API limitations, file system read performance, webview-extension bridge communication latency, backwards compatibility with existing hook configurations  
**Scale/Scope**: 10-50 local agents (`.agent.md` files), 5-20 extension-registered agents, 100+ hooks per workspace, 10-20 template variables per trigger type

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. Kebab-Case File Naming
- **Status**: PASS
- **Compliance**:
  - New files follow kebab-case: `agent-dropdown-provider.ts`, `agent-registry.ts`, `template-variable-parser.ts`, `file-watcher-service.ts`
  - Existing files already compliant: `hook-manager.ts`, `agent-service.ts`, `agent-loader.ts`
  - Test files: `agent-dropdown-provider.test.ts`, `agent-registry.test.ts`

### ✅ II. TypeScript-First Development
- **Status**: PASS
- **Compliance**:
  - All code uses TypeScript 5.3+ with `strict: true`
  - No `any` types without explicit justification
  - Public APIs have complete type definitions
  - New types: `AgentSource`, `AgentType` (Local | Background), `TemplateVariable`, `AgentRefreshEvent`

### ✅ III. Test-First Development (TDD)
- **Status**: PASS
- **Commitment**:
  - Tests written BEFORE implementation
  - Unit tests for: agent discovery, dropdown population, template parsing, type detection
  - Integration tests for: file watcher integration, extension registry query, end-to-end agent selection flow
  - Test coverage MUST NOT decrease (current baseline to be measured)

### ✅ IV. Observability & Instrumentation
- **Status**: PASS
- **Compliance**:
  - FR-015 mandates logging for: execution start, completion, failures, agent unavailability
  - Telemetry for: agent discovery count, dropdown render time, template substitution errors
  - Error reporting with full context: agent ID, trigger type, stack trace
  - No silent failures (all errors surface to user + logs)

### ✅ V. Simplicity & YAGNI
- **Status**: PASS
- **Compliance**:
  - Implementing only P1 and P2 user stories for MVP (P3 deferred)
  - No speculative abstractions (e.g., no plugin system for agent sources beyond local files + extensions)
  - Reusing existing `AgentLoader` and `AgentService` where possible
  - Following Rule of Three: only abstract after third use case emerges

**GATE RESULT**: ✅ **PASS** - All constitution principles satisfied. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/011-custom-agent-hooks/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── agent-registry-api.ts
│   ├── agent-dropdown-events.ts
│   └── template-variable-schema.ts
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# VS Code Extension Structure (existing, will be extended)

src/features/hooks/
├── hook-manager.ts             # MODIFY: Add agent validation integration
├── hook-executor.ts            # MODIFY: Add template variable substitution
├── types.ts                    # MODIFY: Add agent type fields to CustomActionParams
├── agent-registry.ts           # NEW: Agent discovery and registration coordination
├── agent-dropdown-provider.ts  # NEW: Provides dropdown data to webview
├── template-variable-parser.ts # NEW: Parse and replace template variables
└── file-watcher-service.ts     # NEW: Watch `.github/agents/` for changes

src/services/
├── agent-service.ts            # MODIFY: Add extension registry query methods
└── agent-discovery-service.ts  # NEW: Unified agent discovery (local + extensions)

src/providers/
└── hooks-explorer-provider.ts  # MODIFY: Add agent dropdown UI integration

ui/src/components/hooks-view/
├── agent-dropdown.tsx          # NEW: Dropdown component for agent selection
├── agent-type-selector.tsx     # NEW: Local vs Background type toggle
└── argument-template-editor.tsx # NEW: Template variable input with hints

tests/unit/features/hooks/
├── agent-registry.test.ts
├── agent-dropdown-provider.test.ts
├── template-variable-parser.test.ts
└── file-watcher-service.test.ts

tests/integration/
├── agent-discovery.integration.test.ts    # NEW
├── agent-dropdown-flow.integration.test.ts # NEW
└── template-substitution.integration.test.ts # NEW
```

**Structure Decision**: Extending existing VS Code extension structure. New agent-related features live in `src/features/hooks/` alongside existing hook infrastructure. Webview components added to `ui/src/components/hooks-view/` for React-based UI. Follows established dual-build pattern (esbuild for extension, Vite for webview).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations detected. Constitution Check passed all gates.

---

## Phase 0: Research & Investigation

### Research Questions

1. **VS Code Extension API for Agent Registration**
   - Question: Does VS Code provide a documented API for extensions to register custom agents/chat participants that can be discovered by other extensions?
   - Decision point: Use official API vs. custom registry vs. extension manifest scanning
   - Impact: Determines extension agent discovery implementation

2. **File System Watcher Performance**
   - Question: What's the performance impact of watching `.github/agents/*.agent.md` files with VS Code's FileSystemWatcher vs. chokidar?
   - Decision point: Built-in VS Code API vs. third-party library
   - Impact: Real-time refresh performance and resource usage

3. **Template Variable Syntax**
   - Question: What template variable syntax library should be used (handlebars, mustache, custom regex)?
   - Decision point: Full template engine vs. simple `{variableName}` regex replacement
   - Impact: Feature richness vs. complexity trade-off

4. **Background Agent CLIs Detection**
   - Question: How to detect availability of background CLI tools (OpenAI Codex CLI, Gemini CLI, GitHub Copilot CLI, Claude Code)?
   - Decision point: PATH scanning, executable checking, VS Code extension detection
   - Impact: Agent availability validation accuracy

5. **Dropdown Performance for Large Agent Lists**
   - Question: What's the best approach for rendering 50+ agents in a dropdown without UI lag?
   - Decision point: Virtualization, pagination, search/filter-first
   - Impact: User experience with many agents

### Research Outputs

*To be filled in `research.md` during Phase 0 execution*

---

## Phase 1: Architecture & Design

### System Components

#### 1. Agent Registry Service

**Responsibility**: Unified interface for discovering agents from all sources

**Key Methods**:
- `discoverAllAgents(): Promise<AgentRegistryEntry[]>` - Scans local files + queries extension API
- `getAgentById(id: string): AgentRegistryEntry | undefined` - Lookup by unique ID
- `refreshAgents(): Promise<void>` - Force refresh all sources
- `onAgentsChanged: Event<AgentRegistryEntry[]>` - Real-time change notifications

**Interfaces**:
```typescript
interface AgentRegistryEntry {
  id: string; // Unique identifier (source + name)
  name: string; // Display name
  displayName: string; // Name with source indicator if duplicate
  type: 'local' | 'background';
  source: 'file' | 'extension';
  sourcePath?: string; // For local agents
  extensionId?: string; // For extension agents
  description?: string;
  schema?: AgentConfigSchema;
}

interface AgentConfigSchema {
  supportedTriggers?: string[];
  requiredArguments?: string[];
  optionalArguments?: string[];
}
```

#### 2. Agent Dropdown Provider

**Responsibility**: Provides dropdown data to webview with grouping and disambiguation

**Key Methods**:
- `getDropdownItems(): DropdownItem[]` - Returns grouped, disambiguated list
- `detectDuplicates(agents: AgentRegistryEntry[]): Map<string, AgentRegistryEntry[]>` - Find name conflicts
- `applySourceIndicators(agents: AgentRegistryEntry[]): AgentRegistryEntry[]` - Add "(Local)" / "(Extension)" suffixes

**Data Flow**:
1. Extension → Webview: Send agent list on load
2. Webview → Extension: Request agent details on selection
3. Extension → Webview: Notify on agent list changes

#### 3. Template Variable Parser

**Responsibility**: Parse and replace template variables in argument strings

**Key Methods**:
- `parse(template: string): TemplateVariable[]` - Extract variables from template
- `substitute(template: string, context: TriggerContext): string` - Replace variables with values
- `validate(template: string, availableVars: string[]): ValidationResult` - Check variable validity

**Template Syntax**: `{variableName}` (curly braces)

**Built-in Variables** (per trigger type):
- Common: `{triggerEvent}`, `{timestamp}`, `{branch}`, `{user}`
- Spec triggers: `{specId}`, `{oldStatus}`, `{newStatus}`, `{changeAuthor}`
- File triggers: `{filePath}`, `{fileName}`, `{fileExtension}`
- MCP triggers: `{serverId}`, `{toolName}`, `{result}`

#### 4. File Watcher Service

**Responsibility**: Monitor `.github/agents/` directory for changes

**Key Methods**:
- `initialize(path: string): Promise<void>` - Start watching directory
- `onFileChanged: Event<FileChangeEvent>` - Notify on file add/modify/delete
- `dispose()` - Clean up watcher resources

**Integration**:
- FileWatcherService → AgentRegistry → AgentDropdownProvider → Webview

#### 5. Agent Discovery Service

**Responsibility**: Low-level agent discovery from file system and extension registry

**Key Methods**:
- `discoverLocalAgents(directory: string): Promise<AgentDefinition[]>` - Scan `.agent.md` files
- `discoverExtensionAgents(): Promise<ExtensionAgent[]>` - Query VS Code extension API
- `parseAgentFile(filePath: string): Promise<AgentDefinition>` - Parse YAML frontmatter

**Integration with Existing Code**:
- Reuses `AgentLoader` from `src/features/agents/agent-loader.ts`
- Extends to support background agent discovery

### Data Model

*Detailed data model to be generated in `data-model.md`*

Key entities:
1. **AgentRegistryEntry** - Unified agent representation
2. **AgentType** - Enum: Local | Background
3. **AgentSource** - Enum: File | Extension
4. **TemplateVariable** - Parsed variable with name and default value
5. **TriggerContext** - Runtime data for template substitution

### Integration Points

1. **Existing HookManager**:
   - Add `validateAgentAvailability()` check before save
   - Integrate `TemplateVariableParser` in execution flow

2. **Existing AgentService**:
   - Extend to expose `discoverExtensionAgents()` method
   - Add agent availability check method

3. **Webview Bridge**:
   - New messages: `requestAgents`, `agentSelected`, `agentsRefreshed`
   - Existing message handling infrastructure reused

4. **VS Code Extension API**:
   - `workspace.fs` for file operations
   - `workspace.createFileSystemWatcher()` for directory monitoring
   - `extensions.all` for extension agent discovery (if API available)

### Error Handling Strategy

1. **Agent Unavailable at Runtime**:
   - Show VS Code error notification with agent details
   - Log failure with diagnostic info (FR-015)
   - Allow manual retry via command palette

2. **Missing Template Variables**:
   - Replace with empty string (from clarifications)
   - Log warning with variable name and trigger type

3. **File System Errors**:
   - Graceful degradation: show last known agent list
   - Log error and notify user via status bar

4. **Extension Registry Query Failures**:
   - Proceed with local agents only
   - Log error for diagnostics

---

## Phase 2: Task Breakdown

*Tasks to be generated in `tasks.md` by `/speckit.tasks` command - NOT created by this plan*

Expected task categories:
1. Setup & Infrastructure
2. Agent Registry Implementation
3. Dropdown UI Implementation
4. Template Variable Parser Implementation
5. File Watcher Integration
6. Extension Registry Integration
7. Error Handling & Logging
8. Testing & Validation
9. Documentation & Examples

---

## Dependencies & Prerequisites

### External Dependencies
- **gray-matter** (already used): YAML frontmatter parsing for `.agent.md` files
- No new major dependencies required

### Internal Dependencies
1. Existing `AgentLoader` service (`src/features/agents/agent-loader.ts`)
2. Existing `AgentService` (`src/services/agent-service.ts`)
3. Existing `HookManager` (`src/features/hooks/hook-manager.ts`)
4. Existing webview bridge infrastructure (`ui/src/bridge/`)

### Prerequisite Tasks
1. ✅ Specification complete (`spec.md`)
2. ✅ Clarifications resolved (5 clarifications documented)
3. ✅ Implementation plan created (this file)
4. ⏳ Research questions answered (`research.md` - Phase 0)
5. ⏳ Data model defined (`data-model.md` - Phase 1)
6. ⏳ API contracts defined (`contracts/` - Phase 1)

---

## Risk Mitigation

### High Risk: Extension API Availability
- **Risk**: VS Code may not provide API for discovering extension-registered agents
- **Mitigation**: Research VS Code Extension API documentation thoroughly (Phase 0); fallback to manifest scanning
- **Contingency**: If API unavailable, document manual agent registration process

### Medium Risk: File Watcher Performance
- **Risk**: Watching large `.github/agents/` directories could impact performance
- **Mitigation**: Implement debouncing (500ms) and limit recursive depth to 3 levels
- **Contingency**: Add configuration option to disable real-time refresh

### Medium Risk: Template Variable Parsing Complexity
- **Risk**: Complex template syntax could introduce security vulnerabilities or parsing bugs
- **Mitigation**: Use simple `{variableName}` syntax with regex; no code execution; comprehensive tests
- **Contingency**: Revert to static argument strings if parsing issues arise

### Low Risk: Backwards Compatibility
- **Risk**: Existing hooks with manual agent names may break
- **Mitigation**: Detect legacy `CustomActionParams.agentName` field and migrate automatically
- **Contingency**: Provide manual migration guide in quickstart.md

---

## Success Metrics (from Spec)

- **SC-001**: Users configure hook with agent selection in <30 seconds
- **SC-002**: 100% of agents from `.github/agents/*.agent.md` appear in dropdown within 2 seconds
- **SC-003**: Template variable replacement occurs without errors for all standard trigger types
- **SC-004**: Users configure hooks that pass trigger context on first attempt
- **SC-005**: Zero hooks fail due to agent unavailability that could have been detected at configuration time
- **SC-006**: Extension-registered agents appear in dropdown within 5 seconds of extension installation
- **SC-007**: All hook execution events logged with sufficient diagnostic information

---

## Next Steps

1. **Run `/speckit.tasks`** to generate detailed task breakdown
2. **Execute Phase 0**: Answer research questions in `research.md`
3. **Execute Phase 1**: Define data model and contracts
4. **Execute Phase 2**: Implement tasks in priority order (P1 → P2 → P3)
5. **Test & Validate**: Run full test suite + manual QA
6. **Document**: Update README and quickstart.md

---

**Plan Status**: ✅ Complete - Ready for Phase 0 research
