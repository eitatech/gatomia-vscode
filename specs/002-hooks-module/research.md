# Research: Hooks Module Architecture

**Feature**: Hooks Module  
**Branch**: `001-hooks-module`  
**Date**: 2025-12-03  
**Phase**: 0 - Architecture Research

## Purpose

Research architectural patterns, event handling mechanisms, and persistence strategies for implementing the Hooks Module in the GatomIA VS Code extension. The module will enable users to automate SDD workflow sequences by configuring triggers that execute actions when specific agent operations complete.

## Existing Infrastructure Analysis

### 1. Extension Architecture

**Pattern**: Dual-component architecture (Extension + Webview)

```
Extension (src/) - Node.js Context
├── Features (business logic)
│   ├── spec/ - SpecKit/OpenSpec management
│   └── steering/ - Project documentation
├── Providers (VS Code UI integration)
└── Services (shared utilities)

Webview (ui/) - Browser Context
└── Features (React components)
    ├── create-spec-view/
    ├── create-steering-view/
    └── interactive-view/
```

**Communication**: Message passing via VSCode Webview API
- Extension → Webview: `panel.webview.postMessage(message)`
- Webview → Extension: `webview.onDidReceiveMessage((message) => {...})`

**Reference**: 
- `/src/providers/interactive-view-provider.ts` lines 38-51
- `/src/features/spec/create-spec-input-controller.ts` lines 189-284
- `/ui/src/bridge/vscode.ts`

### 2. Event System Patterns

**TreeView Refresh Pattern**: Used in existing providers

```typescript
private readonly _onDidChangeTreeData: EventEmitter<Item | undefined | null | void>;
readonly onDidChangeTreeData: Event<Item | undefined | null | void>;

refresh(): void {
    this._onDidChangeTreeData.fire();
}
```

**Found In**:
- `SpecExplorerProvider` - refreshes spec tree
- `SteeringExplorerProvider` - refreshes steering tree
- `PromptsExplorerProvider` - refreshes prompts tree

**Implications for Hooks**:
- Can use EventEmitter pattern for hook execution events
- Need to emit events when agent operations complete (specify, clarify, plan, etc.)
- HookExecutor should listen to these events and trigger configured actions

### 3. State Persistence

**Current Patterns**:

```typescript
// Workspace-scoped state (per-project)
context.workspaceState.get<T>(key, defaultValue)
context.workspaceState.update(key, value)

// Global state (cross-project)
context.globalState.get<T>(key, defaultValue)
context.globalState.update(key, value)
```

**Reference**: `/src/features/spec/create-spec-input-controller.ts` lines 291-305

**Decision for Hooks**:
- Use `workspaceState` for hook configurations (project-specific)
- Storage key: `"gatomia.hooks.configurations"`
- Format: `Array<Hook>` serialized as JSON

### 4. Feature Manager Pattern

**Existing Managers**:
- `SpecManager` (`/src/features/spec/spec-manager.ts`)
  - Manages spec creation workflows
  - Integrates with SpecKit/OpenSpec systems
  - Uses `CreateSpecInputController` for webview interaction
  
- `SteeringManager` (`/src/features/steering/steering-manager.ts`)
  - Handles project documentation
  - Uses `ConstitutionManager` for constitution files
  - Integrates with Copilot chat prompts

**Pattern to Follow**:
```typescript
export class HookManager {
    private readonly context: ExtensionContext;
    private readonly outputChannel: OutputChannel;
    private hooks: Hook[] = [];

    constructor(context: ExtensionContext, outputChannel: OutputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.loadHooks();
    }

    async loadHooks(): Promise<void> {
        this.hooks = this.context.workspaceState.get<Hook[]>('gatomia.hooks.configurations', []);
    }

    async saveHooks(): Promise<void> {
        await this.context.workspaceState.update('gatomia.hooks.configurations', this.hooks);
    }

    // CRUD operations...
}
```

### 5. Command Execution Patterns

**Agent Command Execution**: Via `sendPromptToChat()`

**Reference**: `/src/utils/chat-prompt-runner.ts`

```typescript
export async function sendPromptToChat(
    userPrompt: string,
    references?: ChatReference[]
): Promise<void> {
    // Sends prompt to GitHub Copilot Chat
}
```

**Implications**:
- Hook actions that execute SpecKit/OpenSpec commands can use this utility
- Actions will need to construct appropriate prompt strings
- Example: `sendPromptToChat('/speckit.clarify')`

