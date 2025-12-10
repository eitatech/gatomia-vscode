# Component Contract: TriggerRegistry

**Feature**: Hooks Module  
**Component**: TriggerRegistry  
**Responsibility**: Event registration, emission, and subscription for hook triggers

## Purpose

TriggerRegistry provides a centralized event system for hook triggers. It allows components to emit trigger events when agent operations complete and enables HookExecutor to subscribe to these events.

## Interface

```typescript
export class TriggerRegistry {
    constructor(outputChannel: OutputChannel);

    // Lifecycle
    initialize(): void;
    dispose(): void;

    // Event Emission
    fireTrigger(agent: string, operation: string): void;
    fireTriggerWithContext(event: TriggerEvent): void;

    // Event Subscription
    readonly onTrigger: Event<TriggerEvent>;

    // Debugging
    getLastTrigger(): TriggerEvent | undefined;
    getTriggerHistory(limit?: number): TriggerEvent[];
    clearTriggerHistory(): void;
}

interface TriggerEvent {
    agent: string;              // 'speckit' | 'openspec'
    operation: string;          // 'specify' | 'clarify' | 'plan' | 'analyze' | 'checklist'
    timestamp: number;          // Unix timestamp (milliseconds)
    metadata?: Record<string, any>;  // Optional context data
}
```

## Responsibilities

### Fire Trigger

**Simple API** (most common):
```typescript
fireTrigger(agent: string, operation: string): void {
    const event: TriggerEvent = {
        agent,
        operation,
        timestamp: Date.now()
    };
    
    this.fireTriggerWithContext(event);
}
```

**Usage**:
```typescript
// After SpecKit specify completes
triggerRegistry.fireTrigger('speckit', 'specify');
```

**With Context API** (advanced):
```typescript
fireTriggerWithContext(event: TriggerEvent): void {
    // Validate event
    if (!this.isValidTrigger(event)) {
        this.outputChannel.appendLine(`Invalid trigger event: ${JSON.stringify(event)}`);
        return;
    }
    
    // Log trigger
    this.outputChannel.appendLine(
        `Trigger fired: ${event.agent}.${event.operation} at ${new Date(event.timestamp).toISOString()}`
    );
    
    // Store in history
    this.triggerHistory.push(event);
    if (this.triggerHistory.length > MAX_TRIGGER_HISTORY) {
        this.triggerHistory.shift();  // FIFO pruning
    }
    
    // Emit event
    this._onTrigger.fire(event);
}
```

**Usage**:
```typescript
// With additional metadata
triggerRegistry.fireTriggerWithContext({
    agent: 'speckit',
    operation: 'specify',
    timestamp: Date.now(),
    metadata: {
        featureName: 'hooks-module',
        specFile: '/path/to/spec.md'
    }
});
```

### Event Subscription

```typescript
private readonly _onTrigger = new EventEmitter<TriggerEvent>();
readonly onTrigger: Event<TriggerEvent> = this._onTrigger.event;
```

**Subscribers** (HookExecutor):
```typescript
triggerRegistry.onTrigger(async (event) => {
    await executor.executeHooksForTrigger(event.agent, event.operation);
});
```

### Trigger History

- Stores last N trigger events (default: 50)
- FIFO pruning when limit exceeded
- Used for debugging and testing
- Not persisted (in-memory only)

```typescript
getTriggerHistory(limit?: number): TriggerEvent[] {
    const history = [...this.triggerHistory];  // Copy
    if (limit) {
        return history.slice(-limit);  // Last N events
    }
    return history;
}
```

## Integration Points

### SpecKit/OpenSpec Command Handlers

**Instrumentation Pattern**:
```typescript
// In SpecManager or command handler
class SpecCommandHandler {
    constructor(
        private triggerRegistry: TriggerRegistry,
        // ... other dependencies
    ) {}
    
    async handleSpecifyCommand(args: string): Promise<void> {
        try {
            // Existing specify logic
            await this.createSpecification(args);
            
            // NEW: Fire trigger event after successful completion
            this.triggerRegistry.fireTrigger('speckit', 'specify');
        } catch (error) {
            // Don't fire trigger on failure
            throw error;
        }
    }
    
    async handleClarifyCommand(): Promise<void> {
        await this.runClarification();
        this.triggerRegistry.fireTrigger('speckit', 'clarify');
    }
    
    async handlePlanCommand(): Promise<void> {
        await this.generatePlan();
        this.triggerRegistry.fireTrigger('speckit', 'plan');
    }
    
    async handleAnalyzeCommand(): Promise<void> {
        await this.analyzeSpec();
        this.triggerRegistry.fireTrigger('speckit', 'analyze');
    }
    
    async handleChecklistCommand(): Promise<void> {
        await this.runChecklist();
        this.triggerRegistry.fireTrigger('speckit', 'checklist');
    }
}
```

