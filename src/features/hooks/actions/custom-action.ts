import type { CustomActionParams, TemplateContext } from "../types";
import { isValidCustomParams } from "../types";
import { expandTemplate } from "../template-utils";
import { sendPromptToChat } from "../../../utils/chat-prompt-runner";

/**
 * Result of a custom action execution
 */
export interface CustomActionExecutionResult {
	success: boolean;
	error?: Error;
	duration?: number;
}

/**
 * Error emitted when the custom action parameters are invalid
 */
export class CustomActionValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CustomActionValidationError";
	}
}

/**
 * Error emitted when the custom agent invocation fails
 */
export class CustomAgentInvocationError extends Error {
	constructor(agentName: string, cause?: Error) {
		const message = cause
			? `Failed to invoke custom agent '${agentName}': ${cause.message}`
			: `Failed to invoke custom agent '${agentName}'`;
		super(message);
		this.name = "CustomAgentInvocationError";
		this.cause = cause;
	}
}

/**
 * Options for configuring the CustomActionExecutor
 */
export interface CustomActionExecutorOptions {
	/**
	 * Custom prompt sender for testing purposes
	 */
	promptSender?: (prompt: string) => Promise<void>;
	/**
	 * Logger for warnings and errors
	 */
	logger?: Pick<typeof console, "warn">;
}

/**
 * CustomActionExecutor - Executes custom agent invocations
 *
 * Custom actions allow users to invoke arbitrary agents with
 * template-expanded arguments. The agent is invoked via the
 * chat interface using the pattern: @agentName arguments
 */
export class CustomActionExecutor {
	private readonly promptSender: (prompt: string) => Promise<void>;
	private readonly logger: Pick<typeof console, "warn">;

	constructor(options?: CustomActionExecutorOptions) {
		this.promptSender = options?.promptSender ?? defaultPromptSender;
		this.logger = options?.logger ?? console;
	}

	/**
	 * Execute a custom action
	 *
	 * @param params - Custom action parameters
	 * @param templateContext - Context for template variable expansion
	 * @returns Execution result
	 */
	async execute(
		params: CustomActionParams,
		templateContext: TemplateContext
	): Promise<CustomActionExecutionResult> {
		const startTime = Date.now();

		try {
			// Validate parameters
			if (!isValidCustomParams(params)) {
				throw new CustomActionValidationError(
					"Invalid custom action parameters: agentName is required and must be alphanumeric with hyphens only"
				);
			}

			// Validate agent name format
			this.validateAgentName(params.agentName);

			// Expand template variables in arguments
			const expandedArguments = this.expandArguments(
				params.arguments,
				templateContext
			);

			// Build the prompt for the custom agent
			const prompt = this.buildAgentPrompt(params.agentName, expandedArguments);

			// Invoke the agent via chat
			await this.invokeAgent(params.agentName, prompt);

			const duration = Date.now() - startTime;

			return {
				success: true,
				duration,
			};
		} catch (error) {
			const err = error as Error;
			this.logger.warn?.(`[CustomActionExecutor] ${err.message}`);

			return {
				success: false,
				error: err,
				duration: Date.now() - startTime,
			};
		}
	}

	/**
	 * Validate the agent name format
	 *
	 * @param agentName - Name of the custom agent
	 * @throws CustomActionValidationError if invalid
	 */
	private validateAgentName(agentName: string): void {
		if (!agentName || agentName.trim().length === 0) {
			throw new CustomActionValidationError("Agent name cannot be empty");
		}

		// Agent name must be alphanumeric with hyphens only
		const validPattern = /^[a-zA-Z0-9-]+$/;
		if (!validPattern.test(agentName)) {
			throw new CustomActionValidationError(
				"Agent name must contain only alphanumeric characters and hyphens"
			);
		}

		// Agent name must not start or end with a hyphen
		if (agentName.startsWith("-") || agentName.endsWith("-")) {
			throw new CustomActionValidationError(
				"Agent name must not start or end with a hyphen"
			);
		}
	}

	/**
	 * Expand template variables in the arguments string
	 *
	 * @param args - Arguments string with possible template variables
	 * @param context - Template context for expansion
	 * @returns Expanded arguments string
	 */
	private expandArguments(
		args: string | undefined,
		context: TemplateContext
	): string | undefined {
		if (!args || args.trim().length === 0) {
			return;
		}

		const expanded = expandTemplate(args, context);
		return expanded.trim().length > 0 ? expanded.trim() : undefined;
	}

	/**
	 * Build the prompt string for invoking the custom agent
	 *
	 * @param agentName - Name of the agent to invoke
	 * @param args - Expanded arguments (optional)
	 * @returns Formatted prompt string
	 */
	private buildAgentPrompt(agentName: string, args?: string): string {
		// Build prompt in the format: @agentName arguments
		const mention = `@${agentName}`;

		if (args && args.trim().length > 0) {
			return `${mention} ${args.trim()}`;
		}

		return mention;
	}

	/**
	 * Invoke the custom agent via the chat interface
	 *
	 * @param agentName - Name of the agent (for error reporting)
	 * @param prompt - Full prompt to send
	 * @throws CustomAgentInvocationError on failure
	 */
	private async invokeAgent(agentName: string, prompt: string): Promise<void> {
		try {
			await this.promptSender(prompt);
		} catch (error) {
			throw new CustomAgentInvocationError(agentName, error as Error);
		}
	}

	/**
	 * Check if a custom action is valid
	 *
	 * @param params - Parameters to validate
	 * @returns True if the action is valid
	 */
	isValid(params: CustomActionParams): boolean {
		try {
			if (!isValidCustomParams(params)) {
				return false;
			}
			this.validateAgentName(params.agentName);
			return true;
		} catch {
			return false;
		}
	}
}

/**
 * Default prompt sender using the chat prompt runner
 */
const defaultPromptSender = async (prompt: string): Promise<void> => {
	await sendPromptToChat(prompt, {
		instructionType: "runPrompt",
	});
};
