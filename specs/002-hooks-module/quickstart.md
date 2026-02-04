# Developer Quickstart: Hooks Module

**Feature**: Hooks Module  
**Branch**: `001-hooks-module`  
**Date**: 2025-12-03

## Overview

This quickstart guide helps developers understand and contribute to the Hooks Module implementation. Read this first before diving into the codebase.

## What Is This Feature?

The Hooks Module enables users to automate SDD workflow sequences by configuring triggers that execute actions when specific agent operations complete. For example, automatically running `/speckit.clarify` after `/speckit.specify` completes.

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                        │
│                                                             │
│  ┌───────────────────┐      ┌───────────────────┐           │
│  │  TriggerRegistry  │──────│   HookExecutor    │           │
│  │                   │      │                   │           │
│  │ - Event emitter   │      │ - Execute actions │           │
│  │ - Fire triggers   │      │ - Prevent cycles  │           │
│  └─────────┬─────────┘      └─────────┬─────────┘           │
│            │                          │                     │
│            │                          │                     │
│  ┌─────────▼─────────┐      ┌─────────▼────────┐            │
│  │   SpecManager     │      │    HookManager   │            │
│  │                   │      │                  │            │
│  │ - Fire triggers   │      │ - CRUD ops       │            │
│  │   after ops       │      │ - Persistence    │            │
│  └───────────────────┘      └────────┬─────────┘            │
│                                      │                      │
│                                      │                      │
│  ┌───────────────────────────────────▼─────────┐            │
│  │         HookViewProvider                    │            │
│  │                                             │            │
│  │ - Message routing                           │            │
│  │ - State sync                                │            │
│  └────────────────┬────────────────────────────┘            │
│                   │                                         │
└───────────────────┼─────────────────────────────────────────┘
                    │ Message Passing
┌───────────────────▼─────────────────────────────────────────┐
│                     Webview UI (React)                      │
│                                                             │
│  ┌──────────────┐   ┌─────────────┐   ┌────────────────┐    │
│  │  HooksList   │   │  HookForm   │   │ HookListItem   │    │
│  │              │   │             │   │                │    │
│  │ - Display    │   │ - Create    │   │ - Edit/Delete  │    │
│  │   hooks      │   │ - Edit form │   │ - Toggle       │    │
│  └──────────────┘   └─────────────┘   └────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### Extension Side (TypeScript + Node.js)

1. **TriggerRegistry** (`src/features/hooks/TriggerRegistry.ts`)
   - **What**: Event bus for hook triggers
   - **Why**: Decouples trigger sources from hook execution
   - **Key Methods**: `fireTrigger()`, `onTrigger()`

2. **HookManager** (`src/features/hooks/HookManager.ts`)
   - **What**: CRUD operations for hooks
   - **Why**: Single source of truth for hook data
   - **Key Methods**: `createHook()`, `updateHook()`, `deleteHook()`, `getAllHooks()`

3. **HookExecutor** (`src/features/hooks/HookExecutor.ts`)
   - **What**: Executes hook actions when triggered
   - **Why**: Handles execution logic, circular dependency prevention
   - **Key Methods**: `executeHook()`, `executeHooksForTrigger()`

4. **HookViewProvider** (`src/providers/HookViewProvider.ts`)
   - **What**: Manages webview, routes messages
   - **Why**: Bridge between extension and React UI
   - **Key Methods**: `resolveWebviewView()`, `handleWebviewMessage()`

### Webview Side (React + TypeScript)

5. **HooksView** (`ui/src/features/hooks-view/index.tsx`)
   - **What**: Main hooks configuration UI
   - **Why**: User-facing interface for hook management
   - **Components**: `HooksList`, `HookForm`, `HookListItem`

## Data Flow

### Creating a Hook

```
User clicks "Add Hook" in webview
    ↓
HooksView sends message { command: 'hooks.create', data: {...} }
    ↓
HookViewProvider.handleWebviewMessage()
    ↓
HookManager.createHook()
    - Validate hook data
    - Generate UUID
    - Save to workspace state
    ↓
HookManager emits onHookCreated event
    ↓
HookViewProvider syncs hooks to webview
    ↓
HooksView updates UI
```

