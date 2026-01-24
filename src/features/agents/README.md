# Copilot Agents Integration

This directory contains the core implementation of the Copilot Agents integration feature for GatomIA. It enables VS Code extension to register and manage GitHub Copilot Chat agents with their tools, resources, and behavior definitions.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  VS Code Extension Host                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │          Extension                               │   │
│  │  (src/extension.ts)                          │   │
│  │  • Initializes services                       │   │
│  │  • Manages lifecycle                          │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                              │
│    ┌─────────────────────┼─────────────────────┐        │
│    │                     │                     │        │
│    ▼                     ▼                     ▼        │
│ ┌──────────┐      ┌─────────────┐      ┌──────────────┐│
│ │ Agent    │      │ Tool        │      │ Resource     ││
│ │ Loader   │      │ Registry    │      │ Cache        ││
│ │          │      │             │      │              ││
│ │ • Parse  │      │ • Register  │      │ • Load       ││
│ │ • Validate│     │ • Execute   │      │ • Cache      ││
│ │ • Load   │      │ • Error     │      │ • Reload     ││
│ │          │      │   Handling  │      │              ││
│ └──────────┘      └─────────────┘      └──────────────┘│
│                          │                              │
│                          ▼                              │
│                ┌──────────────────────┐                 │
│                │ ChatParticipant      │                 │
│                │ Registry             │                 │
│                │                      │                 │
│                │ • Register agents    │                 │
│                │ • Handle requests    │                 │
│                │ • Stream responses   │                 │
│                └──────────────────────┘                 │
│                          │                              │
└──────────────────────────┼──────────────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  GitHub Copilot │
                  │  Chat Engine    │
                  └─────────────────┘
```

## Components

### Core Services

- **AgentLoader** (`agent-loader.ts`)
  - Discovers and parses agent definition files from `resources/agents/` directory
  - Validates agent definitions against schema
  - Extracts YAML frontmatter and markdown content
  - Returns parsed `AgentDefinition` objects

- **ToolRegistry** (`tool-registry.ts`)
  - Manages registration of tool handler functions
  - Executes tools with comprehensive error handling
  - Validates tool parameters and context
  - Provides telemetry and logging

- **ChatParticipantRegistry** (`chat-participant-registry.ts`)
  - Registers agents as VS Code chat participants
  - Handles chat requests from users
  - Bridges user input to tool execution
  - Streams responses back to Copilot Chat

- **ResourceCache** (`resource-cache.ts`)
  - Loads and caches agent resources (prompts, skills, instructions)
  - Provides efficient in-memory access to resources
  - Supports hot-reload on file changes
  - Ensures resources are available during tool execution

### Supporting Components

- **FileWatcher** (`file-watcher.ts`)
  - Monitors resources directory for changes
  - Triggers resource cache reload on file changes
  - Enables hot-reload functionality

- **ErrorFormatter** (`error-formatter.ts`)
  - Standardizes error formatting and categorization
  - Provides user-friendly error messages
  - Supports categorized error reporting
  - Handles telemetry for error tracking

- **Types** (`types.ts`)
  - Comprehensive type definitions for the entire feature
  - Exports interfaces, classes, and type aliases
  - Error classes for specific error scenarios

## Data Flow

### Agent Discovery & Registration

```
resources/agents/
    ├── example-agent.agent.md
    ├── speckit.agent.md
    └── task-planner.agent.md
           │
           ▼
    [AgentLoader.discoverAgents()]
           │
           ├─▶ Read markdown files
           ├─▶ Parse YAML frontmatter
           ├─▶ Create AgentDefinition objects
           └─▶ Return AgentDefinition[]
                   │
                   ▼
    [ChatParticipantRegistry.registerAgent()]
           │
           ├─▶ Register with Copilot Chat API
           ├─▶ Create chat participant
           ├─▶ Wire up request handler
           └─▶ Return Disposable
