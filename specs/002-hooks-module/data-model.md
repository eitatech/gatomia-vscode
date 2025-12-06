# Data Model: Hooks Module

**Feature**: Hooks Module  
**Branch**: `001-hooks-module`  
**Date**: 2025-12-03  
**Phase**: 1 - Design

## Overview

This document defines the complete data model for the Hooks Module, including entity schemas, relationships, validation rules, and persistence strategies.

## Core Entities

### Hook

Represents a configured automation rule that triggers actions based on agent operation events.

```typescript
interface Hook {
    // Identity
    id: string;                      // UUID v4 format
    name: string;                    // User-friendly name (max 100 chars)
    
    // Configuration
    enabled: boolean;                // Active state (default: true)
    trigger: TriggerCondition;       // When to execute
    action: ActionConfig;            // What to execute
    
    // Metadata
    createdAt: number;              // Unix timestamp (milliseconds)
    modifiedAt: number;             // Unix timestamp (milliseconds)
    lastExecutedAt?: number;        // Unix timestamp (milliseconds)
    executionCount: number;         // Total executions (default: 0)
}
```

**Validation Rules**:
- `id`: Must be valid UUID v4
- `name`: Non-empty, max 100 characters, unique within workspace
- `trigger.operation`: Must be one of: `specify`, `clarify`, `plan`, `analyze`, `checklist`
- `action.type`: Must be one of: `agent`, `git`, `github`, `custom`

**Example**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Auto-clarify after specify",
  "enabled": true,
  "trigger": {
    "agent": "speckit",
    "operation": "specify",
    "timing": "after"
  },
  "action": {
    "type": "agent",
    "parameters": {
      "command": "/speckit.clarify"
    }
  },
  "createdAt": 1701608527000,
  "modifiedAt": 1701608527000,
  "executionCount": 0
}
```

### TriggerCondition

Defines the event that activates a hook.

```typescript
interface TriggerCondition {
    agent: AgentType;               // Which agent system
    operation: OperationType;       // Which operation
    timing: TriggerTiming;          // When to trigger
}

type AgentType = 'speckit' | 'openspec';

type OperationType = 
    | 'specify'      // After specification created
    | 'clarify'      // After clarification completed
    | 'plan'         // After plan generated
    | 'analyze'      // After analysis completed
    | 'checklist';   // After checklist validated

type TriggerTiming = 'after';  // MVP: only 'after' supported
                                // Future: 'before', 'on-failure'
```

**Business Rules**:
- All triggers in MVP fire "after" operation completion
- Trigger must reference valid agent/operation combinations
- Each trigger uniquely identifies an event type

### ActionConfig

Defines the operation to execute when triggered.

```typescript
interface ActionConfig {
    type: ActionType;
    parameters: ActionParameters;
}

type ActionType = 
    | 'agent'      // Execute SpecKit/OpenSpec command
    | 'git'        // Git commit/push operation
    | 'github'     // GitHub via MCP Server
    | 'custom';    // Custom agent invocation

type ActionParameters = 
    | AgentActionParams
    | GitActionParams
    | GitHubActionParams
    | CustomActionParams;
```

**Type-Specific Parameters**:

#### AgentActionParams

```typescript
interface AgentActionParams {
    command: string;               // Full agent command
                                   // Examples: '/speckit.clarify', '/openspec.analyze'
}
```

**Validation**:
- `command`: Must start with `/speckit.` or `/openspec.`
- `command`: Max 200 characters

**Example**:
```json
{
  "type": "agent",
  "parameters": {
    "command": "/speckit.clarify"
  }
}
```

#### GitActionParams

```typescript
interface GitActionParams {
    operation: GitOperation;
    messageTemplate: string;       // Supports template variables
    pushToRemote?: boolean;        // Auto-push after commit (default: false)
}