### Executing a Hook

```
User completes /speckit.specify command
    ↓
SpecManager.handleSpecify() completes
    ↓
SpecManager calls triggerRegistry.fireTrigger('speckit', 'specify')
    ↓
TriggerRegistry emits onTrigger event
    ↓
HookExecutor receives trigger event
    ↓
HookExecutor.executeHooksForTrigger('speckit', 'specify')
    - Get all enabled hooks for this trigger
    - Sort by creation order
    - Execute each sequentially
    ↓
HookExecutor.executeHook()
    - Check circular dependency
    - Check max depth
    - Build template context
    - Execute action (agent/git/github/custom)
    - Log result
    ↓
HookExecutor emits execution status events
    ↓
HookViewProvider forwards status to webview
    ↓
HooksView shows execution indicator
```

## File Structure

```
src/
├── features/
│   └── hooks/
│       ├── HookManager.ts           # CRUD operations
│       ├── HookExecutor.ts          # Execution engine
│       ├── TriggerRegistry.ts       # Event system
│       ├── actions/
│       │   ├── AgentAction.ts       # Execute agent commands
│       │   ├── GitAction.ts         # Execute git operations
│       │   ├── GitHubAction.ts      # Execute GitHub operations
│       │   └── CustomAction.ts      # Execute custom agents
│       └── types.ts                 # Type definitions
├── providers/
│   └── HookViewProvider.ts          # Webview provider
└── services/
    └── HookService.ts               # Extension-level coordination

ui/src/features/
└── hooks-view/
    ├── index.tsx                    # Main view
    ├── types.ts                     # UI types
    └── components/
        ├── HooksList.tsx            # List all hooks
        ├── hook-form.tsx            # Create/edit form
        ├── HookListItem.tsx         # Individual hook row
        └── trigger-action-selector.tsx # Dropdowns

tests/
├── unit/
│   ├── features/
│   │   └── hooks/
│   │       ├── HookManager.test.ts
│   │       ├── HookExecutor.test.ts
│   │       └── TriggerRegistry.test.ts
│   └── webview/
│       └── hooks-view/
│           ├── HooksList.test.tsx
│           └── hook-form.test.tsx
└── integration/
    └── hooks-workflow.test.ts       # End-to-end tests
```

## Getting Started

### Prerequisites

1. **Clone the repository**:

```bash
git clone <repo-url>
cd copilot-spec-ui
```

2. **Install dependencies**:
```bash
npm run install:all
```

3. **Checkout feature branch**:
```bash
git checkout 001-hooks-module
```

### Development Workflow

#### Extension Development

1. **Open project in VS Code**

2. **Build the extension**:
```bash
npm run build:ext
```

3. **Watch mode** (auto-rebuild on changes):
```bash
npm run watch
```

4. **Launch Extension Development Host**:
   - Press `F5` or select "Run > Start Debugging"
   - New VS Code window opens with extension loaded

5. **View debug output**:
   - Open "Output" panel
   - Select "GatomIA - Debug" from dropdown

#### Webview Development

1. **Build webview**:
```bash
npm run build:webview
```

2. **Dev server** (hot reload):
```bash
npm --prefix ui run dev
```

3. **View in browser** (isolated development):
   - Open `http://localhost:5173`
   - Edit components in `ui/src/features/hooks-view/`
   - See changes live

### Testing

#### Run All Tests

```bash
npm test
```

#### Run Specific Test File

```bash
npm test -- HookManager.test.ts
```

#### Watch Mode

```bash
npm run test:watch
```

#### Coverage Report

```bash
npm run test:coverage
```

### Linting and Formatting

```bash
# Check lint and format
npm run check

# Auto-fix issues
npm run format
npm run lint
```

## Common Tasks

### Add a New Hook Action Type

1. **Create action class** in `src/features/hooks/actions/`:
```typescript
// MyAction.ts
export class MyAction implements HookAction {
    type = 'my-action' as const;
    
    constructor(private params: MyActionParams) {}
    
    async execute(context: ActionExecutionContext): Promise<void> {
        // Implementation
    }
}
```

