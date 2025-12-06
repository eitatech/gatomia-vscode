import type { ExecutionContext, AgentActionParams } from "../types";
import { isValidAgentParams } from "../types";
import { sendPromptToChat } from "../../../utils/chat-prompt-runner";

/**
 * Regex pattern for validating operation format
 */
const OPERATION_FORMAT_PATTERN = /^[a-z0-9-_]+$/i;

/**
 * ExecutionResult - Result of action execution
 */
export interface ExecutionResult {
	success: boolean;
	error?: Error;
	duration?: number;
}

/**
 * AgentActionExecutor - Executes agent commands (SpecKit/OpenSpec)
 *
 * Responsible for validating and executing agent commands via sendPromptToChat
 */
export class AgentActionExecutor {
	/**
	 * Execute an agent action
	 *
	 * @param params - Agent action parameters
	 * @param context - Execution context (optional)
	 * @returns Execution result
	 */
	async execute(
		params: AgentActionParams,
		context?: ExecutionContext
	): Promise<ExecutionResult> {
		const startTime = Date.now();

		try {
			// Validate parameters
			if (!isValidAgentParams(params)) {
				throw new Error(
					"Invalid agent action parameters: command is required and must start with /speckit. or /openspec."
				);
			}

			// Validate command format
			this.validateCommand(params.command);

			// Execute command via sendPromptToChat
			await sendPromptToChat(params.command, {
				instructionType: "runPrompt",
			});

			const duration = Date.now() - startTime;

			return {
				success: true,
				duration,
			};
		} catch (error) {
			const duration = Date.now() - startTime;

			return {
				success: false,
				error: error as Error,
				duration,
			};
		}
	}

	/**
	 * Validate command format
	 *
	 * @param command - Agent command to validate
	 * @throws Error if command is invalid
	 */
	private validateCommand(command: string): void {
		// Check command is not empty
		if (!command || command.trim().length === 0) {
			throw new Error("Command cannot be empty");
		}

		// Check command starts with / (slash command)
		if (!command.startsWith("/")) {
			throw new Error('Command must start with "/" (slash command)');
		}

		// Check command is for supported agents
		const supportedPrefixes = ["/speckit.", "/openspec."];
		const isSupported = supportedPrefixes.some((prefix) =>
			command.startsWith(prefix)
		);

		if (!isSupported) {
			throw new Error(
				`Unsupported agent command. Must start with ${supportedPrefixes.join(" or ")}`
			);
		}

		// Validate command structure (should have agent.operation format)
		const parts = command.slice(1).split("."); // Remove leading / and split
		if (parts.length < 2) {
			throw new Error(
				"Invalid command format. Expected format: /agent.operation"
			);
		}

		const agent = parts[0];
		const operation = parts[1];

		// Validate agent
		const supportedAgents = ["speckit", "openspec"];
		if (!supportedAgents.includes(agent)) {
			throw new Error(
				`Unsupported agent: ${agent}. Supported agents: ${supportedAgents.join(", ")}`
			);
		}

		// Validate operation is not empty
		if (!operation || operation.trim().length === 0) {
			throw new Error("Operation cannot be empty");
		}

		// Validate operation format (alphanumeric, hyphens, underscores only)
		if (!OPERATION_FORMAT_PATTERN.test(operation)) {
			throw new Error(
				"Operation must contain only alphanumeric characters, hyphens, and underscores"
			);
		}
	}

	/**
	 * Check if a command is supported by this executor
	 *
	 * @param command - Command to check
	 * @returns True if command is supported
	 */
	isSupported(command: string): boolean {
		try {
			this.validateCommand(command);
			return true;
		} catch {
			return false;
		}
	}
}