type GitOperation = 'commit' | 'push';
```

**Template Variables** (available in `messageTemplate`):
- `{feature}`: Current feature name (from spec branch)
- `{branch}`: Current Git branch name
- `{timestamp}`: ISO 8601 timestamp
- `{user}`: Git user name

**Validation**:
- `messageTemplate`: Max 500 characters
- `messageTemplate`: Must not be empty after template expansion

**Example**:
```json
{
  "type": "git",
  "parameters": {
    "operation": "commit",
    "messageTemplate": "feat({feature}): automated spec update at {timestamp}",
    "pushToRemote": false
  }
}
```

#### GitHubActionParams

```typescript
interface GitHubActionParams {
    operation: GitHubOperation;
    repository?: string;           // Format: 'owner/repo' (optional, defaults to current)
    titleTemplate?: string;        // For issue/PR creation
    bodyTemplate?: string;         // For issue/PR creation
    issueNumber?: number;          // For close/update operations
}

type GitHubOperation = 
    | 'open-issue'
    | 'close-issue'
    | 'create-pr'
    | 'add-comment';
```

**Template Variables** (same as Git actions):
- `{feature}`, `{branch}`, `{timestamp}`, `{user}`

**Validation**:
- `repository`: Must match format `owner/repo` if provided
- `titleTemplate`: Required for `open-issue`, `create-pr` (max 200 chars)
- `bodyTemplate`: Optional (max 5000 chars)
- `issueNumber`: Required for `close-issue`, `add-comment`

**Example**:
```json
{
  "type": "github",
  "parameters": {
    "operation": "open-issue",
    "repository": "myorg/myrepo",
    "titleTemplate": "Spec created for {feature}",
    "bodyTemplate": "Specification branch `{branch}` created at {timestamp} by {user}."
  }
}
```

#### CustomActionParams

```typescript
interface CustomActionParams {
    agentName: string;            // Custom agent identifier
    arguments?: string;           // Arguments to pass to agent
}
```

**Validation**:
- `agentName`: Max 50 characters, alphanumeric + hyphens
- `arguments`: Max 1000 characters

**Example**:
```json
{
  "type": "custom",
  "parameters": {
    "agentName": "my-custom-agent",
    "arguments": "--mode=auto --feature={feature}"
  }
}
```

## Supporting Entities

### HookExecutionLog

Records hook execution history for debugging and analytics.

```typescript
interface HookExecutionLog {
    // Identity
    id: string;                    // UUID for this log entry
    hookId: string;                // Reference to executed hook
    
    // Execution context
    executionId: string;           // UUID for this execution chain
    chainDepth: number;            // Position in hook chain (0-based)
    
    // Timing
    triggeredAt: number;           // Unix timestamp (milliseconds)
    completedAt?: number;          // Unix timestamp (milliseconds)
    duration?: number;             // Milliseconds (completedAt - triggeredAt)
    
    // Result
    status: ExecutionStatus;
    error?: ExecutionError;
    
    // Context snapshot
    contextSnapshot: TemplateContext;
}

type ExecutionStatus = 
    | 'success'    // Action completed successfully
    | 'failure'    // Action failed with error
    | 'skipped'    // Hook was disabled or filtered
    | 'timeout';   // Action exceeded timeout

interface ExecutionError {
    code: string;                  // Error code (e.g., 'GIT_COMMIT_FAILED')
    message: string;               // Human-readable error message
    stack?: string;                // Stack trace (for debugging)
}
```

**Storage Strategy**:
- Logs stored in-memory during session (not persisted to disk in MVP)
- Maximum 100 most recent logs retained per workspace
- Older logs auto-pruned on a FIFO basis

**Example**:
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "hookId": "550e8400-e29b-41d4-a716-446655440000",
  "executionId": "770e8400-e29b-41d4-a716-446655440002",
  "chainDepth": 0,
  "triggeredAt": 1701608530000,
  "completedAt": 1701608532500,
  "duration": 2500,
  "status": "success",
  "contextSnapshot": {
    "feature": "hooks-module",
    "branch": "001-hooks-module",
    "timestamp": "2025-12-03T12:02:10.000Z",
    "user": "johndoe"
  }
}
```

### ExecutionContext

