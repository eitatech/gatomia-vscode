# Component Contract: HookExecutor

**Feature**: Hooks Module  
**Component**: HookExecutor  
**Responsibility**: Execute hook actions, manage execution context, prevent circular dependencies

## Purpose

HookExecutor is responsible for executing hook actions when trigger conditions are met, managing execution chains, preventing circular dependencies, and recording execution results.

## Interface

```typescript
export class HookExecutor {
    constructor(
        hookManager: HookManager,
        triggerRegistry: TriggerRegistry,
        outputChannel: OutputChannel
    );

    // Lifecycle
    initialize(): void;
    dispose(): void;

    // Execution
    async executeHook(hook: Hook, context?: ExecutionContext): Promise<ExecutionResult>;
    async executeHooksForTrigger(agent: string, operation: string): Promise<ExecutionResult[]>;

    // Context Management
    createExecutionContext(): ExecutionContext;
    isCircularDependency(hookId: string, context: ExecutionContext): boolean;
    isMaxDepthExceeded(context: ExecutionContext): boolean;

    // Logging
    getExecutionLogs(): HookExecutionLog[];
    getExecutionLogsForHook(hookId: string): HookExecutionLog[];
    clearExecutionLogs(): void;

    // Events
    readonly onExecutionStarted: Event<ExecutionEvent>;
    readonly onExecutionCompleted: Event<ExecutionEvent>;
    readonly onExecutionFailed: Event<ExecutionEvent>;
}

interface ExecutionResult {
    hookId: string;
    hookName: string;
    status: ExecutionStatus;
    duration?: number;
    error?: ExecutionError;
}

interface ExecutionEvent {
    hook: Hook;
    context: ExecutionContext;
    result?: ExecutionResult;
}

type ExecutionStatus = 'success' | 'failure' | 'skipped' | 'timeout';
```

## Responsibilities

### Execute Hook

**Workflow**:
1. Check if hook is enabled (skip if disabled)
2. Get or create execution context
3. Check for circular dependency (error if detected)
4. Check max chain depth (error if exceeded)
5. Add hook ID to executed set
6. Increment chain depth
7. Build template context
8. Emit `onExecutionStarted` event
9. Execute action based on type:
   - Agent: Call `sendPromptToChat(command)`
   - Git: Execute git operation via Git extension API
   - GitHub: Call MCP Server operations
   - Custom: Invoke custom agent
10. Record execution log
11. Emit `onExecutionCompleted` or `onExecutionFailed`
12. Return execution result

**Circular Dependency Check**:
```typescript
if (context.executedHooks.has(hook.id)) {
    throw new CircularDependencyError(`Circular dependency detected: ${hook.name}`);
}
```

**Max Depth Check**:
```typescript
if (context.chainDepth >= MAX_CHAIN_DEPTH) {
    throw new MaxDepthExceededError(`Maximum chain depth (${MAX_CHAIN_DEPTH}) exceeded`);
}
```

### Execute Hooks For Trigger

