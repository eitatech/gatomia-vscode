# Component Contract: HookManager

**Feature**: Hooks Module  
**Component**: HookManager  
**Responsibility**: CRUD operations for hooks, persistence, validation

## Purpose

HookManager is responsible for managing the lifecycle of hook configurations, including creation, retrieval, updates, deletion, and persistence to VSCode workspace state.

## Interface

```typescript
export class HookManager {
    constructor(
        context: ExtensionContext,
        outputChannel: OutputChannel
    );

    // Lifecycle
    async initialize(): Promise<void>;
    async dispose(): Promise<void>;

    // CRUD Operations
    async createHook(hook: Omit<Hook, 'id' | 'createdAt' | 'modifiedAt' | 'executionCount'>): Promise<Hook>;
    async getHook(id: string): Promise<Hook | undefined>;
    async getAllHooks(): Promise<Hook[]>;
    async updateHook(id: string, updates: Partial<Hook>): Promise<Hook>;
    async deleteHook(id: string): Promise<boolean>;

    // Bulk Operations
    async getEnabledHooks(): Promise<Hook[]>;
    async getHooksByTrigger(agent: string, operation: string): Promise<Hook[]>;
    async disableAllHooks(): Promise<void>;
    async enableAllHooks(): Promise<void>;

    // Persistence
    async saveHooks(): Promise<void>;
    async loadHooks(): Promise<void>;
    async exportHooks(): Promise<string>;  // JSON export
    async importHooks(json: string): Promise<number>;  // Returns count imported

    // Validation
    validateHook(hook: Hook): ValidationResult;
    async isHookNameUnique(name: string, excludeId?: string): Promise<boolean>;

    // Events
    readonly onHookCreated: Event<Hook>;
    readonly onHookUpdated: Event<Hook>;
    readonly onHookDeleted: Event<string>;  // Hook ID
    readonly onHooksChanged: Event<void>;
}

interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

interface ValidationError {
    field: string;
    message: string;
}
```

## Responsibilities

### Create Hook
- Generate unique UUID for new hook
- Validate all fields against data model rules
- Check name uniqueness
- Set timestamps (createdAt, modifiedAt)
- Initialize executionCount to 0
- Add to in-memory collection
- Persist to workspace state
- Emit `onHookCreated` event
- Return created hook

**Validations**:
- Name: non-empty, ≤100 chars, unique
- Trigger: valid agent, operation, timing
- Action: valid type, parameters for type

### Get Hook(s)
- Retrieve single hook by ID
- Retrieve all hooks
- Retrieve only enabled hooks
- Retrieve hooks matching trigger criteria
- Return undefined if not found (single)
- Return empty array if none found (collection)

### Update Hook
- Validate ID exists
- Validate updated fields
- Check name uniqueness if name changed
- Update modifiedAt timestamp
- Merge updates with existing hook
- Persist changes
- Emit `onHookUpdated` event
- Return updated hook

**Rules**:
- Cannot update: id, createdAt, executionCount
- Can update: name, enabled, trigger, action, modifiedAt

### Delete Hook
- Validate ID exists
- Remove from in-memory collection
- Persist changes
- Emit `onHookDeleted` event with ID
- Return true if deleted, false if not found

**Note**: Execution logs are not cascade-deleted (orphaned logs pruned by FIFO)

### Persistence
- **Save**: Serialize hooks array to JSON, store in workspace state
- **Load**: Retrieve from workspace state, deserialize, validate
- **Export**: Convert hooks to formatted JSON string
- **Import**: Parse JSON, validate all hooks, merge with existing (skip duplicates by name)

**Storage Key**: `gatomia.hooks.configurations`

### Validation

**Hook Validation**:
1. ID is valid UUID v4
2. Name: 1-100 chars, unique
3. Trigger: valid agent/operation/timing combination
4. Action: valid type with correct parameters for that type
5. Timestamps: positive numbers
6. executionCount: non-negative number

**Action Parameter Validation**:
- **Agent**: command starts with `/speckit.` or `/openspec.`, ≤200 chars
- **Git**: operation is 'commit' or 'push', messageTemplate ≤500 chars
- **GitHub**: valid operation, repository format, template lengths
- **Custom**: agentName ≤50 chars alphanumeric+hyphens

## Dependencies

- `vscode.ExtensionContext` - for workspace state access
- `vscode.OutputChannel` - for debug logging
- `vscode.EventEmitter` - for event emission
- `uuid` library - for generating hook IDs

## Error Handling

| Error Scenario | Action |
|----------------|--------|
| Invalid hook data | Throw `HookValidationError` with details |
| Duplicate name | Throw `DuplicateHookNameError` |
| Hook not found | Return undefined (get) or false (delete) |
| Persistence failure | Log error, emit notification, throw `PersistenceError` |
| Invalid import JSON | Throw `ImportError` with parsing details |

## Events

```typescript
// Emitted when a new hook is created
onHookCreated: Event<Hook>

// Emitted when a hook is updated
onHookUpdated: Event<Hook>

// Emitted when a hook is deleted (passes hook ID)
onHookDeleted: Event<string>

// Emitted on any hook collection change (create/update/delete)
onHooksChanged: Event<void>
```

## Usage Example

```typescript
// Initialize
const hookManager = new HookManager(context, outputChannel);
await hookManager.initialize();

// Create hook
const newHook = await hookManager.createHook({
    name: 'Auto-clarify after specify',
    enabled: true,
    trigger: {
        agent: 'speckit',
        operation: 'specify',
        timing: 'after'
    },
    action: {
        type: 'agent',
        parameters: {
            command: '/speckit.clarify'
        }
    }
});

// Listen to changes
hookManager.onHookCreated((hook) => {
    outputChannel.appendLine(`Hook created: ${hook.name}`);
});

// Get hooks for specific trigger
const hooks = await hookManager.getHooksByTrigger('speckit', 'specify');

// Update hook
await hookManager.updateHook(newHook.id, { enabled: false });

// Delete hook
await hookManager.deleteHook(newHook.id);
```

## Testing Requirements

### Unit Tests
- ✅ Create hook with valid data
- ✅ Create hook with invalid data (validation errors)
- ✅ Create hook with duplicate name (error)
- ✅ Get hook by ID (found/not found)
- ✅ Get all hooks
- ✅ Get enabled hooks only
- ✅ Get hooks by trigger
- ✅ Update hook (valid/invalid fields)
- ✅ Update hook name (uniqueness check)
- ✅ Delete hook (found/not found)
- ✅ Validate hook (all validation rules)
- ✅ Persist and load hooks
- ✅ Export hooks to JSON
- ✅ Import hooks from JSON
- ✅ Events emitted correctly

### Integration Tests
- ✅ Create → Persist → Reload → Verify
- ✅ Update → Persist → Reload → Verify
- ✅ Delete → Persist → Reload → Verify
- ✅ Export → Import → Verify equality

## Performance Considerations

- In-memory collection for fast access (no DB queries)
- Batch persistence (don't save after every operation)
- Lazy loading (load hooks only when needed)
- Debounced saves (coalesce multiple rapid changes)

**Expected Scale**: 50 hooks per workspace
**Expected Operations**: 10-20 CRUD ops per session