Tracks hook execution chains to prevent circular dependencies.

```typescript
interface ExecutionContext {
    executionId: string;           // UUID for entire execution chain
    chainDepth: number;            // Current depth (0 = root trigger)
    executedHooks: Set<string>;    // Hook IDs already executed in this chain
    startedAt: number;             // Unix timestamp when chain started
}
```

**Business Rules**:
- `chainDepth` must not exceed `MAX_CHAIN_DEPTH` (10)
- `executedHooks` set prevents same hook from executing twice in one chain
- New `ExecutionContext` created for each root trigger event

### TemplateContext

Provides dynamic values for template variable expansion.

```typescript
interface TemplateContext {
    feature?: string;              // Current feature name (e.g., 'hooks-module')
    branch?: string;               // Current git branch (e.g., '001-hooks-module')
    timestamp?: string;            // ISO 8601 format (e.g., '2025-12-03T12:02:10.540Z')
    user?: string;                 // Git user name from config
}
```

**Population Strategy**:
- `feature`: Extracted from branch name (pattern: `NNN-feature-name`)
- `branch`: From `git rev-parse --abbrev-ref HEAD`
- `timestamp`: Generated at execution time via `new Date().toISOString()`
- `user`: From `git config user.name`

## Persistence

### Storage Location

**Workspace State** (VSCode Extension API):
```typescript
// Storage key
const HOOKS_STORAGE_KEY = 'gatomia.hooks.configurations';

// Store hooks array
await context.workspaceState.update(HOOKS_STORAGE_KEY, hooks);

// Retrieve hooks array
const hooks = context.workspaceState.get<Hook[]>(HOOKS_STORAGE_KEY, []);
```

**Rationale**:
- Workspace-scoped: Hooks are project-specific
- Automatic serialization: VSCode handles JSON serialization
- Survives extension restarts: Persisted to disk by VSCode
- No external dependencies: No database required

### Migration Strategy

**Version 1 (MVP)**: Flat array of Hook objects

**Future Versions**: If schema changes, implement migration:
```typescript
interface StorageMetadata {
    version: number;               // Schema version
    migratedAt?: number;          // Last migration timestamp
}

interface HooksStorage {
    metadata: StorageMetadata;
    hooks: Hook[];
}

async function migrateHooks(oldData: any): Promise<HooksStorage> {
    // Handle schema migrations
}
```

## Relationships

```
┌─────────────┐
│    Hook     │
│             │
│ - id        │──────┐
│ - name      │      │
│ - enabled   │      │
│ - trigger   │      │ 1:N
│ - action    │      │
└─────────────┘      │
                     │
                     ▼
              ┌──────────────────┐
              │ HookExecutionLog │
              │                  │
              │ - hookId (FK)    │
              │ - executionId    │
              │ - status         │
              │ - duration       │
              └──────────────────┘
```

**Relationship Rules**:
- One Hook → Many ExecutionLogs (1:N)
- ExecutionLogs reference Hook by `hookId`
- Logs are not cascade-deleted when Hook is deleted (orphaned logs eventually pruned by FIFO)

## Validation Rules Summary

### Hook Entity
| Field | Rule | Error Message |
|-------|------|---------------|
| id | UUID v4 format | "Invalid hook ID format" |
| name | Non-empty, ≤100 chars | "Hook name must be 1-100 characters" |
| name | Unique in workspace | "Hook name already exists" |
| trigger.agent | Must be 'speckit' or 'openspec' | "Invalid agent type" |
| trigger.operation | Must be valid operation | "Invalid operation type" |
| action.type | Must be valid type | "Invalid action type" |

### Action Parameters

**Agent Actions**:
| Field | Rule | Error Message |
|-------|------|---------------|
| command | Starts with /speckit. or /openspec. | "Command must start with agent prefix" |
| command | ≤200 chars | "Command too long (max 200 characters)" |

**Git Actions**:
| Field | Rule | Error Message |
|-------|------|---------------|
| messageTemplate | Non-empty after expansion | "Commit message template is empty" |
| messageTemplate | ≤500 chars | "Message template too long (max 500 characters)" |