**Required Changes**:
1. Pass TriggerRegistry to SpecManager constructor
2. Inject into command handlers
3. Call `fireTrigger()` after each operation completes
4. Only fire on success (not on errors/cancellations)

## Dependencies

- `vscode.EventEmitter` - event emission
- `vscode.OutputChannel` - logging

## Error Handling

| Error Scenario | Action |
|----------------|--------|
| Invalid trigger event | Log warning, skip emission |
| No subscribers | Continue normally (no-op) |
| Subscriber throws | Log error, continue with other subscribers |

## Validation

```typescript
private isValidTrigger(event: TriggerEvent): boolean {
    const validAgents = ['speckit', 'openspec'];
    const validOperations = ['specify', 'clarify', 'plan', 'analyze', 'checklist'];
    
    return (
        typeof event === 'object' &&
        typeof event.agent === 'string' &&
        validAgents.includes(event.agent) &&
        typeof event.operation === 'string' &&
        validOperations.includes(event.operation) &&
        typeof event.timestamp === 'number' &&
        event.timestamp > 0
    );
}
```

## Events

```typescript
// Emitted when a trigger event occurs
onTrigger: Event<TriggerEvent>
```

## Usage Example

```typescript
// Initialize
const triggerRegistry = new TriggerRegistry(outputChannel);
triggerRegistry.initialize();

// Subscribe (in HookExecutor)
triggerRegistry.onTrigger(async (event) => {
    outputChannel.appendLine(`Trigger: ${event.agent}.${event.operation}`);
    await executeHooksForTrigger(event.agent, event.operation);
});

// Emit trigger (in SpecManager command handlers)
async function handleSpecify(args: string): Promise<void> {
    await createSpecification(args);
    triggerRegistry.fireTrigger('speckit', 'specify');
}

// Get history for debugging
const lastTriggers = triggerRegistry.getTriggerHistory(10);
console.log('Last 10 triggers:', lastTriggers);
```

## Testing Requirements

### Unit Tests
- ✅ Fire trigger emits event
- ✅ Validate trigger event structure
- ✅ Reject invalid trigger events
- ✅ Store triggers in history (FIFO)
- ✅ Get trigger history
- ✅ Clear trigger history
- ✅ Multiple subscribers receive events
- ✅ Subscriber errors don't affect other subscribers

### Integration Tests
- ✅ SpecManager fires triggers after operations
- ✅ HookExecutor receives and processes triggers
- ✅ End-to-end: Command → Trigger → Hook Execution

## Performance Considerations

- **Event Emission**: Synchronous (subscribers run async)
- **History Size**: Max 50 events (FIFO pruning)
- **Memory Usage**: Minimal (~5KB for 50 events)

**Expected Scale**:
- 10-20 trigger events per session
- 1-3 active subscribers
- <1ms emission overhead

## Constants

```typescript
const MAX_TRIGGER_HISTORY = 50;  // Maximum events to store in history
```

## Singleton Pattern

TriggerRegistry should be a singleton shared across the extension:

```typescript
// In extension.ts
let triggerRegistry: TriggerRegistry;

export function activate(context: ExtensionContext) {
    triggerRegistry = new TriggerRegistry(outputChannel);
    triggerRegistry.initialize();
    
    // Pass to managers
    const hookManager = new HookManager(context, outputChannel);
    const hookExecutor = new HookExecutor(hookManager, triggerRegistry, outputChannel);
    const specManager = new SpecManager(context, triggerRegistry, outputChannel);
    
    // ...
}

export function getTriggerRegistry(): TriggerRegistry {
    return triggerRegistry;
}
```

## Future Enhancements

- **Trigger Filtering**: Subscribe to specific agent/operation combinations
- **Trigger Delays**: Configurable delay before firing trigger
- **Conditional Triggers**: Fire only if certain conditions met
- **Trigger Metrics**: Track trigger frequency, subscriber count
