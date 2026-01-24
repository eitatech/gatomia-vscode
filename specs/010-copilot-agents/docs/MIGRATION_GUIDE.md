# Migration Guide: Copilot Agents Integration

This guide helps you migrate your agent workflows and integrate the new Copilot Agents features into your GatomIA setup.

**Target Version**: GatomIA v0.31.0+

## Overview

The Copilot Agents Integration brings unprecedented capability to GatomIA, enabling structured agent discovery, tool execution, and resource management directly within GitHub Copilot Chat.

**Key Benefits**:
- 🎯 **Auto-discovery**: Agents are automatically discovered from `resources/agents/`
- 🛠️ **Tool execution**: Execute agent tools with comprehensive error handling
- 📚 **Resource management**: Automatic caching and hot-reload of prompts, skills, instructions
- ⚙️ **Configuration-driven**: Customize behavior through VS Code settings
- 📊 **Telemetry**: Built-in instrumentation for monitoring and debugging

## What's New

### Agent System Structure

Agents are now discovered from `resources/agents/` directory using YAML frontmatter + markdown format:

```markdown
---
id: my-agent
name: Display Name
fullName: Full Name
description: What this agent does
commands:
  - name: command-name
    description: What command does
    tool: tool.handler.id
resources:
  prompts: [file1.prompt.md]
  skills: [file2.skill.md]
  instructions: [file3.instructions.md]
---

# Agent Documentation

Markdown content here...
```

### Tool Handler Pattern

Tool handlers follow a standardized pattern:

```typescript
import type { ToolExecutionParams, ToolResponse } from "../types";

export async function myTool(
	params: ToolExecutionParams
): Promise<ToolResponse> {
	const { input, context, resources } = params;

	// Implementation
	return {
		content: "# Result\n\nMarkdown content here",
		metadata: { duration: 100 },
	};
}
```

### Configuration

New `gatomia.agents` settings available in VS Code Preferences:

```json
{
	"gatomia.agents": {
		"resourcesPath": "resources",
		"enableHotReload": true,
		"logLevel": "info"
	}
}
```

## Migration Paths

### Path 1: Minimal Setup (Recommended for New Projects)

**Timeline**: 30 minutes

**Steps**:

1. **Install Extension**
   - Update GatomIA to v0.31.0+
   - Ensure GitHub Copilot Chat is installed

2. **Activate Agents**
   - The extension auto-discovers agents in `resources/agents/`
   - No configuration needed—uses `resources/` directory by default

3. **Test Agent Discovery**
   - Open GitHub Copilot Chat (Ctrl+Shift+I)
   - Type `@` and verify agents appear in suggestions
   - Test: `@example-agent /hello`

4. **Begin Using Agents**
   - All agents from `resources/agents/*.agent.md` are immediately available
   - No code changes required for existing agents

### Path 2: Custom Agents (30-60 minutes)

**Timeline**: 1-2 hours

**Prerequisites**: Completed Path 1

**Steps**:

1. **Create Agent Definition**
   - Create `resources/agents/my-custom-agent.agent.md`
   - Reference the [example agent](../../resources/agents/example-agent.agent.md)
   - Define agent metadata, description, and commands

2. **Implement Tool Handlers**
   - Create `src/features/agents/tools/my-tools.ts`
   - Follow the [example tool handler](../../src/features/agents/tools/example-tool-handler.ts) pattern
   - Implement your tool logic with proper error handling

3. **Register Tools**
   - Add tool registration in `src/services/agent-service.ts`
   - Example:
     ```typescript
     toolRegistry.register("my.tool.id", myToolHandler);
     ```

4. **Create Agent Resources**
   - Add prompts to `resources/prompts/`
   - Add skills to `resources/skills/`
   - Add instructions to `resources/instructions/`
   - Reference them in agent definition

5. **Test Your Agent**
   - Reload VS Code window (Cmd+R / Ctrl+Shift+R)
   - Open Copilot Chat
   - Type `@my-custom-agent` and test your commands