**Workflow**:
1. Get all enabled hooks matching trigger (agent + operation)
2. Sort by creation order (deterministic execution - FR-018)
3. Create root execution context
4. For each hook:
   - Execute hook with shared context
   - Collect results
   - Continue on failure (don't abort chain)
5. Return array of execution results

**Example**:
```typescript
// Trigger: speckit.specify completed
const results = await executor.executeHooksForTrigger('speckit', 'specify');
// Executes all hooks with trigger { agent: 'speckit', operation: 'specify' }
```

### Template Context Building

```typescript
async buildTemplateContext(): Promise<TemplateContext> {
    const git = getGitExtension();
    const branch = await git?.repositories[0]?.state.HEAD?.name;
    const user = await git?.getConfig('user.name');
    
    const feature = branch ? extractFeatureName(branch) : undefined;
    
    return {
        feature,
        branch,
        timestamp: new Date().toISOString(),
        user
    };
}

function extractFeatureName(branch: string): string | undefined {
    // Extract from pattern: NNN-feature-name → 'feature-name'
    const match = branch.match(/^\d+-(.+)$/);
    return match ? match[1] : undefined;
}
```

### Action Execution Strategies

#### Agent Action
```typescript
async executeAgentAction(params: AgentActionParams): Promise<void> {
    await sendPromptToChat(params.command);
}
```

#### Git Action
```typescript
async executeGitAction(params: GitActionParams, context: TemplateContext): Promise<void> {
    const git = getGitExtension();
    if (!git) {
        throw new GitExtensionNotFoundError();
    }
    
    const message = expandTemplate(params.messageTemplate, context);
    const repo = git.repositories[0];
    
    if (params.operation === 'commit') {
        await repo.commit(message);
        if (params.pushToRemote) {
            await repo.push();
        }
    } else if (params.operation === 'push') {
        await repo.push();
    }
}
```

#### GitHub Action
```typescript
async executeGitHubAction(params: GitHubActionParams, context: TemplateContext): Promise<void> {
    // Requires MCP Server client integration
    const client = getMCPServerClient();
    if (!client) {
        throw new MCPServerNotAvailableError();
    }
    
    const title = params.titleTemplate 
        ? expandTemplate(params.titleTemplate, context)
        : undefined;
    const body = params.bodyTemplate
        ? expandTemplate(params.bodyTemplate, context)
        : undefined;
    
    switch (params.operation) {
        case 'open-issue':
            await client.openIssue(params.repository, title!, body);
            break;
        case 'close-issue':
            await client.closeIssue(params.repository, params.issueNumber!);
            break;
        // ... other operations
    }
}
```

#### Custom Action
```typescript
async executeCustomAction(params: CustomActionParams, context: TemplateContext): Promise<void> {
    const args = params.arguments 
        ? expandTemplate(params.arguments, context)
        : '';
    
    // Invoke custom agent (implementation depends on agent registry)
    await invokeCustomAgent(params.agentName, args);
}
```

### Execution Logging

```typescript
private logExecution(
    hook: Hook,
    context: ExecutionContext,
    result: ExecutionResult,
    templateContext: TemplateContext
): void {
    const log: HookExecutionLog = {
        id: uuidv4(),
        hookId: hook.id,
        executionId: context.executionId,
        chainDepth: context.chainDepth,
        triggeredAt: Date.now(),
        completedAt: Date.now(),
        duration: result.duration,
        status: result.status,
        error: result.error,
        contextSnapshot: templateContext
    };
    
    this.executionLogs.push(log);
    
    // Prune old logs (FIFO)
    if (this.executionLogs.length > MAX_EXECUTION_LOGS) {
        this.executionLogs.shift();
    }
}
```

## Dependencies

- `HookManager` - retrieve hooks for execution
- `TriggerRegistry` - subscribe to trigger events
- `vscode.OutputChannel` - logging
- `vscode.EventEmitter` - event emission
- Git Extension API - for git operations
- MCP Server Client - for GitHub operations
- `sendPromptToChat` utility - for agent commands

## Error Handling

| Error Scenario | Action |
|----------------|--------|
| Circular dependency | Throw `CircularDependencyError`, log error, return failure result |
| Max depth exceeded | Throw `MaxDepthExceededError`, log error, return failure result |
| Hook disabled | Skip execution, return status 'skipped' |
| Action timeout | Abort action after 30s, return status 'timeout' |
| Git extension missing | Log warning, return failure with helpful message |
| MCP Server unavailable | Log warning, return failure with helpful message |
| Action execution error | Log error, return failure with error details |

## Events

```typescript
// Emitted when hook execution starts
onExecutionStarted: Event<ExecutionEvent>

// Emitted when hook execution completes successfully
onExecutionCompleted: Event<ExecutionEvent>

// Emitted when hook execution fails
onExecutionFailed: Event<ExecutionEvent>
```

## Usage Example

```typescript
// Initialize
const executor = new HookExecutor(hookManager, triggerRegistry, outputChannel);
executor.initialize();

// Subscribe to trigger events
triggerRegistry.onTrigger(async (event) => {
    const results = await executor.executeHooksForTrigger(
        event.agent,
        event.operation
    );
    
    for (const result of results) {
        if (result.status === 'failure') {
            window.showErrorMessage(`Hook failed: ${result.hookName}`);
        }
    }
});

// Listen to execution events
executor.onExecutionStarted((event) => {
    outputChannel.appendLine(`Executing: ${event.hook.name}`);
});

executor.onExecutionCompleted((event) => {
    outputChannel.appendLine(`Completed: ${event.hook.name} in ${event.result?.duration}ms`);
});

// Manual execution (for testing)
const hook = await hookManager.getHook(hookId);
const result = await executor.executeHook(hook);
```

## Testing Requirements

### Unit Tests
- ✅ Execute enabled hook (success)
- ✅ Skip disabled hook
- ✅ Detect circular dependency
- ✅ Enforce max chain depth
- ✅ Build template context correctly
- ✅ Expand template variables
- ✅ Execute agent action
- ✅ Execute git action (commit)
- ✅ Execute git action (push)
- ✅ Execute GitHub action (open-issue)
- ✅ Execute custom action
- ✅ Handle action timeout
- ✅ Handle Git extension missing
- ✅ Handle MCP Server unavailable
- ✅ Log execution results
- ✅ Prune old logs (FIFO)
- ✅ Events emitted correctly

### Integration Tests
- ✅ Execute hook chain (Hook A triggers Hook B)
- ✅ Prevent circular chain (Hook A ↔ Hook B)
- ✅ Execute multiple hooks for same trigger (deterministic order)
- ✅ Recover from failed hook (continue chain)

## Performance Considerations

- **Action Timeout**: 30 seconds per action (configurable)
- **Execution Logs**: Max 100 in memory (FIFO pruning)
- **Sequential Execution**: Hooks execute one at a time (no parallel execution)
- **Queue Pattern**: Multiple simultaneous triggers queued and processed sequentially

**Expected Scale**: 
- 5-10 hook executions per trigger event
- 50 trigger events per session
- 100 execution logs retained