```

### Tool Execution Flow

```
User Input in Copilot Chat
    │
    └─▶ @agent /command <arguments>
            │
            ▼
    [ChatParticipantRegistry.requestHandler()]
            │
            ├─▶ Parse command
            ├─▶ Extract tool name
            ├─▶ Prepare execution context
            └─▶ Get agent resources
                    │
                    ▼
            [ToolRegistry.execute()]
                    │
                    ├─▶ Find registered tool
                    ├─▶ Validate parameters
                    ├─▶ Call tool handler
                    ├─▶ Handle errors
                    └─▶ Return ToolResponse
                            │
                            ▼
            Format response as markdown
                    │
                    ▼
            Stream to Copilot Chat
                    │
                    ▼
            Display to user
```

### Resource Loading Flow

```
Extension Activation
    │
    ├─▶ [AgentService.initialize()]
            │
            ├─▶ Load agents
            ├─▶ Register chat participants
            │
            ├─▶ [ResourceCache.load()]
            │       │
            │       ├─▶ Discover resource files
            │       ├─▶ Read file contents
            │       ├─▶ Index by type and name
            │       └─▶ Cache in memory
            │
            └─▶ Set up file watcher (if hot-reload enabled)
                    │
                    └─▶ Watch resources directory
                            │
                            ▼
                    File changes detected
                            │
                            └─▶ [ResourceCache.reload()]
                                    │
                                    ├─▶ Re-read changed files
                                    ├─▶ Update cache
                                    └─▶ Notify consumers
```

## Usage Examples

### Registering a Tool Handler

```typescript
import { toolRegistry } from "./services/agent-service";
import { exampleHelloHandler } from "./features/agents/tools/example-tool-handler";

// Register the tool
toolRegistry.register("example.hello", exampleHelloHandler);

// The tool is now available for all agents that reference it in their commands
```

### Creating an Agent Definition File

Create a file at `resources/agents/my-agent.agent.md`:

```markdown
---
id: my-agent
name: My Agent
fullName: My Custom Agent
description: Describes what this agent does
icon: resources/icons/my-agent.png
commands:
  - name: analyze
    description: Analyze a code file
    tool: my.analyze
  - name: generate
    description: Generate code from description
    tool: my.generate
resources:
  prompts: [analysis.prompt.md]
  skills: [code-analysis.skill.md]
---

# My Agent

Documentation about the agent...
```

### Implementing a Tool Handler

```typescript
import type { ToolExecutionParams, ToolResponse } from "../types";

export async function myAnalyzeTool(
	params: ToolExecutionParams
): Promise<ToolResponse> {
	const { input, context, resources, token } = params;

	// Validate input
	if (!input.trim()) {
		throw new Error("Please provide a file path to analyze");
	}

	// Access workspace information
	const workspaceRoot = context.workspace.uri.fsPath;

	// Access agent resources
	const analysisPrompt = resources.prompts.get("analysis.prompt.md");
	const analysisSkills = resources.skills.get("code-analysis.skill.md");

	// Implement logic using VS Code APIs
	const filePath = `${workspaceRoot}/${input}`;

	// Return structured response
	return {
		content: `# Analysis Results\n\nAnalyzed file: ${filePath}`,
		metadata: {
			duration: Date.now(),
		},
	};
}
```

## Configuration

Agent behavior can be configured through VS Code settings:

```json
{
	"gatomia.agents": {
		"resourcesPath": "resources",
		"enableHotReload": true,
		"logLevel": "info"
	}
}
```

### Settings

- **resourcesPath**: Directory path containing agents and resources (default: "resources")
- **enableHotReload**: Enable automatic reload when resource files change (default: true)
- **logLevel**: Logging verbosity level: "debug", "info", "warn", "error" (default: "info")

## Error Handling

The agents feature implements comprehensive error handling:

### Error Categories

1. **ConfigurationError**: Issues with settings or configuration
2. **ValidationError**: Agent definition or parameter validation failures
3. **RegistrationError**: Problems registering agents or tools
4. **ResolutionError**: Unable to find agents, tools, or resources
5. **ExecutionError**: Fatal errors during tool execution
6. **InternalError**: Unexpected system errors

### Error Formatting

Errors are formatted with:
- User-friendly message
- Technical details for debugging
- Actionable suggestions
- Categorization for telemetry

### Error Recovery

- Invalid agents are skipped and logged
- Tool execution errors are caught and wrapped
- Resources are validated before use
- Configuration changes are validated before applying

## Testing

### Unit Tests

Located in `tests/unit/features/agents/`:

- `agent-loader.test.ts`: Agent discovery and parsing
- `tool-registry.test.ts`: Tool registration and execution
- `chat-participant-registry.test.ts`: Chat participant behavior
- `resource-cache.test.ts`: Resource loading and caching
- `error-formatter.test.ts`: Error formatting

### Integration Tests

Located in `tests/integration/agents/`:

- `agent-service-integration.test.ts`: Full service lifecycle
- `tool-execution-integration.test.ts`: End-to-end tool execution
- `resource-hot-reload.test.ts`: File watching and reload

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- tests/unit/features/agents/tool-registry.test.ts

# Watch mode
npm test:watch

# With coverage
npm test:coverage
```