### Path 3: Full Integration with Automation (1-2 hours)

**Timeline**: 2-3 hours

**Prerequisites**: Completed Path 2

**Steps**:

1. **Create Hook Configuration**
   - Open Hooks explorer in VS Code
   - Create automation hooks that trigger after agent operations
   - Map agent outputs to MCP actions (create issues, send notifications)

2. **Configure Tool Execution Callbacks**
   - Set up telemetry handlers for monitoring
   - Configure error notifications
   - Track execution metrics

3. **Test Automation**
   - Execute agent commands that trigger hooks
   - Verify MCP actions execute correctly
   - Monitor logs for issues

4. **Monitor Performance**
   - Check tool execution times in output channel
   - Verify agent registration completes in <5s
   - Ensure autocomplete latency is <200ms

## Configuration Migration

### Default Behavior (No Changes Needed)

The new agent system works with default configuration:

| Setting | Default | Behavior |
|---------|---------|----------|
| `gatomia.agents.resourcesPath` | `resources` | Discover agents from `resources/agents/` |
| `gatomia.agents.enableHotReload` | `true` | Auto-reload resource files on changes |
| `gatomia.agents.logLevel` | `info` | Balanced logging for most scenarios |

### Custom Configuration

To customize agent behavior:

1. Open VS Code Settings (Cmd+, / Ctrl+,)
2. Search for "GatomIA Agents"
3. Modify settings:

**Example: Custom resources directory**
```json
{
	"gatomia.agents.resourcesPath": "my-agents"
}
```

**Example: Disable hot-reload**
```json
{
	"gatomia.agents.enableHotReload": false
}
```

**Example: Debug logging**
```json
{
	"gatomia.agents.logLevel": "debug"
}
```

## Troubleshooting

### Agents Not Appearing

**Symptom**: No agents show when typing `@` in Copilot Chat

**Checklist**:
1. ✅ GitHub Copilot Chat extension is installed and enabled
2. ✅ `resources/agents/` directory exists
3. ✅ Agent files have `.agent.md` extension
4. ✅ Agent files have valid YAML frontmatter
5. ✅ Extension output shows "Initialization complete"

**Debug Steps**:
```bash
# Check extension output
View → Output → GatomIA

# Look for messages like:
# [AgentService] Loaded 3 agents in 150ms
# [ChatParticipantRegistry] Registered agent: example-agent
```

### Tools Not Executing

**Symptom**: Agent command executes but returns error

**Checklist**:
1. ✅ Tool is registered in `ToolRegistry`
2. ✅ Tool name matches agent definition (e.g., `example.hello` in YAML)
3. ✅ Tool handler exports correct type: `async function(...): Promise<ToolResponse>`
4. ✅ Handler is registered before agent registration

**Debug Steps**:
1. Enable debug logging:
   ```json
   {
     "gatomia.agents.logLevel": "debug"
   }
   ```
2. Check View → Output → GatomIA for detailed messages
3. Look for error messages about tool registration

### Resources Not Loading

**Symptom**: Agent resources (prompts, skills) not available

**Checklist**:
1. ✅ Resource files in correct subdirectory (`resources/prompts/`, etc.)
2. ✅ File names match agent definition (e.g., `example.prompt.md`)
3. ✅ File extensions match: `.prompt.md`, `.skill.md`, `.instructions.md`
4. ✅ `resourcesPath` setting matches your directory structure

**Debug Steps**:
1. Check extension output for resource loading messages:
   ```
   [AgentService] Loading resources from: /path/to/resources
   [AgentService] Loaded 12 resources in 234ms
   ```

### Hot-Reload Not Working

**Symptom**: Changes to resource files don't take effect

**Checklist**:
1. ✅ `gatomia.agents.enableHotReload` is `true`
2. ✅ You're editing files within `resourcesPath` directory
3. ✅ File changes are actually saved to disk
4. ✅ Extension output shows file watcher initialized