### 6. Webview Integration Pattern

**Existing Pattern**: Feature-specific view components

```
ui/src/features/create-steering-view/
├── index.tsx           # Main view component
├── types.ts            # UI-specific types
└── components/         # Sub-components
```

**Message Flow**:
1. User interacts with webview UI
2. Webview sends message to extension: `vscode.postMessage({ command: 'hooks.create', data: {...} })`
3. Extension handler processes message
4. Extension updates state and sends response: `webview.postMessage({ command: 'hooks.updated', data: {...} })`
5. Webview updates UI based on response

## Architectural Decisions

### A1: Hook Execution Trigger Mechanism

**Options Evaluated**:

1. **Event Emitter Pattern** (RECOMMENDED)
   - Create `TriggerRegistry` that emits events after agent operations
   - Hook executor listens to these events
   - Pros: Decoupled, testable, follows existing patterns
   - Cons: Requires instrumentation of existing agent code
   
2. **Polling Pattern**
   - Periodically check for completed operations
   - Pros: No changes to existing code
   - Cons: Latency, inefficient, doesn't scale

3. **Command Wrapper Pattern**
   - Wrap all agent commands with hook execution logic
   - Pros: Centralized
   - Cons: Tightly coupled, hard to maintain

**Decision**: Event Emitter Pattern
- Aligns with existing EventEmitter usage in providers
- Clean separation of concerns
- Enables future extensibility (plugins, custom triggers)

**Implementation Strategy**:
```typescript
export class TriggerRegistry {
    private readonly eventEmitter = new EventEmitter<TriggerEvent>();
    readonly onTrigger = this.eventEmitter.event;

    fireTrigger(agent: string, operation: string): void {
        this.eventEmitter.fire({ agent, operation, timestamp: Date.now() });
    }
}
```

### A2: Circular Dependency Prevention

**Problem**: Hook chains could create infinite loops (Hook A → Hook B → Hook A)

**Solution**: Execution Context Tracking
```typescript
interface ExecutionContext {
    executionId: string;
    chainDepth: number;
    executedHooks: Set<string>;
}

class HookExecutor {
    private readonly MAX_CHAIN_DEPTH = 10;
    
    async execute(hook: Hook, context?: ExecutionContext): Promise<void> {
        const ctx = context || this.createContext();
        
        // Prevent circular execution
        if (ctx.executedHooks.has(hook.id)) {
            throw new Error(`Circular dependency detected for hook: ${hook.id}`);
        }
        
        // Prevent excessive chaining
        if (ctx.chainDepth >= this.MAX_CHAIN_DEPTH) {
            throw new Error('Maximum hook chain depth exceeded');
        }
        
        ctx.executedHooks.add(hook.id);
        ctx.chainDepth++;
        
        // Execute hook action...
        // If action triggers another event, pass ctx to nested execution
    }
}
```

### A3: Hook Action Abstraction

**Design**: Strategy Pattern for Actions

```typescript
interface HookAction {
    type: 'agent' | 'git' | 'github' | 'custom';
    execute(context: ActionExecutionContext): Promise<void>;
}

class AgentAction implements HookAction {
    type = 'agent' as const;
    constructor(private command: string) {}
    
    async execute(context: ActionExecutionContext): Promise<void> {
        await sendPromptToChat(this.command);
    }
}

class GitAction implements HookAction {
    type = 'git' as const;
    constructor(private operation: 'commit' | 'push', private template: string) {}
    
    async execute(context: ActionExecutionContext): Promise<void> {
        const message = this.expandTemplate(this.template, context);
        // Execute git operation using VS Code git extension API
    }
}
```

### A4: Webview State Management

**Pattern**: Message-driven state synchronization

```typescript
// Extension maintains source of truth
class HookManager {
    private hooks: Hook[] = [];
    
    async syncToWebview(webview: Webview): Promise<void> {
        await webview.postMessage({
            command: 'hooks.sync',
            data: { hooks: this.hooks }
        });
    }
}

// Webview maintains local copy
function HooksView() {
    const [hooks, setHooks] = useState<Hook[]>([]);
    
    useEffect(() => {
        window.addEventListener('message', (event) => {
            if (event.data.command === 'hooks.sync') {
                setHooks(event.data.data.hooks);
            }
        });
    }, []);
}
```

### A5: Template Variable System

