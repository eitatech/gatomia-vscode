# Data Model: Copilot Agents Integration

**Feature**: 010-copilot-agents  
**Date**: 2026-01-24

## Overview

This document defines the core data structures, entities, and their relationships for the Copilot Agents Integration feature.

---

## Core Entities

### 1. AgentDefinition

Represents a parsed agent definition from a markdown file with YAML frontmatter.

```typescript
interface AgentDefinition {
  id: string;          // Unique identifier
  name: string;        // Short display name
  fullName: string;    // Full descriptive name
  description: string; // Brief purpose description
  icon?: string;       // Optional icon path
  commands: AgentCommand[];
  resources: AgentResourceRefs;
  filePath: string;    // Original file path
  content: string;     // Markdown documentation
}
```

### 2. AgentCommand

```typescript
interface AgentCommand {
  name: string;        // Command name (without /)
  description: string; // Shown in autocomplete
  tool: string;        // Tool handler name to invoke
  parameters?: string; // Optional parameter hints
}
```

### 3. AgentResourceRefs

```typescript
interface AgentResourceRefs {
  prompts?: string[];       // Prompt filenames
  skills?: string[];        // Skill filenames
  instructions?: string[];  // Instruction filenames
}
```

### 4. ToolHandler

```typescript
type ToolHandler = (params: ToolExecutionParams) => Promise<ToolResponse>;

interface ToolExecutionParams {
  input: string;                    // User input after command
  context: ToolExecutionContext;    // Execution context
  resources: AgentResources;        // Loaded resources
  token: vscode.CancellationToken;  // Cancellation token
}
```

### 5. ToolExecutionContext

```typescript
interface ToolExecutionContext {
  workspace: {
    uri: vscode.Uri;
    name: string;
    folders: vscode.WorkspaceFolder[];
  };
  vscode: {
    window: typeof vscode.window;
    workspace: typeof vscode.workspace;
    commands: typeof vscode.commands;
  };
  chatContext: vscode.ChatContext;
  outputChannel: vscode.OutputChannel;
  telemetry: TelemetryReporter;
}
```

### 6. AgentResources

```typescript
interface AgentResources {
  prompts: Map<string, string>;
  skills: Map<string, string>;
  instructions: Map<string, string>;
}
```

### 7. ToolResponse

```typescript
interface ToolResponse {
  content: string;  // Markdown-formatted content
  files?: FileReference[];
  metadata?: ResponseMetadata;
}

interface FileReference {
  uri: vscode.Uri;
  label?: string;
  action?: 'created' | 'modified' | 'deleted';
}

interface ResponseMetadata {
  duration?: number;
  tokensUsed?: number;
  [key: string]: any;
}
```

### 8. ResourceCache

```typescript
interface ResourceCache {
  prompts: Map<string, string>;
  skills: Map<string, string>;
  instructions: Map<string, string>;
  
  load(resourcesDir: string): Promise<void>;
  reload(changedFiles: string[]): Promise<void>;
  get(type: 'prompt' | 'skill' | 'instruction', name: string): string | undefined;
}
```

---

## Entity Relationships

```
AgentDefinition
  ├─ commands: AgentCommand[]
  │    └─ tool: string (references ToolHandler)
  ├─ resources: AgentResourceRefs
  └─ filePath: string

ToolHandler (registered in ToolRegistry)
  ├─ receives: ToolExecutionParams
  └─ returns: ToolResponse

ResourceCache
  ├─ prompts: Map<filename, content>
  ├─ skills: Map<filename, content>
  └─ instructions: Map<filename, content>
```

---

## State Transitions

### Agent Lifecycle

```
DISCOVERED → PARSED → VALIDATED → REGISTERED → EXECUTING → COMPLETED
                                      ↑ (file change)
                                      └─ FILE_WATCHER → UPDATED
```

### Tool Execution Flow

```
USER_INPUT → PARSE_COMMAND → LOOKUP_TOOL → LOAD_RESOURCES → 
EXECUTE_TOOL → RENDER_RESPONSE → COMPLETED
```

---

## Validation Rules

```typescript
function validateAgentDefinition(def: AgentDefinition): ValidationResult {
  const errors: string[] = [];
  
  if (!def.id || !/^[a-z0-9-]+$/.test(def.id)) {
    errors.push('Agent ID must be lowercase alphanumeric with hyphens');
  }
  
  if (!def.name || def.name.trim().length === 0) {
    errors.push('Agent name is required');
  }
  
  if (!def.commands || def.commands.length === 0) {
    errors.push('Agent must have at least one command');
  }
  
  return { valid: errors.length === 0, errors };
}
```

---

## Performance Considerations

- **Memory**: <5MB for typical extension (10 agents, 200 resource files)
- **Lookups**: O(1) with Map structures
- **Initial load**: ~100-200ms for all resources
- **Hot-reload**: ~10-50ms for changed files

---

## Example Agent Definition

```markdown
---
id: speckit
name: SpecKit
fullName: SpecKit Workflow Agent
description: Manages feature specifications and workflow automation
icon: resources/icons/speckit.png
commands:
  - name: specify
    description: Create or update feature specification
    tool: speckit.specify
  - name: plan
    description: Generate implementation plan
    tool: speckit.plan
resources:
  prompts: [speckit.specify.prompt.md, speckit.plan.prompt.md]
  skills: [spec-writing.skill.md]
  instructions: [speckit-behavior.instructions.md]
---

# SpecKit Agent

SpecKit manages feature specifications using Spec-Driven Development.

## Commands

### /specify
Creates or updates a feature specification.
**Usage**: `@speckit /specify <feature-description>`

### /plan
Generates an implementation plan.
**Usage**: `@speckit /plan`
```
