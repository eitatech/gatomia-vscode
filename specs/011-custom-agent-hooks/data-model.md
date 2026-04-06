# Data Model: Custom Agent Hooks

**Feature**: Custom Agent Hooks Refactoring  
**Created**: 2026-01-26  
**Status**: Draft  

This document defines all data structures, entities, and their relationships for the Custom Agent Hooks feature.

---

## Table of Contents

1. [Core Entities](#core-entities)
2. [Supporting Entities](#supporting-entities)
3. [Enumerations](#enumerations)
4. [State Machines](#state-machines)
5. [Relationships](#relationships)
6. [Storage Format](#storage-format)
7. [Validation Rules](#validation-rules)

---

## Core Entities

### AgentRegistryEntry

Represents a single agent available for hook selection, discovered from either local `.agent.md` files or registered VS Code extensions.

```typescript
interface AgentRegistryEntry {
  // Identity (unique composite key)
  id: string; // Format: "{source}:{name}" (e.g., "local:code-reviewer", "extension:copilot")
  
  // Display Information
  name: string; // Base agent name (e.g., "Code Reviewer")
  displayName: string; // Name with source indicator if duplicate (e.g., "Code Reviewer (Local)")
  description?: string; // Short description of agent purpose
  
  // Classification
  type: AgentTypeEnum; // "local" | "background"
  source: AgentSourceEnum; // "file" | "extension"
  
  // Source-Specific Data
  sourcePath?: string; // Absolute file path (for source="file")
  extensionId?: string; // VS Code extension identifier (for source="extension")
  
  // Agent Configuration Schema (from .agent.md frontmatter)
  schema?: AgentConfigSchema;
  
  // Metadata
  discoveredAt: number; // Unix timestamp (milliseconds)
  lastValidated?: number; // Unix timestamp (milliseconds)
  available: boolean; // Runtime availability status
}
```

**Uniqueness Constraint**: `id` must be globally unique across all sources.

**Indexing**: Index by `name` for duplicate detection, by `type` for filtering.

---

### AgentConfigSchema

Represents the parsed schema from an `.agent.md` file's YAML frontmatter.

```typescript
interface AgentConfigSchema {
  // From YAML frontmatter
  id: string; // Agent identifier (lowercase-with-hyphens)
  name: string; // Short name
  fullName: string; // Full display name
  description: string; // Purpose and capabilities
  icon?: string; // Icon identifier (optional)
  
  // Commands supported by agent
  commands: AgentCommand[];
  
  // Resources available to agent
  resources: AgentResources;
  
  // Raw markdown content (below frontmatter)
  content: string;
}

interface AgentCommand {
  name: string; // Command name (e.g., "review", "help")
  description: string; // What the command does
  tool: string; // Tool identifier (e.g., "agent.review")
  parameters?: Record<string, unknown>[]; // Optional parameter definitions
}

interface AgentResources {
  prompts?: string[]; // Available prompt templates
  skills?: string[]; // Available skill modules
  instructions?: string[]; // Additional instruction files
}
```

**Validation Rules**:
- `id` must match pattern: `/^[a-z0-9-]+$/`
- `commands` must contain at least one entry
- `/help` command automatically injected if not present

---

### TemplateVariable

Represents a dynamic variable that can be used in hook arguments to reference trigger context data.

```typescript
interface TemplateVariable {
  // Identity
  name: string; // Variable name (e.g., "specId", "filePath", "timestamp")
  
  // Metadata
  description: string; // Human-readable description
  valueType: TemplateValueType; // "string" | "number" | "object" | "array"
  
  // Availability
  availableFor: TriggerType[]; // Which trigger types provide this variable
  required: boolean; // Whether variable is guaranteed to be present
  
  // Default Behavior
  defaultValue?: string; // Value to use if unavailable (default: empty string)
}
```

**Standard Variables** (available for all trigger types):
- `{timestamp}` - ISO 8601 timestamp of trigger event
- `{triggerType}` - Name of the trigger operation
- `{user}` - Git user name from config

**Spec-Specific Variables** (for spec status change triggers):
- `{specId}` - Spec identifier
- `{specPath}` - Absolute path to spec file
- `{oldStatus}` - Previous spec status
- `{newStatus}` - Current spec status
- `{changeAuthor}` - User who triggered the change

**File-Specific Variables** (for file save triggers):
- `{filePath}` - Absolute path to saved file
- `{fileName}` - File name with extension
- `{fileExt}` - File extension (without dot)

---

### CustomActionParams (Extended)

Extended version of existing `CustomActionParams` from `src/features/hooks/types.ts` with new fields for agent registry integration.

```typescript
interface CustomActionParams {
  // NEW: Agent Registry Integration
  agentId?: string; // References AgentRegistryEntry.id (preferred)
  agentType?: AgentTypeEnum; // Explicit type override ("local" | "background")
  
  // EXISTING: Legacy Support (for backward compatibility)
  agentName: string; // Agent identifier (will be deprecated)
  prompt?: string; // Instruction text for the agent
  selectedTools?: SelectedMCPTool[]; // MCP tools available to agent
  
  // NEW: Template Variable Support
  arguments?: string; // Template string with {variable} syntax
}
```

**Migration Strategy**:
- Phase 1: Add `agentId` and `agentType` fields (optional)
- Phase 2: Populate `agentId` for all new hooks
- Phase 3 (future): Deprecate `agentName` in favor of `agentId`

---

## Supporting Entities

### AgentDiscoveryResult

Result of agent discovery operation from a single source.

```typescript
interface AgentDiscoveryResult {
  source: AgentSourceEnum; // Where agents were discovered
  agents: AgentRegistryEntry[]; // Discovered agents
  errors: AgentDiscoveryError[]; // Any errors encountered
  discoveredAt: number; // Unix timestamp (milliseconds)
}

interface AgentDiscoveryError {
  filePath?: string; // File that caused error (if applicable)
  extensionId?: string; // Extension that caused error (if applicable)
  code: AgentErrorCode; // Error type
  message: string; // Human-readable error message
}
```

**Error Codes**:
```typescript
type AgentErrorCode =
  | "PARSE_ERROR" // Failed to parse .agent.md file
  | "INVALID_SCHEMA" // Schema validation failed
  | "DUPLICATE_ID" // Agent ID already exists
  | "FILE_NOT_FOUND" // Agent file missing
  | "EXTENSION_ERROR"; // Extension registration failed
```

---

### AgentAvailabilityCheck

Result of agent availability validation at hook execution time.

```typescript
interface AgentAvailabilityCheck {
  agentId: string; // Reference to AgentRegistryEntry.id
  available: boolean; // Can agent be invoked?
  reason?: AgentUnavailableReason; // Why unavailable (if applicable)
  checkedAt: number; // Unix timestamp (milliseconds)
}

type AgentUnavailableReason =
  | "FILE_DELETED" // .agent.md file no longer exists
  | "EXTENSION_UNINSTALLED" // Extension was removed
  | "CLI_NOT_INSTALLED" // Background CLI tool not found in PATH
  | "INVALID_SCHEMA" // Agent schema became invalid
  | "UNKNOWN"; // Other error
```

---

### TemplateContext

Runtime context data available during template variable substitution.

```typescript
interface TemplateContext {
  // Standard fields (always present)
  timestamp: string; // ISO 8601 format
  triggerType: OperationType; // From existing hooks types
  user?: string; // Git user name (optional)
  
  // Dynamic fields (populated based on trigger type)
  [key: string]: string | number | boolean | undefined;
}
```

**Example Contexts**:

```typescript
// Spec status change trigger
const specContext: TemplateContext = {
  timestamp: "2026-01-26T10:30:00Z",
  triggerType: "clarify",
  user: "john-doe",
  specId: "011-custom-agent-hooks",
  specPath: "/path/to/specs/011-custom-agent-hooks/spec.md",
  oldStatus: "draft",
  newStatus: "review",
  changeAuthor: "john-doe"
};

// File save trigger
const fileContext: TemplateContext = {
  timestamp: "2026-01-26T10:30:00Z",
  triggerType: "file-save",
  user: "john-doe",
  filePath: "/path/to/project/src/index.ts",
  fileName: "index.ts",
  fileExt: "ts"
};
```

---

### FileWatcherEvent

Event emitted when agent files change on disk.

```typescript
interface FileWatcherEvent {
  type: FileChangeType; // "created" | "modified" | "deleted"
  uri: string; // File URI (vscode.Uri.fsPath)
  timestamp: number; // Unix timestamp (milliseconds)
}

type FileChangeType = "created" | "modified" | "deleted";
```

---

### ExtensionRegistrationEvent

Event emitted when extensions are installed/uninstalled.

```typescript
interface ExtensionRegistrationEvent {
  type: ExtensionChangeType; // "installed" | "uninstalled" | "enabled" | "disabled"
  extensionId: string; // VS Code extension identifier
  timestamp: number; // Unix timestamp (milliseconds)
}

type ExtensionChangeType = "installed" | "uninstalled" | "enabled" | "disabled";
```

---

## Enumerations

### AgentTypeEnum

Classification of agent execution environment.

```typescript
type AgentTypeEnum = "local" | "background";
```

**Values**:
- `"local"`: Agent runs within VS Code extension (from `.github/agents/*.agent.md`)
- `"background"`: Agent runs as external CLI tool or registered extension (e.g., GitHub Copilot CLI)

---

### AgentSourceEnum

Source from which agent was discovered.

```typescript
type AgentSourceEnum = "file" | "extension";
```

**Values**:
- `"file"`: Discovered from `.github/agents/*.agent.md` file
- `"extension"`: Registered via VS Code extension API

---

### TemplateValueType

Data type of template variable value.

```typescript
type TemplateValueType = "string" | "number" | "boolean" | "object" | "array";
```

---

## State Machines

### Agent Registry Entry State Machine

```
┌──────────────┐
│              │
│  DISCOVERING │ ─────────────┐
│              │               │
└──────┬───────┘               │
       │                       │
       │ Discovery Success     │ Discovery Error
       ▼                       ▼
┌──────────────┐        ┌──────────────┐
│              │        │              │
│  AVAILABLE   │◄───────│    ERROR     │
│              │        │              │
└──────┬───────┘        └──────────────┘
       │                       ▲
       │ File Deleted/         │
       │ Extension Removed     │ Retry Success
       ▼                       │
┌──────────────┐               │
│              │               │
│ UNAVAILABLE  │───────────────┘
│              │     Retry
└──────────────┘
```

**State Descriptions**:
- **DISCOVERING**: Agent is being scanned/loaded (initial state)
- **AVAILABLE**: Agent is ready for use in hooks
- **UNAVAILABLE**: Agent cannot be invoked (file missing, extension uninstalled)
- **ERROR**: Agent has invalid schema or failed validation

**State Transitions**:
1. Discovery → Available: Agent successfully loaded and validated
2. Discovery → Error: Agent failed validation or parsing
3. Available → Unavailable: File deleted or extension uninstalled
4. Unavailable → Available: File restored or extension reinstalled
5. Error → Available: Agent schema corrected and revalidated

---

### Hook Execution State Machine (Extended)

```
┌──────────────┐
│   PENDING    │ ◄──── Hook triggered
└──────┬───────┘
       │
       │ Start execution
       ▼
┌──────────────┐
│  VALIDATING  │ ──────┐
│    AGENT     │       │
└──────┬───────┘       │
       │               │ Agent unavailable
       │               ▼
       │        ┌──────────────┐
       │        │    FAILED    │
       │        │   (Agent     │
       │        │ Unavailable) │
       │        └──────────────┘
       │                ▲
       │ Agent OK       │
       ▼                │
┌──────────────┐        │
│  REPLACING   │        │ Template error
│  TEMPLATES   │────────┘
└──────┬───────┘
       │
       │ Templates OK
       ▼
┌──────────────┐
│  EXECUTING   │
│    ACTION    │
└──────┬───────┘
       │
       ├──► SUCCESS
       ├──► FAILURE (execution error)
       └──► TIMEOUT
```

---

## Relationships

### Entity Relationship Diagram

```
┌─────────────────────┐
│                     │
│ AgentRegistryEntry  │◄────────┐
│                     │         │
└──────────┬──────────┘         │
           │                    │
           │ 0..1               │
           │                    │ references
           │                    │
           │                    │
┌──────────▼──────────┐         │
│                     │         │
│ AgentConfigSchema   │         │
│                     │         │
└─────────────────────┘         │
                                │
                                │
┌─────────────────────┐         │
│                     │         │
│    Hook (existing)  │         │
│                     │         │
└──────────┬──────────┘         │
           │                    │
           │ contains           │
           │                    │
           ▼                    │
┌─────────────────────┐         │
│                     │         │
│ CustomActionParams  │─────────┘
│   (extended)        │  agentId
│                     │
└──────────┬──────────┘
           │
           │ uses
           │
           ▼
┌─────────────────────┐
│                     │
│ TemplateVariable    │
│                     │
└─────────────────────┘
```

**Relationships**:
1. **AgentRegistryEntry → AgentConfigSchema**: One-to-one (optional, only for `source="file"`)
2. **CustomActionParams → AgentRegistryEntry**: Many-to-one (via `agentId` reference)
3. **CustomActionParams → TemplateVariable**: Uses template variables in `arguments` field

---

## Storage Format

### Agent Registry Storage

**Location**: In-memory cache with periodic persistence to workspace state

**Format**: JSON array of `AgentRegistryEntry` objects

```json
{
  "version": 1,
  "lastUpdated": 1706267400000,
  "agents": [
    {
      "id": "local:code-reviewer",
      "name": "Code Reviewer",
      "displayName": "Code Reviewer (Local)",
      "description": "Reviews code changes for quality and style",
      "type": "local",
      "source": "file",
      "sourcePath": "/path/to/.github/agents/code-reviewer.agent.md",
      "schema": { /* AgentConfigSchema */ },
      "discoveredAt": 1706267400000,
      "available": true
    },
    {
      "id": "extension:copilot",
      "name": "GitHub Copilot",
      "displayName": "GitHub Copilot",
      "description": "AI pair programmer",
      "type": "background",
      "source": "extension",
      "extensionId": "github.copilot",
      "discoveredAt": 1706267400000,
      "available": true
    }
  ]
}
```

**Persistence Strategy**:
- Write to workspace state on:
  - New agent discovered
  - Agent availability change
  - Extension install/uninstall
- Read from workspace state on:
  - Extension activation
  - Manual refresh request

---

### Hook Configuration Storage (Extended)

**Location**: Existing hooks storage (`.vscode/gatomia/hooks.json`)

**Format**: Extends existing `Hook` interface with new `CustomActionParams` fields

```json
{
  "id": "abc-123-def",
  "name": "Review Spec After Clarify",
  "enabled": true,
  "trigger": {
    "agent": "speckit",
    "operation": "clarify",
    "timing": "after"
  },
  "action": {
    "type": "custom",
    "parameters": {
      "agentId": "local:code-reviewer",
      "agentType": "local",
      "agentName": "code-reviewer",
      "prompt": "Review the clarified spec",
      "arguments": "Spec ID: {specId}, Changed by: {changeAuthor}, Timestamp: {timestamp}"
    }
  },
  "createdAt": 1706267400000,
  "modifiedAt": 1706267400000,
  "executionCount": 5
}
```

**Migration**: Existing hooks without `agentId` continue to work using `agentName` field.

---

## Validation Rules

### AgentRegistryEntry Validation

```typescript
const validateAgentRegistryEntry = (entry: AgentRegistryEntry): ValidationResult => {
  const errors: string[] = [];
  
  // ID format: "source:name"
  if (!/^(local|extension):[a-z0-9-]+$/.test(entry.id)) {
    errors.push("Invalid agent ID format");
  }
  
  // Name required
  if (!entry.name || entry.name.trim().length === 0) {
    errors.push("Agent name is required");
  }
  
  // Display name required
  if (!entry.displayName || entry.displayName.trim().length === 0) {
    errors.push("Agent display name is required");
  }
  
  // Type must be valid enum
  if (!["local", "background"].includes(entry.type)) {
    errors.push("Invalid agent type");
  }
  
  // Source must be valid enum
  if (!["file", "extension"].includes(entry.source)) {
    errors.push("Invalid agent source");
  }
  
  // Source-specific validation
  if (entry.source === "file" && !entry.sourcePath) {
    errors.push("Source path required for file-based agents");
  }
  
  if (entry.source === "extension" && !entry.extensionId) {
    errors.push("Extension ID required for extension-based agents");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};
```

---

### Template Variable Validation

```typescript
const validateTemplateString = (template: string, context: TemplateContext): ValidationResult => {
  const errors: string[] = [];
  
  // Extract all {variable} references
  const variablePattern = /\{([a-zA-Z0-9_]+)\}/g;
  const matches = [...template.matchAll(variablePattern)];
  
  for (const match of matches) {
    const varName = match[1];
    
    // Check if variable exists in context
    if (!(varName in context)) {
      // Warning only - will be replaced with empty string
      errors.push(`Template variable {${varName}} not available in trigger context (will be replaced with empty string)`);
    }
  }
  
  return {
    valid: true, // Always valid - just warnings
    errors
  };
};
```

---

### CustomActionParams Validation (Extended)

```typescript
const validateCustomActionParams = (params: CustomActionParams): ValidationResult => {
  const errors: string[] = [];
  
  // Agent identification: require either agentId or agentName
  if (!params.agentId && !params.agentName) {
    errors.push("Either agentId or agentName is required");
  }
  
  // agentId format validation
  if (params.agentId && !/^(local|extension):[a-z0-9-]+$/.test(params.agentId)) {
    errors.push("Invalid agentId format");
  }
  
  // agentType validation
  if (params.agentType && !["local", "background"].includes(params.agentType)) {
    errors.push("Invalid agent type");
  }
  
  // Arguments length validation
  if (params.arguments && params.arguments.length > MAX_ARGUMENTS_LENGTH) {
    errors.push(`Arguments exceed maximum length of ${MAX_ARGUMENTS_LENGTH} characters`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};
```

---

## Constants

### Length Limits

```typescript
// Agent naming
export const MAX_AGENT_NAME_LENGTH = 100;
export const MAX_AGENT_DESCRIPTION_LENGTH = 500;
export const MAX_AGENT_ID_LENGTH = 50;

// Template variables
export const MAX_TEMPLATE_VARIABLE_NAME_LENGTH = 50;
export const MAX_ARGUMENTS_LENGTH = 1000;

// Registry
export const MAX_AGENTS_PER_SOURCE = 100;
export const MAX_TOTAL_AGENTS = 200;

// Discovery
export const AGENT_DISCOVERY_TIMEOUT_MS = 5000; // 5 seconds
export const FILE_WATCHER_DEBOUNCE_MS = 500; // 0.5 seconds
export const EXTENSION_SCAN_INTERVAL_MS = 10000; // 10 seconds
```

### File System Paths

```typescript
// Agent discovery
export const LOCAL_AGENTS_DIR = ".github/agents"; // Relative to workspace root
export const AGENT_FILE_PATTERN = "**/*.agent.md"; // Glob pattern for agent files

// Storage
export const REGISTRY_STORAGE_KEY = "gatomia.agents.registry";
export const REGISTRY_VERSION = 1;
```

---

## Type Exports

All types defined in this document should be exported from:
- `src/features/hooks/types.ts` (extended existing types)
- `src/features/hooks/agent-registry-types.ts` (new agent registry types)

```typescript
// src/features/hooks/agent-registry-types.ts
export type {
  AgentRegistryEntry,
  AgentConfigSchema,
  AgentCommand,
  AgentResources,
  AgentDiscoveryResult,
  AgentDiscoveryError,
  AgentAvailabilityCheck,
  FileWatcherEvent,
  ExtensionRegistrationEvent,
  TemplateVariable,
  TemplateContext,
  AgentTypeEnum,
  AgentSourceEnum,
  TemplateValueType,
  AgentErrorCode,
  AgentUnavailableReason,
  FileChangeType,
  ExtensionChangeType,
};
```

---

## Document Status

- ✅ **Core Entities**: Defined
- ✅ **Supporting Entities**: Defined
- ✅ **Enumerations**: Defined
- ✅ **State Machines**: Defined
- ✅ **Relationships**: Defined
- ✅ **Storage Format**: Defined
- ✅ **Validation Rules**: Defined

**Next Steps**: Create API contracts in `contracts/` directory