**Requirement**: Support dynamic values in actions (FR-017)

**Design**: Simple string interpolation with context data

```typescript
interface TemplateContext {
    feature?: string;      // Current feature name
    branch?: string;       // Current git branch
    timestamp?: string;    // Current timestamp
    user?: string;         // Current user name
}

function expandTemplate(template: string, context: TemplateContext): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        return context[key as keyof TemplateContext] || match;
    });
}

// Example usage
const commitMessage = expandTemplate(
    "feat: {feature} - automated commit at {timestamp}",
    { feature: "hooks-module", timestamp: new Date().toISOString() }
);
// Result: "feat: hooks-module - automated commit at 2025-12-03T11:58:07.673Z"
```

## Integration Points

### I1: SpecKit/OpenSpec Agent Integration

**Current State**: Agent operations are triggered via Copilot chat commands
- `/speckit.specify` - Create specification
- `/speckit.clarify` - Clarify requirements
- `/speckit.plan` - Generate implementation plan
- `/speckit.analyze` - Analyze spec quality
- `/speckit.checklist` - Validate spec completeness

**Integration Approach**:
1. Add `TriggerRegistry` as singleton service
2. Modify agent command handlers to emit events after completion
3. HookExecutor subscribes to these events

**Example Modification**:
```typescript
// In SpecManager or command handler
class SpecCommandHandler {
    constructor(private triggerRegistry: TriggerRegistry) {}
    
    async handleSpecify(args: string): Promise<void> {
        // Existing specify logic...
        await createSpecification(args);
        
        // NEW: Fire trigger event
        this.triggerRegistry.fireTrigger('speckit', 'specify');
    }
}
```

### I2: Git Integration

**VS Code Git Extension API**:
```typescript
import { extensions } from 'vscode';

const gitExtension = extensions.getExtension('vscode.git')?.exports;
const git = gitExtension?.getAPI(1);

if (git) {
    const repository = git.repositories[0]; // Get first repo
    await repository.commit('Automated commit message');
    await repository.push();
}
```

**Reference**: VS Code Git Extension API documentation

### I3: GitHub MCP Server Integration

**Current State**: GitHub MCP Server tools available (from tool list in context)
- `github-mcp-server-issue_read`
- `github-mcp-server-pull_request_read`
- Other GitHub operations

**Integration Approach**:
- Actions will need to interface with MCP Server client
- May require additional MCP client wrapper utility
- Template variables for issue titles/bodies

**Note**: Implementation details pending MCP Server client availability in extension

## Data Model Overview

### Core Entities

```typescript
interface Hook {
    id: string;                    // UUID
    name: string;                  // User-friendly name
    enabled: boolean;              // Enable/disable without deleting
    trigger: TriggerCondition;
    action: ActionConfig;
    createdAt: number;            // Unix timestamp
    modifiedAt: number;           // Unix timestamp
}

interface TriggerCondition {
    agent: 'speckit' | 'openspec'; // Which agent system
    operation: string;             // specify, clarify, plan, analyze, checklist
    timing: 'after';              // Future: 'before' for pre-hooks
}

interface ActionConfig {
    type: 'agent' | 'git' | 'github' | 'custom';
    parameters: Record<string, any>; // Type-specific parameters
}

// Type-specific parameter examples:
interface AgentActionParams {
    command: string;               // e.g., '/speckit.clarify'
}

interface GitActionParams {
    operation: 'commit' | 'push';
    messageTemplate: string;       // e.g., 'feat: {feature}'
}

interface GitHubActionParams {
    operation: 'open-issue' | 'close-issue' | 'create-pr';
    repository?: string;
    titleTemplate?: string;
    bodyTemplate?: string;
}
```

### Hook Execution Log

```typescript
interface HookExecutionLog {
    hookId: string;
    executionId: string;          // UUID for this execution
    triggeredAt: number;          // Unix timestamp
    status: 'success' | 'failure' | 'skipped';
    error?: string;
    duration?: number;            // Milliseconds
}
```

## Performance Considerations

### P1: Hook Execution Performance

**Target**: 90% of executions complete within 5 seconds (SC-002)

**Strategy**:
- Sequential execution (prevents race conditions)
- Queue pattern for multiple simultaneous triggers
- Timeout mechanism (default: 30 seconds per action)

### P2: UI Responsiveness

**Target**: <200ms UI interaction latency

