/**
 * Type definitions for Copilot Agents Integration
 *
 * This module defines all core types, interfaces, and contracts for the agent
 * integration feature. These types ensure type safety across agent loading,
 * tool execution, and resource management.
 */

import type * as vscode from "vscode";

/**
 * Parsed agent definition from markdown file with YAML frontmatter
 */
export interface AgentDefinition {
	/** Unique agent identifier (lowercase alphanumeric with hyphens) */
	id: string;

	/** Short display name */
	name: string;

	/** Full descriptive name */
	fullName: string;

	/** Brief purpose description */
	description: string;

	/** Optional icon path (relative to extension root) */
	icon?: string;

	/** Commands supported by this agent */
	commands: AgentCommand[];

	/** References to agent resources (prompts, skills, instructions) */
	resources: AgentResourceRefs;

	/** Original file path */
	filePath: string;

	/** Markdown documentation content */
	content: string;
}

/**
 * Command definition within an agent
 */
export interface AgentCommand {
	/** Command name (without leading slash) */
	name: string;

	/** Brief command description (shown in autocomplete) */
	description: string;

	/** Name of tool handler to invoke */
	tool: string;

	/** Optional parameter hints or schema */
	parameters?: string;
}

/**
 * References to agent resource files
 */
export interface AgentResourceRefs {
	/** Prompt file names */
	prompts?: string[];

	/** Skill file names */
	skills?: string[];

	/** Instruction file names */
	instructions?: string[];
}

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
	/** Current agent definition */
	agent: AgentDefinition;

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
	[key: string]: unknown;
}

/**
 * Telemetry reporter interface
 */
export interface TelemetryReporter {
	sendTelemetryEvent(
		eventName: string,
		properties?: Record<string, string>,
		measurements?: Record<string, number>
	): void;

	sendTelemetryErrorEvent(
		eventName: string,
		properties?: Record<string, string>,
		measurements?: Record<string, number>
	): void;
}

/**
 * Resource cache interface for managing agent resources
 */
export interface ResourceCache {
	/** Prompt templates indexed by filename */
	prompts: Map<string, string>;

	/** Domain knowledge packages indexed by filename */
	skills: Map<string, string>;

	/** Behavior guidelines indexed by filename */
	instructions: Map<string, string>;

	/**
	 * Load all resources from directory
	 * @param resourcesDir Absolute path to resources directory
	 */
	load(resourcesDir: string): Promise<void>;

	/**
	 * Reload specific changed files
	 * @param changedFiles Array of changed file paths
	 */
	reload(changedFiles: string[]): Promise<void>;

	/**
	 * Get resource by type and name
	 * @param type Resource type
	 * @param name Resource filename
	 */
	get(
		type: "prompt" | "skill" | "instruction",
		name: string
	): string | undefined;
}

/**
 * Validation result for agent definitions
 */
export interface ValidationResult {
	/** Whether validation passed */
	valid: boolean;

	/** Validation error messages */
	errors: string[];
}

/**
 * Custom error class for agent-related errors
 */
export class AgentError extends Error {
	readonly code?: string;

	constructor(message: string, code?: string) {
		super(message);
		this.name = "AgentError";
		this.code = code;
	}
}

/**
 * Custom error class for tool execution errors
 */
export class ToolExecutionError extends Error {
	readonly tool: string;
	readonly cause?: Error;

	constructor(message: string, tool: string, cause?: Error) {
		super(message);
		this.name = "ToolExecutionError";
		this.tool = tool;
		this.cause = cause;
	}
}

/**
 * Custom error class for resource loading errors
 */
export class ResourceError extends Error {
	readonly resourceType: "prompt" | "skill" | "instruction";
	readonly resourceName: string;

	constructor(
		message: string,
		resourceType: "prompt" | "skill" | "instruction",
		resourceName: string
	) {
		super(message);
		this.name = "ResourceError";
		this.resourceType = resourceType;
		this.resourceName = resourceName;
	}
}