**Workaround**: Reload VS Code window (Cmd+R / Ctrl+Shift+R)

## Performance Benchmarks

Expected performance after migration:

| Operation | Target | Typical | Maximum |
|-----------|--------|---------|---------|
| Agent registration | <1s each | 100-200ms | <5s total |
| Tool execution | <30s | 5-15s typical | 30-60s max |
| Autocomplete | <200ms | 50-150ms | <200ms |
| Resource lookup | <1ms | <1ms | <5ms |

**Monitor performance** via View → Output → GatomIA output channel.

## Common Patterns

### Pattern 1: Simple Query Agent

```markdown
---
id: query-agent
name: Query Handler
description: Handles simple queries
commands:
  - name: search
    description: Search for information
    tool: query.search
---

# Query Agent

Handles user queries...
```

Tool handler:
```typescript
export async function querySearchHandler(
	params: ToolExecutionParams
): Promise<ToolResponse> {
	const results = await searchIndex(params.input);
	return { content: formatResults(results) };
}
```

### Pattern 2: Analysis Agent

```markdown
---
id: analysis-agent
name: Code Analyzer
description: Analyzes code and provides insights
commands:
  - name: analyze
    description: Analyze code structure
    tool: analysis.examine
resources:
  skills: [code-analysis.skill.md]
---
```

Tool handler:
```typescript
export async function analysisExamineHandler(
	params: ToolExecutionParams
): Promise<ToolResponse> {
	const { input, resources } = params;
	const analysisSkill = resources.skills.get("code-analysis.skill.md");
	const analysis = performAnalysis(input, analysisSkill);
	return { content: formatAnalysis(analysis) };
}
```

### Pattern 3: Automated Workflow Agent

```markdown
---
id: workflow-agent
name: Workflow Executor
description: Automates project workflows
commands:
  - name: run-tests
    description: Run test suite
    tool: workflow.run_tests
  - name: deploy
    description: Deploy to production
    tool: workflow.deploy
resources:
  instructions: [deployment-guide.instructions.md]
---
```

## Post-Migration Checklist

After completing your migration, verify:

- [ ] All agents discover correctly in Copilot Chat
- [ ] Agent commands execute without errors
- [ ] Resource access works (prompts, skills, instructions)
- [ ] Hot-reload works (optional but recommended)
- [ ] Performance meets benchmarks
- [ ] Error messages are clear and actionable
- [ ] Logging at appropriate level for your use case
- [ ] Documentation updated for your team

## Need Help?

**Resources**:
- 📖 [Extension README](../../README.md)
- 🏗️ [Architecture Guide](../../src/features/agents/README.md)
- 💡 [Example Agent](../../resources/agents/example-agent.agent.md)
- 🔧 [Example Tool Handler](../../src/features/agents/tools/example-tool-handler.ts)
- 📋 [Feature Specification](../../specs/010-copilot-agents/spec.md)

**Report Issues**:
- GitHub Issues: [github.com/eitatech/gatomia-vscode/issues](https://github.com/eitatech/gatomia-vscode/issues)

## Version Support

| Version | Status | Agent Support |
|---------|--------|---------------|
| v0.30.0 | Legacy | Not supported |
| v0.31.0+ | Current | ✅ Fully supported |

## What's Changed

### Breaking Changes

None - The agent system is additive and non-breaking.

### New APIs

- `AgentLoader`: Discovers and loads agents
- `ToolRegistry`: Registers and executes tools
- `ChatParticipantRegistry`: Manages chat participants
- `ResourceCache`: Loads and caches resources
- `ConfigurationService`: Type-safe configuration

### Deprecations

None - All existing GatomIA features continue to work.

## Timeline

- **v0.31.0** (January 24, 2026): Initial agent integration release
- **Planned**: Enhanced agent templates, advanced scheduling, agent composition

---

**Happy migrating! 🚀**
