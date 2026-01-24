/**
 * Tool Handler Interface
 *
 * Defines the contract for tool implementations that execute agent commands.
 */

import * as vscode from "vscode";

/**
 * Tool handler function signature
 */
export type ToolHandler = (
	params: ToolExecutionParams
) => Promise<ToolResponse>;

/**
 * Parameters passed to tool handlers during execution
 */
export interface ToolExecutionParams {
	/** User input after command (free-text string for custom parsing) */
	input: string;

	/** Execution context with workspace info and VS Code APIs */
	context: ToolExecutionContext;

	/** Agent resources (prompts, skills, instructions) loaded from cache */
	resources: AgentResources;

	/** Cancellation token for long-running operations */
	token: vscode.CancellationToken;
}

/**
 * Runtime context provided to tool handlers
 */
export interface ToolExecutionContext {
	/** Workspace information */
	workspace: {
		/** Workspace root URI */
		uri: vscode.Uri;
		/** Workspace name */
		name: string;
		/** All workspace folders */
		folders: vscode.WorkspaceFolder[];
	};

	/** VS Code APIs */
	vscode: {
		window: typeof vscode.window;
		workspace: typeof vscode.workspace;
		commands: typeof vscode.commands;
	};

	/** Chat context (history, references) */
	chatContext: vscode.ChatContext;

	/** Extension output channel for logging */
	outputChannel: vscode.OutputChannel;

	/** Telemetry reporter for metrics */
	telemetry: TelemetryReporter;
}

/**
 * Loaded agent resources available during tool execution
 */
export interface AgentResources {
	/** Prompt templates indexed by filename */
	prompts: Map<string, string>;

	/** Domain knowledge packages indexed by filename */
	skills: Map<string, string>;

	/** Behavior guidelines indexed by filename */
	instructions: Map<string, string>;
}

/**
 * Structured response returned by tool handlers
 */
export interface ToolResponse {
	/** Markdown-formatted content to display in chat */
	content: string;

	/** Optional file references for navigation */
	files?: FileReference[];

	/** Optional metadata for telemetry and debugging */
	metadata?: ResponseMetadata;
}

/**
 * Reference to a file created, modified, or referenced by tool
 */
export interface FileReference {
	/** File URI */
	uri: vscode.Uri;

	/** Display label (defaults to filename if omitted) */
	label?: string;

	/** Action performed on file */
	action?: "created" | "modified" | "deleted";
}

/**
 * Optional metadata about tool execution
 */
export interface ResponseMetadata {
	/** Execution duration in milliseconds */
	duration?: number;

	/** LLM tokens used (if applicable) */
	tokensUsed?: number;

	/** Custom metadata fields */
	[key: string]: any;
}

/**
 * Telemetry reporter interface
 */
export interface TelemetryReporter {
	sendTelemetryEvent(
		eventName: string,
		properties?: { [key: string]: string },
		measurements?: { [key: string]: number }
	): void;
	sendTelemetryErrorEvent(
		eventName: string,
		properties?: { [key: string]: string },
		measurements?: { [key: string]: number }
	): void;
}

/**
 * Example tool handler implementation
 */
export const exampleToolHandler: ToolHandler = async (params) => {
	const { input, context, resources, token } = params;

	// Check for cancellation
	if (token.isCancellationRequested) {
		throw new Error("Operation cancelled");
	}

	// Access resources
	const prompt = resources.prompts.get("example.prompt.md");
	if (!prompt) {
		throw new Error("Required prompt not found");
	}

	// Perform operation
	context.outputChannel.appendLine(`Executing with input: ${input}`);

	// Return response
	return {
		content: "✅ Operation completed successfully",
		files: [
			{
				uri: vscode.Uri.file("/path/to/file"),
				label: "Generated file",
				action: "created",
			},
		],
		metadata: {
			duration: 150,
		},
	};
};
