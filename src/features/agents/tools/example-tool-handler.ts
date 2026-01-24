/**
 * Example tool handler for demonstration purposes
 * Shows the pattern for implementing agent tool handlers
 *
 * T083 - Create example tool handler implementation with inline documentation
 */

import type { AgentDefinition } from "../types";

/**
 * Parameters passed to tool handlers by the agent system
 */
export interface ExampleToolParams {
	/** The user input or command argument */
	input: string;
	/** Context containing the agent definition and extension state */
	context: {
		agent: AgentDefinition;
		extensionPath?: string;
	};
	/** Optional telemetry sender for tracking usage */
	telemetry?: {
		sendEvent: (eventName: string, properties?: Record<string, any>) => void;
	};
}

/**
 * Tool handler result type
 * All tool handlers must return content that can be displayed to the user
 */
export interface ToolResult {
	/** Markdown-formatted content to display to the user */
	content: string;
	/** Optional file path if the tool created/modified a file */
	filePath?: string;
	/** Optional error message if the tool failed */
	error?: string;
}

/**
 * Example hello handler
 * Demonstrates a simple tool that returns a greeting message
 *
 * Usage: Call this function with the required parameters:
 * ```typescript
 * const result = exampleHelloHandler({
 *   input: "World",
 *   context: { agent: agentDefinition }
 * });
 * // Returns: { content: "# Hello, World!\n\nThis is a greeting from the Example Agent." }
 * ```
 */
export function exampleHelloHandler(params: ExampleToolParams): ToolResult {
	const { input, context, telemetry } = params;
	const target = input.trim() || "World";
	const agentName = context.agent.name;

	// Send telemetry event
	if (telemetry) {
		telemetry.sendEvent("example.tool.hello.invoked", {
			agentId: context.agent.id,
			targetLength: target.length,
		});
	}

	// Generate response
	const content = `# Hello, ${target}!

This is a greeting from the **${agentName}** agent.

## About This Tool

This is an example tool handler that demonstrates the pattern for implementing agent tools in the GatomIA extension.

### Tool Handler Characteristics:
- Receives parameters including user input and agent context
- Can access agent metadata and configuration
- Returns structured results with markdown content
- Optionally sends telemetry events
- Supports optional telemetry for usage tracking

### Example Tool Handlers

The GatomIA extension provides several built-in tool handlers:
- **help**: Shows available commands for the agent
- **example.hello**: This handler - demonstrates a simple greeting
- **agent.help**: Built-in help functionality for all agents

### Creating Your Own Tool Handler

To create a custom tool handler:

1. Define a function that accepts \`ToolParams\`
2. Implement your tool logic
3. Return a \`ToolResult\` object with markdown content
4. Register the tool with the \`ToolRegistry\`

\`\`\`typescript
export function myCustomTool(params: ToolParams): ToolResult {
  // Your implementation
  return { content: "# Result" };
}

// Register in agent service
toolRegistry.register("my.tool.id", myCustomTool);
\`\`\`

---

**Learn more**: Check the [Features/Agents README](../../../features/agents/README.md) for architecture details.`;

	return { content };
}

/**
 * Example tool demonstrating error handling
 *
 * Usage: Shows how to properly handle and report errors
 */
export function exampleErrorHandler(params: ExampleToolParams): ToolResult {
	const { input, telemetry } = params;

	// Validate input
	if (!input || input.trim().length === 0) {
		if (telemetry) {
			telemetry.sendEvent("example.tool.error.validation_failed", {
				reason: "empty_input",
			});
		}

		return {
			error: "No input provided",
			content: "# Error\n\nPlease provide input for this tool.",
		};
	}

	// Simulate processing
	const content = `# Processing Result

Your input was: **${input}**

This demonstrates error handling patterns in tool handlers.`;

	return { content };
}

/**
 * Example tool demonstrating file operations
 *
 * Usage: Shows how to handle tools that create or modify files
 */
export function exampleFileOperationHandler(
	params: ExampleToolParams
): ToolResult {
	const { context } = params;

	if (!context.extensionPath) {
		return {
			error: "Extension path not available",
			content:
				"# Error\n\nCannot complete file operation without extension path.",
		};
	}

	// In a real tool, this would create/modify a file
	const examplePath = `${context.extensionPath}/example-output.md`;

	const content = `# File Operation Completed

**File path**: \`${examplePath}\`

This demonstrates how tool handlers can:
- Access file system paths from agent context
- Report file operations back to the user
- Provide file references in results

### File Handler Patterns

1. **Read files**: Use \`fs\` module with proper error handling
2. **Write files**: Check parent directory exists before writing
3. **Report paths**: Return file path in ToolResult for UI linking
4. **Handle errors**: Return error message if operation fails

For real implementations, consider using VS Code's FileSystem API for better reliability.`;

	return {
		content,
		filePath: examplePath,
	};
}