## Performance Considerations

### Startup Performance

- Agent loading: ~1-2s for typical configurations
- Resource loading: <1s for standard resource sets
- Chat participant registration: ~100ms per agent

### Runtime Performance

- Tool execution: <30s for most operations
- Autocomplete suggestions: <200ms typical latency
- Resource lookup: O(1) from in-memory cache

### Optimization Strategies

1. **Lazy Loading**: Resources are loaded once on startup
2. **In-Memory Caching**: Avoids repeated file I/O
3. **Hot Reload**: Only changed resources are re-read
4. **Async Execution**: Tool handlers run without blocking UI

## Security

### Input Validation

- Agent definition files are parsed and validated
- Command parameters are validated before execution
- Resource files are checked for tampering

### Resource Isolation

- Resources are loaded into separate caches
- Tools execute in sandboxed context with limited VS Code APIs
- File system access is restricted to workspace

### Error Handling

- Sensitive information is not exposed in error messages
- Stack traces are logged to output channel only
- Telemetry events are sanitized

## Troubleshooting

### Agents Not Appearing

1. Check `resources/agents/` directory exists
2. Verify agent definition files have `.agent.md` extension
3. Check extension output for parse errors: View → Output → GatomIA
4. Verify GitHub Copilot Chat extension is installed

### Tools Not Executing

1. Verify tool is registered in ToolRegistry
2. Check tool name matches agent definition
3. Check parameters are provided
4. Review error message in Copilot Chat response

### Resources Not Loading

1. Verify resource files in correct subdirectories
2. Check file names match resource references
3. Enable debug logging: `"gatomia.agents.logLevel": "debug"`
4. Check extension output for load errors

### Performance Issues

1. Check number of resources loaded: View → Output → GatomIA
2. Reduce resource directory size if needed
3. Disable hot-reload if not needed
4. Check workspace size and complexity

## Related Documentation

- **Extension Overview**: [../../README.md](../../README.md)
- **Specification**: [../../specs/010-copilot-agents/spec.md](../../specs/010-copilot-agents/spec.md)
- **Implementation Plan**: [../../specs/010-copilot-agents/plan.md](../../specs/010-copilot-agents/plan.md)
- **Example Agent**: [../../resources/agents/example-agent.agent.md](../../resources/agents/example-agent.agent.md)
- **Example Tool Handler**: [tools/example-tool-handler.ts](tools/example-tool-handler.ts)

## Contributing

When adding new capabilities:

1. Add types to `types.ts`
2. Implement functionality in appropriate component
3. Add comprehensive JSDoc comments
4. Create unit tests in `tests/unit/features/agents/`
5. Add integration tests if needed
6. Update this README
7. Run `npm run check` before committing

## API Reference

### Key Exports

- `AgentLoader`: Discovers and parses agent definitions
- `ToolRegistry`: Manages tool registration and execution
- `ChatParticipantRegistry`: Registers agents as chat participants
- `ResourceCache`: Loads and manages agent resources
- `AgentService`: Main service coordinating all components
- `ConfigurationService`: Manages agent configuration
- Error classes: `AgentError`, `ToolExecutionError`, `ResourceError`

### Working with Types

```typescript
import type {
	AgentDefinition,
	ToolHandler,
	ToolExecutionParams,
	ToolResponse,
	AgentResources,
	ToolExecutionContext,
} from "./types";
```
