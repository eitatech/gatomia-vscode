/**
 * Error Formatter
 * Converts technical errors into user-friendly, actionable messages
 * T058 - Error formatter implementation
 */

import { AgentError, ToolExecutionError, ResourceError } from "./types";

/**
 * Error classification for telemetry and logging
 */
export const ErrorCategory = {
	VALIDATION: "validation",
	RESOURCE: "resource",
	EXECUTION: "execution",
	CANCELLATION: "cancellation",
	TIMEOUT: "timeout",
	UNKNOWN: "unknown",
} as const;

export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

/**
 * Formatted error result with user message and metadata
 */
export interface FormattedError {
	/** User-friendly error message */
	userMessage: string;

	/** Technical error details for logging */
	technicalDetails: string;

	/** Error category for telemetry */
	category: ErrorCategory;

	/** Optional actionable guidance */
	actionableGuidance?: string;

	/** Error code if available */
	code?: string;
}

/**
 * Format error for display and logging
 * @param error The error to format
 * @param context Additional context (tool name, agent name, etc.)
 * @returns Formatted error with user message and metadata
 */
export function formatError(
	error: Error,
	context?: { tool?: string; agent?: string }
): FormattedError {
	// Handle custom error types
	if (error instanceof ToolExecutionError) {
		return formatToolExecutionError(error, context);
	}

	if (error instanceof ResourceError) {
		return formatResourceError(error, context);
	}

	if (error instanceof AgentError) {
		return formatAgentError(error, context);
	}

	// Handle generic errors
	return formatGenericError(error, context);
}

/**
 * Format ToolExecutionError
 */
function formatToolExecutionError(
	error: ToolExecutionError,
	context?: { tool?: string; agent?: string }
): FormattedError {
	const toolName = error.tool || context?.tool || "unknown tool";

	// Check if the cause is a known error type
	if (error.cause) {
		if (error.cause instanceof ResourceError) {
			return formatResourceError(error.cause, { ...context, tool: toolName });
		}

		if (error.cause instanceof AgentError) {
			return formatAgentError(error.cause, { ...context, tool: toolName });
		}
	}

	const category = categorizeError(error);
	const userMessage = `Command execution failed: ${sanitizeMessage(error.message)}`;
	const actionableGuidance = getActionableGuidance(category, {
		tool: toolName,
		cause: error.cause?.message,
	});

	return {
		userMessage,
		technicalDetails: `Tool: ${toolName}, Error: ${error.message}, Cause: ${error.cause?.message || "none"}`,
		category,
		actionableGuidance,
	};
}

/**
 * Format ResourceError
 */
function formatResourceError(
	error: ResourceError,
	context?: { tool?: string; agent?: string }
): FormattedError {
	const resourceType = error.resourceType;
	const resourceName = error.resourceName;
	const toolInfo = context?.tool ? ` in ${context.tool}` : "";

	const userMessage = `Missing ${resourceType}: ${resourceName}${toolInfo}`;
	const actionableGuidance = `Ensure the file exists in the resources/${resourceType}s/ directory and is properly configured in the agent definition.`;

	return {
		userMessage,
		technicalDetails: `ResourceError: Type=${resourceType}, Name=${resourceName}, Tool=${context?.tool || "unknown"}`,
		category: ErrorCategory.RESOURCE,
		actionableGuidance,
	};
}

/**
 * Format AgentError
 */
function formatAgentError(
	error: AgentError,
	context?: { tool?: string; agent?: string }
): FormattedError {
	const category = categorizeAgentError(error);
	let userMessage = sanitizeMessage(error.message);
	let actionableGuidance: string | undefined;

	switch (error.code) {
		case "CANCELLED":
			userMessage = "Operation cancelled";
			actionableGuidance = undefined; // User initiated, no action needed
			break;

		case "TIMEOUT":
			userMessage = "Operation timed out";
			actionableGuidance =
				"The operation took too long to complete. Try again or simplify your request.";
			break;

		case "CONFIG_ERROR":
			userMessage = `Configuration error: ${sanitizeMessage(error.message)}`;
			actionableGuidance =
				"Check the agent definition file for correct configuration.";
			break;

		default:
			actionableGuidance =
				"Please try again or contact support if the issue persists.";
	}

	return {
		userMessage,
		technicalDetails: `AgentError: Code=${error.code || "none"}, Message=${error.message}`,
		category,
		actionableGuidance,
		code: error.code,
	};
}