**Strategy**:
- Optimistic UI updates (update UI immediately, sync with extension)
- Debounced webview syncs (avoid flooding with updates)
- Virtual scrolling for large hook lists (50+ hooks)

### P3: Storage Efficiency

**Target**: Support 50+ hooks per workspace

**Strategy**:
- JSON serialization of hook array
- Lazy loading (only load when hooks view is opened)
- Periodic cleanup of old execution logs

## Testing Strategy

### Unit Tests (Vitest)

**Extension Side**:
- `HookManager.test.ts` - CRUD operations, persistence
- `HookExecutor.test.ts` - Execution logic, circular detection
- `TriggerRegistry.test.ts` - Event emission, subscription

**Webview Side**:
- `HooksList.test.tsx` - Rendering, user interactions
- `HookForm.test.tsx` - Form validation, submission

### Integration Tests

**Workflow Tests**:
- Create hook → Trigger condition → Verify action executed
- Edit hook → Trigger → Verify updated action executed
- Disable hook → Trigger → Verify no execution
- Chain hooks → Verify sequential execution

### Edge Case Tests

- Circular dependency detection
- Maximum chain depth enforcement
- Concurrent trigger handling
- Hook execution failure recovery

## Open Questions

### Q1: Hook Execution Feedback

**Question**: How should users be notified of hook execution status?

**Options**:
1. **Status Bar Notification** - Brief message in VS Code status bar
2. **Output Channel** - Detailed logs in "GatomIA - Hooks" output channel
3. **Webview Badge** - Counter badge on hooks view icon
4. **All of the above** (RECOMMENDED)

**Recommendation**: Multi-level feedback
- Status bar: Quick success/failure notification (auto-dismiss after 3s)
- Output channel: Detailed execution logs for debugging
- Webview: Live execution status indicator (spinning icon during execution)

### Q2: Hook Import/Export

**Question**: Should users be able to share hook configurations across projects?

**Options**:
1. **Not in MVP** - Manual recreation only
2. **JSON Export/Import** - Export hooks to `.json` file, import in other projects
3. **Template Library** - Pre-built hook templates for common workflows

**Recommendation**: Not in MVP (defer to future enhancement)
- Reduces initial scope
- Can be added post-launch based on user feedback

### Q3: Hook Execution Order

**Question**: When multiple hooks share the same trigger, what determines execution order?

**Options**:
1. **Creation Order** - First created, first executed
2. **Priority Field** - User-assigned priority (1-10)
3. **Explicit Ordering** - Drag-and-drop reordering in UI

**Recommendation**: Creation Order for MVP
- Simpler implementation (no UI for reordering)
- Deterministic (FR-018 requirement)
- Can add priority/reordering in future versions

## Risks and Mitigations

### R1: Agent Command Completion Detection

**Risk**: No clear event when agent operations complete
**Impact**: Triggers may fire prematurely or not at all
**Mitigation**: 
- Instrument agent command handlers with explicit completion events
- Add `TriggerRegistry.fireTrigger()` calls after each operation
- Test thoroughly with actual agent workflows

### R2: Git Extension Dependency

**Risk**: VS Code Git extension may not be installed or enabled
**Impact**: Git actions will fail
**Mitigation**:
- Check for Git extension availability before executing Git actions
- Show helpful error message if Git extension is missing
- Gracefully degrade (skip Git actions, continue with other hooks)

### R3: MCP Server Availability

**Risk**: GitHub MCP Server may not be configured or accessible
**Impact**: GitHub actions will fail
**Mitigation**:
- Validate MCP Server connection before executing GitHub actions
- Show configuration guide if MCP Server is not available
- Allow users to disable GitHub hooks temporarily

## Next Steps

After completing this research phase, proceed to:

1. **Phase 1 - Design** (`/speckit.design`):
   - Create detailed data model schemas
   - Define component contracts
   - Design message protocols
   - Create developer quickstart guide

2. **Phase 2 - Task Breakdown** (`/speckit.tasks`):
   - Generate prioritized implementation tasks
   - Assign complexity estimates
   - Define testing requirements

## References

- VS Code Extension API: https://code.visualstudio.com/api
- EventEmitter Pattern: `/src/providers/spec-explorer-provider.ts`
- Webview Messaging: `/src/providers/interactive-view-provider.ts`
- State Persistence: `/src/features/spec/create-spec-input-controller.ts`
- Feature Manager Pattern: `/src/features/spec/spec-manager.ts`