2. **Update types** in `src/features/hooks/types.ts`:
```typescript
type ActionType = 'agent' | 'git' | 'github' | 'custom' | 'my-action';

interface MyActionParams {
    // Parameters
}
```

3. **Update executor** in `HookExecutor.ts`:
```typescript
async executeHook(hook: Hook, context?: ExecutionContext): Promise<ExecutionResult> {
    // ...
    switch (hook.action.type) {
        case 'my-action':
            await this.executeMyAction(hook.action.parameters);
            break;
        // ...
    }
}
```

4. **Update webview** form in `hook-form.tsx`:
   - Add action type option to dropdown
   - Add parameter fields for this action type
   - Add validation

### Add a New Trigger Point

1. **Identify trigger location** (e.g., new SpecKit command)

2. **Fire trigger** after operation completes:
```typescript
// In SpecManager or command handler
async handleMyOperation(): Promise<void> {
    await performOperation();
    this.triggerRegistry.fireTrigger('speckit', 'my-operation');
}
```

3. **Update types**:
```typescript
type OperationType = 
    | 'specify'
    | 'clarify'
    | 'plan'
    | 'analyze'
    | 'checklist'
    | 'my-operation';  // NEW
```

4. **Update webview** form with new trigger option

### Debug a Hook Execution Issue

1. **Enable debug logging**:
```typescript
// In HookExecutor
this.outputChannel.appendLine(`Executing hook: ${hook.name}`);
this.outputChannel.appendLine(`Context: ${JSON.stringify(context)}`);
```

2. **Check execution logs**:
```typescript
const logs = hookExecutor.getExecutionLogsForHook(hookId);
console.log('Execution history:', logs);
```

3. **View trigger history**:
```typescript
const triggers = triggerRegistry.getTriggerHistory();
console.log('Recent triggers:', triggers);
```

4. **Check Output panel**:
   - Open "GatomIA - Debug" output channel
   - Review trigger and execution logs

## Configuration

### Storage Location

Hooks are stored in VSCode workspace state:
- **Key**: `gatomiamia.hooks.configurations`
- **Location**: `.vscode/.state/...` (managed by VSCode)
- **Format**: JSON array of Hook objects

### Constants

Defined in `src/features/hooks/types.ts`:
- `MAX_CHAIN_DEPTH = 10` - Maximum hook chain depth
- `MAX_EXECUTION_LOGS = 100` - Maximum logs retained
- `ACTION_TIMEOUT_MS = 30000` - Action timeout (30 seconds)

## Troubleshooting

### Extension doesn't load hooks

**Check**:
1. Workspace folder is open (hooks are workspace-scoped)
2. `HookManager.initialize()` was called
3. Check Output panel for errors

### Trigger not firing

**Check**:
1. `TriggerRegistry` injected into manager
2. `fireTrigger()` called after operation completes
3. Check trigger history: `triggerRegistry.getTriggerHistory()`

### Hook not executing

**Check**:
1. Hook is enabled
2. Trigger condition matches fired event
3. No circular dependency detected
4. Check execution logs: `hookExecutor.getExecutionLogs()`

### Webview not updating

**Check**:
1. Message handler registered
2. `syncHooksToWebview()` called after changes
3. Browser console for React errors (if using dev server)

## Resources

- **Specification**: [`spec.md`](../spec.md)
- **Research**: [`research.md`](../research.md)
- **Data Model**: [`data-model.md`](../data-model.md)
- **Contracts**: [`contracts/`](../contracts/)
- **VS Code API**: https://code.visualstudio.com/api
- **React Docs**: https://react.dev

## Next Steps

1. Read [`data-model.md`](../data-model.md) for entity schemas
2. Review [`contracts/`](../contracts/) for component interfaces
3. Start with `HookManager` implementation (simplest component)
4. Add tests as you implement
5. Build webview UI after backend is functional

## Questions?

- Check specification docs in this directory
- Review existing feature code (`src/features/spec/`, `src/features/steering/`)
- Look at existing webview patterns (`ui/src/features/create-steering-view/`)