**GitHub Actions**:
| Field | Rule | Error Message |
|-------|------|---------------|
| repository | Format: owner/repo | "Invalid repository format (use owner/repo)" |
| titleTemplate | Required for open-issue, create-pr | "Title required for this operation" |
| titleTemplate | ≤200 chars | "Title too long (max 200 characters)" |
| bodyTemplate | ≤5000 chars | "Body too long (max 5000 characters)" |
| issueNumber | Required for close-issue, add-comment | "Issue number required for this operation" |

## Constants

```typescript
// Limits
export const MAX_HOOK_NAME_LENGTH = 100;
export const MAX_COMMAND_LENGTH = 200;
export const MAX_MESSAGE_TEMPLATE_LENGTH = 500;
export const MAX_TITLE_TEMPLATE_LENGTH = 200;
export const MAX_BODY_TEMPLATE_LENGTH = 5000;
export const MAX_AGENT_NAME_LENGTH = 50;
export const MAX_ARGUMENTS_LENGTH = 1000;

// Execution
export const MAX_CHAIN_DEPTH = 10;
export const MAX_EXECUTION_LOGS = 100;
export const ACTION_TIMEOUT_MS = 30000;  // 30 seconds

// Storage
export const HOOKS_STORAGE_KEY = 'gatomia.hooks.configurations';
export const LOGS_STORAGE_KEY = 'gatomia.hooks.execution-logs';  // Future: persistent logs
```

## Type Guards

```typescript
// Validate hook structure
function isValidHook(obj: any): obj is Hook {
    return (
        typeof obj === 'object' &&
        typeof obj.id === 'string' &&
        isValidUUID(obj.id) &&
        typeof obj.name === 'string' &&
        obj.name.length > 0 &&
        obj.name.length <= MAX_HOOK_NAME_LENGTH &&
        typeof obj.enabled === 'boolean' &&
        isValidTrigger(obj.trigger) &&
        isValidAction(obj.action) &&
        typeof obj.createdAt === 'number' &&
        typeof obj.modifiedAt === 'number'
    );
}

// Validate trigger condition
function isValidTrigger(obj: any): obj is TriggerCondition {
    return (
        typeof obj === 'object' &&
        (obj.agent === 'speckit' || obj.agent === 'openspec') &&
        ['specify', 'clarify', 'plan', 'analyze', 'checklist'].includes(obj.operation) &&
        obj.timing === 'after'
    );
}

// Validate action config
function isValidAction(obj: any): obj is ActionConfig {
    if (typeof obj !== 'object' || !obj.type) return false;
    
    switch (obj.type) {
        case 'agent':
            return isValidAgentParams(obj.parameters);
        case 'git':
            return isValidGitParams(obj.parameters);
        case 'github':
            return isValidGitHubParams(obj.parameters);
        case 'custom':
            return isValidCustomParams(obj.parameters);
        default:
            return false;
    }
}
```

## Usage Examples

### Creating a Hook

```typescript
import { v4 as uuidv4 } from 'uuid';

const newHook: Hook = {
    id: uuidv4(),
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
    },
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    executionCount: 0
};
```

### Template Expansion

```typescript
function expandTemplate(template: string, context: TemplateContext): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        const value = context[key as keyof TemplateContext];
        return value !== undefined ? value : match;
    });
}

// Example
const context: TemplateContext = {
    feature: 'hooks-module',
    branch: '001-hooks-module',
    timestamp: '2025-12-03T12:02:10.540Z',
    user: 'johndoe'
};

const message = expandTemplate(
    'feat({feature}): automated commit by {user} at {timestamp}',
    context
);
// Result: "feat(hooks-module): automated commit by johndoe at 2025-12-03T12:02:10.540Z"
```

## Next Steps

After completing data model design, proceed to:
1. Create component contracts (`contracts/*.md`)
2. Create developer quickstart guide (`quickstart.md`)
3. Begin implementation task breakdown (`/speckit.tasks`)