/**
 * Format generic error
 */
function formatGenericError(
	error: Error,
	context?: { tool?: string; agent?: string }
): FormattedError {
	const category = ErrorCategory.UNKNOWN;
	const userMessage = `An unexpected error occurred: ${sanitizeMessage(error.message)}`;
	const actionableGuidance =
		"Please try again. If the problem persists, check the output logs for details.";

	return {
		userMessage,
		technicalDetails: `GenericError: ${error.name}: ${error.message}, Stack: ${error.stack || "none"}`,
		category,
		actionableGuidance,
	};
}

/**
 * Categorize error by type and message content
 */
function categorizeError(error: Error): ErrorCategory {
	const message = error.message.toLowerCase();

	if (message.includes("cancel")) {
		return ErrorCategory.CANCELLATION;
	}

	if (message.includes("timeout") || message.includes("timed out")) {
		return ErrorCategory.TIMEOUT;
	}

	if (
		message.includes("invalid") ||
		message.includes("validation") ||
		message.includes("required")
	) {
		return ErrorCategory.VALIDATION;
	}

	if (message.includes("resource") || message.includes("not found")) {
		return ErrorCategory.RESOURCE;
	}

	return ErrorCategory.EXECUTION;
}

/**
 * Categorize AgentError by code
 */
function categorizeAgentError(error: AgentError): ErrorCategory {
	switch (error.code) {
		case "CANCELLED":
			return ErrorCategory.CANCELLATION;
		case "TIMEOUT":
			return ErrorCategory.TIMEOUT;
		case "CONFIG_ERROR":
			return ErrorCategory.VALIDATION;
		default:
			return ErrorCategory.EXECUTION;
	}
}

/**
 * Get actionable guidance based on error category
 */
function getActionableGuidance(
	category: ErrorCategory,
	details?: { tool?: string; cause?: string }
): string {
	switch (category) {
		case ErrorCategory.VALIDATION:
			return "Check your input and try again with the correct format.";

		case ErrorCategory.RESOURCE:
			return "Ensure all required resources are available and properly configured.";

		case ErrorCategory.EXECUTION:
			if (details?.cause) {
				return `Error details: ${details.cause}. Please review and try again.`;
			}
			return "The operation failed. Check the logs for details and try again.";

		case ErrorCategory.CANCELLATION:
			return ""; // No guidance needed for user-initiated cancellation

		case ErrorCategory.TIMEOUT:
			return "The operation took too long. Try again or simplify your request.";

		default:
			return "An unexpected error occurred. Check the logs for details.";
	}
}

/**
 * Sanitize error message for display to users
 * Removes technical details and stack traces
 */
const ERROR_PREFIX_PATTERN = /^(Error:|TypeError:|ReferenceError:)\s*/i;

function sanitizeMessage(message: string): string {
	// Remove stack traces
	const lines = message.split("\n");
	const firstLine = lines[0];

	// Remove file paths
	let sanitized = firstLine.replace(/\/[^\s]+/g, "[file]");

	// Remove common error prefixes
	sanitized = sanitized.replace(ERROR_PREFIX_PATTERN, "");

	// Limit length
	if (sanitized.length > 200) {
		sanitized = `${sanitized.substring(0, 197)}...`;
	}

	return sanitized;
}

/**
 * Get error severity level for logging
 */
export function getErrorSeverity(
	category: ErrorCategory
): "error" | "warning" | "info" {
	switch (category) {
		case ErrorCategory.CANCELLATION:
			return "info";

		case ErrorCategory.VALIDATION:
		case ErrorCategory.RESOURCE:
			return "warning";

		default:
			return "error";
	}
}
