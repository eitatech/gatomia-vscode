# Quickstart Guide: Custom Agent Hooks

**Feature**: Custom Agent Hooks Refactoring  
**Last Updated**: 2026-01-26

This guide provides both user and developer documentation for the Custom Agent Hooks feature.

---

## Table of Contents

### For Users
1. [What Are Custom Agent Hooks?](#what-are-custom-agent-hooks)
2. [Configuring a Hook with Custom Agents](#configuring-a-hook-with-custom-agents)
3. [Using Template Variables](#using-template-variables)
4. [Troubleshooting](#troubleshooting)

### For Developers
5. [Architecture Overview](#architecture-overview)
6. [Extending Agent Sources](#extending-agent-sources)
7. [Adding New Trigger Types](#adding-new-trigger-types)
8. [Testing Guidelines](#testing-guidelines)

---

## For Users

### What Are Custom Agent Hooks?

Custom Agent Hooks automate workflows by triggering custom AI agents when specific events occur in your project (e.g., spec clarifications, file saves, git commits).

**Key Features**:
- **Agent Selection**: Choose from local agents (`.github/agents/*.agent.md`) or background agents (GitHub Copilot CLI, OpenAI Codex, etc.)
- **Template Variables**: Pass dynamic context from triggers to agents (e.g., spec IDs, file paths, timestamps)
- **Real-Time Updates**: Agent list automatically refreshes when files change or extensions are installed

**Example Use Cases**:
- Auto-review specs after clarification
- Generate test stubs when new features are added
- Notify team channels when critical files change
- Create GitHub issues from spec changes

---

### Configuring a Hook with Custom Agents

#### Step 1: Open Hooks Configuration

1. Open VS Code Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Search for: **"GatomIA: Configure Hooks"**
3. Click **"Create New Hook"** button

#### Step 2: Configure Trigger

Select when your hook should fire:

- **Agent**: `SpecKit` or `OpenSpec`
- **Operation**: `specify`, `clarify`, `plan`, `tasks`, etc.
- **Timing**: `after` (only option currently)

**Example**: Trigger after running `/speckit.clarify`

#### Step 3: Select Custom Agent

1. Click the **"Agent Name"** dropdown field
2. You'll see agents grouped by type:
   - **Local Agents** - From `.github/agents/*.agent.md` files
   - **Background Agents** - CLI tools and VS Code extensions

3. Select your agent from the list

**Duplicate Names**: If multiple agents share the same name, they'll show source indicators:
- "Code Reviewer (Local)" - From `.github/agents/code-reviewer.agent.md`
- "Code Reviewer (Extension)" - From installed extension

#### Step 4: Configure Agent Type (Optional)

By default, the agent type is auto-detected:
- `.github/agents/*.agent.md` → Local Agent
- CLI tools / extensions → Background Agent

To override:
1. Click **"Agent Type"** selector
2. Choose: **Local Agent** or **Background Agent**

#### Step 5: Add Template Variables

Use template variables to pass trigger context to your agent:

**Syntax**: `{variableName}`

**Available Variables**:

| Variable | Description | Example |
|----------|-------------|---------|
| `{timestamp}` | ISO 8601 timestamp | `2026-01-26T10:30:00Z` |
| `{triggerType}` | Trigger operation | `clarify` |
| `{user}` | Git user name | `john-doe` |
| `{specId}` | Spec identifier (spec triggers) | `011-custom-agent-hooks` |
| `{specPath}` | Spec file path (spec triggers) | `/path/to/specs/011-custom-agent-hooks/spec.md` |
| `{oldStatus}` | Previous spec status | `draft` |
| `{newStatus}` | Current spec status | `review` |
| `{changeAuthor}` | User who changed spec | `john-doe` |
| `{filePath}` | File path (file triggers) | `/path/to/src/index.ts` |
| `{fileName}` | File name (file triggers) | `index.ts` |

**Example Arguments**:
```
Review spec {specId} changed to {newStatus} by {changeAuthor} at {timestamp}
```

**Resolved at Runtime**:
```
Review spec 011-custom-agent-hooks changed to review by john-doe at 2026-01-26T10:30:00Z
```

**Missing Variables**: If a variable isn't available for the trigger type, it's replaced with an empty string.

#### Step 6: Save Hook

1. Click **"Save Hook"** button
2. System validates agent availability before saving
3. Hook appears in hooks list with ✓ icon (enabled)

---

### Using Template Variables

#### Best Practices

**✅ DO**:
- Use descriptive variable names: `{specId}`, `{filePath}`
- Combine static text with variables: `"Spec {specId} updated"`
- Use variables relevant to your trigger type
- Test with sample data before production use

**❌ DON'T**:
- Use variables not available for your trigger type
- Nest variables: `{{specId}}`
- Use invalid characters: `{spec-id}` (hyphens not allowed)
- Create extremely long argument strings (max 1000 chars)

#### Example: Spec Review Hook

**Trigger**: After `/speckit.clarify`

**Agent**: Code Reviewer (Local)

**Arguments**:
```
Please review the clarified spec for feature {specId}. 
Status changed from {oldStatus} to {newStatus}.
Focus on requirements validation and success criteria.
Spec file: {specPath}
```

**Resolved**:
```
Please review the clarified spec for feature 011-custom-agent-hooks.
Status changed from draft to review.
Focus on requirements validation and success criteria.
Spec file: /path/to/specs/011-custom-agent-hooks/spec.md
```

---

### Complete Real-World Example

This example demonstrates setting up an automated spec review workflow using custom agent hooks.

#### Scenario

You want to automatically review specs after clarification to ensure quality before planning implementation.

#### Step 1: Create the Review Agent

Create `.github/agents/example-review-agent.agent.md`:

```markdown
---
description: Example agent for reviewing specs after clarification. This is a simple template demonstrating custom agent usage with hooks.
---

## User Input

\`\`\`text
$ARGUMENTS
\`\`\`

## Review Instructions

When invoked with template variables, this agent should:

1. **Load the Spec**: Read the spec file at {specPath}
2. **Verify Completeness**: Check that all required sections are present
3. **Validate Status**: Confirm the status transition is appropriate
4. **Check Clarity**: Ensure requirements are specific and testable
5. **Review Success Criteria**: Verify that success criteria are measurable

### Output Format

\`\`\`markdown
## Spec Review: {specId}

**Status**: ✅ Ready / ⚠️ Needs Work

### Completeness
- [ ] Problem statement defined
- [ ] Success criteria specified
...
\`\`\`
```

#### Step 2: Configure the Hook

1. Open Command Palette → "GatomIA: Configure Hooks"
2. Click "Create New Hook"
3. Fill in fields:
   - **Name**: "Auto-Review After Clarify"
   - **Trigger Agent**: `SpecKit`
   - **Trigger Operation**: `clarify`
   - **Trigger Timing**: `after`
   - **Action Type**: `Custom Agent`
   - **Agent Name**: Select "Example Review Agent" from dropdown
   - **Agent Type**: Auto-detected as "Local Agent"
   - **Arguments**: 
     ```
     Please review spec {specId} which changed from {oldStatus} to {newStatus}. 
     File: {specPath}. Changed by {changeAuthor} at {timestamp}.
     ```
4. Click "Save Hook"

#### Step 3: Test the Hook

1. Open a spec file (e.g., `specs/011-custom-agent-hooks/spec.md`)
2. Run `/speckit.clarify` with questions
3. After clarification completes, the hook automatically triggers:
   - System detects `clarify` operation completed
   - Hook matches trigger criteria
   - Template variables are substituted with actual values
   - Agent receives: 
     ```
     Please review spec 011-custom-agent-hooks which changed from draft to review.
     File: /workspace/specs/011-custom-agent-hooks/spec.md. 
     Changed by john-doe at 2026-01-27T10:30:00Z.
     ```
   - Agent performs review and outputs feedback

#### Step 4: View Execution Logs

1. Open Output Panel: View → Output → "GatomIA"
2. Look for hook execution logs:
   ```
   [HookExecutor] Executing hook: Auto-Review After Clarify (abc-123)
   [HookExecutor] Trigger: speckit.clarify (after)
   [HookExecutor] Agent: local:example-review-agent (Local Agent)
   [HookExecutor] Arguments: Please review spec 011-custom-agent-hooks...
   [HookExecutor] ✓ Hook executed successfully in 2.3s
   ```

#### Additional Examples

See these example agents in `.github/agents/`:
- `example-review-agent.agent.md` - Auto-review specs after clarification
- `example-test-generator.agent.md` - Generate test stubs when files are saved
- `example-notification-agent.agent.md` - Notify team channels of spec changes

---

### Troubleshooting

#### Agent Not Appearing in Dropdown

**Problem**: Your `.agent.md` file isn't showing up in the agent dropdown.

**Solutions**:
1. Check file location: Must be in `.github/agents/` directory
2. Check file extension: Must end with `.agent.md`
3. Validate YAML frontmatter: Run `/speckit.validate-agent <file-path>`
4. Refresh manually: Click refresh icon in hooks UI
5. Check Output panel: VS Code → Output → "GatomIA" for errors

#### Hook Fails with "Agent Unavailable"

**Problem**: Hook execution fails with error: "Agent not available".

**Solutions**:
1. **Local Agent**: Check if `.agent.md` file was deleted or moved
2. **Background Agent**: Verify CLI tool is installed and in PATH
   - GitHub Copilot CLI: `gh copilot --version`
   - OpenAI Codex: `codex --version`
3. **Extension Agent**: Check if extension is still installed and enabled
4. Check agent availability: Click "Check Availability" button in hook config

#### Template Variables Not Replaced

**Problem**: Arguments contain literal `{variableName}` instead of values.

**Solutions**:
1. Check variable availability for your trigger type
2. Verify variable name spelling (case-sensitive)
3. Check Output panel for template parsing errors
4. Review available variables: Hover over "Arguments" field in UI

#### Duplicate Agent Names

**Problem**: Two agents with the same name appear in dropdown.

**Solution**: This is expected! Select the one with the correct source indicator:
- `(Local)` - From `.github/agents/`
- `(Extension)` - From installed extension

The system automatically prevents ambiguity.

---

## For Developers

### Architecture Overview

#### Component Hierarchy

```
┌─────────────────────────────────────────┐
│         AgentRegistry (Singleton)       │
│  - Discovers agents from all sources    │
│  - Maintains unified in-memory cache    │
│  - Emits change events                  │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌─────────────┐  ┌────────────────────┐
│   File      │  │    Extension       │
│  Discovery  │  │    Discovery       │
└─────────────┘  └────────────────────┘
       │                │
       ▼                ▼
┌─────────────┐  ┌────────────────────┐
│   File      │  │   Extension        │
│  Watcher    │  │    Monitor         │
└─────────────┘  └────────────────────┘
```

#### Data Flow

**Agent Discovery (Initialization)**:
```
1. Extension activates
2. AgentRegistry.initialize()
3. FileDiscovery scans .github/agents/
4. ExtensionDiscovery scans extensions.all
5. Registry merges results → resolves duplicates
6. Webview receives "agents-changed" event
7. Dropdown populates with grouped agents
```

**Hook Execution (Runtime)**:
```
1. Trigger fires (e.g., /speckit.clarify completes)
2. HookManager retrieves matching hooks
3. For each hook with custom action:
   a. Registry checks agent availability
   b. TemplateParser substitutes variables
   c. AgentExecutor invokes agent
   d. Logs execution result
```

**Real-Time Refresh**:
```
1. User adds code-reviewer.agent.md to .github/agents/
2. FileWatcher emits "file-created" event
3. FileDiscovery re-scans directory
4. Registry updates cache
5. Webview receives "agents-changed" event
6. Dropdown re-renders with new agent
```

---

### Extending Agent Sources

#### Adding a New Agent Source

To support agents from a new source (e.g., remote registry, cloud service):

1. **Implement `IAgentDiscovery` interface** (`src/features/hooks/discovery/`):

```typescript
// remote-agent-discovery.ts
import type { IAgentDiscovery, AgentDiscoveryResult } from '../contracts/agent-registry-api';

export class RemoteAgentDiscovery implements IAgentDiscovery {
  async discoverAgents(): Promise<AgentDiscoveryResult> {
    // Fetch agents from remote API
    const response = await fetch('https://agent-registry.example.com/api/agents');
    const agents = await response.json();
    
    // Convert to AgentRegistryEntry format
    const entries = agents.map(agent => ({
      id: `remote:${agent.id}`,
      name: agent.name,
      displayName: agent.name,
      type: 'background' as const,
      source: 'remote' as const,
      // ... other fields
    }));
    
    return {
      source: 'remote',
      agents: entries,
      errors: [],
      discoveredAt: Date.now(),
    };
  }
}
```

2. **Register discovery service** in `AgentRegistry`:

```typescript
// agent-registry.ts
import { RemoteAgentDiscovery } from './discovery/remote-agent-discovery';

export class AgentRegistry {
  private discoveryServices: IAgentDiscovery[];
  
  constructor() {
    this.discoveryServices = [
      new FileAgentDiscovery(),
      new ExtensionAgentDiscovery(),
      new RemoteAgentDiscovery(), // NEW
    ];
  }
}
```

3. **Add monitoring** (if source supports real-time updates):

```typescript
// remote-agent-monitor.ts
export class RemoteAgentMonitor {
  startMonitoring() {
    // Poll API for changes every 30 seconds
    setInterval(() => this.checkForUpdates(), 30000);
  }
  
  private async checkForUpdates() {
    // Compare with cached agents, emit events if changed
  }
}
```

4. **Update types** (`agent-registry-types.ts`):

```typescript
export type AgentSourceEnum = "file" | "extension" | "remote";
```

---

### Adding New Trigger Types

To add support for new template variables for a new trigger type:

1. **Define trigger type** in `src/features/hooks/types.ts`:

```typescript
export type OperationType =
  | "research"
  | "clarify"
  | "my-new-trigger" // NEW
  | ...;
```

2. **Define variables** in `contracts/template-variable-schema.ts`:

```typescript
export const MY_NEW_TRIGGER_VARIABLES: TemplateVariable[] = [
  {
    name: "customField",
    description: "Description of custom field",
    valueType: "string",
    availableFor: ["my-new-trigger"],
    required: true,
    example: "example-value",
    category: "custom",
  },
];

// Add to ALL_TEMPLATE_VARIABLES
export const ALL_TEMPLATE_VARIABLES: TemplateVariable[] = [
  ...STANDARD_VARIABLES,
  ...SPEC_VARIABLES,
  ...MY_NEW_TRIGGER_VARIABLES, // NEW
];
```

3. **Implement context builder** in `TemplateContextBuilder`:

```typescript
// template-context-builder.ts
addTriggerVariables(context: TemplateContext, triggerType: OperationType, eventData: TriggerEventData) {
  if (triggerType === "my-new-trigger") {
    context.customField = eventData.customField as string;
    // ... add other variables
  }
}
```

4. **Update tests** (`tests/unit/hooks/template-variable-parser.test.ts`):

```typescript
describe("my-new-trigger variables", () => {
  it("should substitute customField", () => {
    const template = "Custom: {customField}";
    const context = {
      timestamp: "2026-01-26T10:30:00Z",
      triggerType: "my-new-trigger",
      customField: "test-value",
    };
    
    const result = parser.substitute(template, context);
    expect(result).toBe("Custom: test-value");
  });
});
```

---

### Testing Guidelines

#### Unit Tests

**Test File Locations**:
- Agent Registry: `tests/unit/hooks/agent-registry.test.ts`
- Template Parser: `tests/unit/hooks/template-variable-parser.test.ts`
- File Discovery: `tests/unit/hooks/file-agent-discovery.test.ts`
- Extension Discovery: `tests/unit/hooks/extension-agent-discovery.test.ts`

**Example Unit Test**:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from '@/features/hooks/agent-registry';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  
  beforeEach(async () => {
    registry = new AgentRegistry();
    await registry.initialize();
  });
  
  it('should discover agents from all sources', () => {
    const agents = registry.getAllAgents();
    expect(agents.length).toBeGreaterThan(0);
  });
  
  it('should resolve duplicate names with source indicators', () => {
    const duplicates = registry.getAllAgents().filter(a => 
      a.displayName.includes('(Local)') || a.displayName.includes('(Extension)')
    );
    
    expect(duplicates.length).toBeGreaterThanOrEqual(0);
  });
});
```

#### Integration Tests

**Test File Location**: `tests/integration/hooks/custom-agent-hooks.test.ts`

**Example Integration Test**:

```typescript
import { describe, it, expect } from 'vitest';
import { HookManager } from '@/features/hooks/hook-manager';
import { AgentRegistry } from '@/features/hooks/agent-registry';

describe('Custom Agent Hooks Integration', () => {
  it('should execute hook with template variable substitution', async () => {
    const registry = new AgentRegistry();
    await registry.initialize();
    
    const hookManager = new HookManager(registry);
    
    // Create hook with template variables
    const hook = {
      id: 'test-hook',
      name: 'Test Hook',
      enabled: true,
      trigger: { agent: 'speckit', operation: 'clarify', timing: 'after' },
      action: {
        type: 'custom',
        parameters: {
          agentId: 'local:test-agent',
          agentType: 'local',
          agentName: 'test-agent',
          arguments: 'Spec: {specId}, Status: {newStatus}',
        },
      },
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      executionCount: 0,
    };
    
    await hookManager.addHook(hook);
    
    // Trigger hook with context
    const result = await hookManager.executeTrigger({
      agent: 'speckit',
      operation: 'clarify',
      timestamp: Date.now(),
      metadata: {
        specId: '011-custom-agent-hooks',
        newStatus: 'review',
      },
    });
    
    expect(result.success).toBe(true);
    expect(result.executedHooks).toHaveLength(1);
  });
});
```

#### Test-Driven Development (TDD)

**Required by Constitution**: All new code MUST follow Red-Green-Refactor cycle.

**Example TDD Flow**:

1. **Red** - Write failing test:
```typescript
it('should replace missing variables with empty string', () => {
  const template = "Value: {missingVar}";
  const context = { timestamp: "2026-01-26T10:30:00Z", triggerType: "clarify" };
  
  const result = parser.substitute(template, context);
  expect(result).toBe("Value: "); // FAILS - parser not implemented
});
```

2. **Green** - Implement minimum code to pass:
```typescript
substitute(template: string, context: TemplateContext): string {
  return template.replace(TEMPLATE_VARIABLE_PATTERN, (match, varName) => {
    return context[varName]?.toString() || "";
  });
}
```

3. **Refactor** - Improve code quality:
```typescript
substitute(template: string, context: TemplateContext): string {
  return template.replace(
    TEMPLATE_VARIABLE_PATTERN, 
    (match, varName) => this.resolveVariable(varName, context)
  );
}

private resolveVariable(name: string, context: TemplateContext): string {
  const value = context[name];
  return value !== undefined ? String(value) : DEFAULT_MISSING_VALUE;
}
```

---

## Next Steps

### For Users
1. Create your first `.agent.md` file in `.github/agents/`
2. Configure a hook to trigger after `/speckit.clarify`
3. Use template variables to pass spec context
4. Test with a real spec clarification

### For Developers
1. Review `data-model.md` for complete entity definitions
2. Review API contracts in `contracts/` directory
3. Run `/speckit.tasks` to generate detailed implementation tasks
4. Follow TDD approach for all new code

---

## Support

**Issues**: Report bugs at [GitHub Issues](https://github.com/your-org/gatomia-vscode/issues)

**Documentation**: Full docs at [GatomIA Docs](https://gatomia.dev/docs)

**Community**: Join [Discord](https://discord.gg/gatomia) for support

---

**Last Updated**: 2026-01-26  
**Version**: 1.0.0  
**Status**: Draft
