/**
 * Built-in help command handler for all agents
 * Provides documentation about available commands
 */

import type { AgentDefinition } from "../types";
import {
	formatGeneralHelp,
	formatCommandHelp,
	formatCommandNotFound,
} from "./help-formatter";

const COMMAND_PREFIX_PATTERN = /^\//;

export interface HelpHandlerParams {
	input: string;
	context: {
		agent: AgentDefinition;
	};
	telemetry?: {
		sendEvent: (eventName: string, properties?: Record<string, any>) => void;
	};
}

export interface HelpResult {
	content: string;
}

/**
 * Help handler that displays agent documentation
 * T067 - Implement built-in /help tool handler
 * T069-T070 - Uses help formatter for consistent formatting
 * T071 - Add telemetry for help command usage
 */
export function helpHandler(params: HelpHandlerParams): HelpResult {
	const agent = params.context.agent;
	const input = params.input.trim();
	const commandName = input
		? input.replace(COMMAND_PREFIX_PATTERN, "").trim()
		: "";

	// T071 - Send telemetry
	if (params.telemetry) {
		params.telemetry.sendEvent("agent.help.invoked", {
			agentId: agent.id,
			commandName: commandName || "general",
			hasSpecificCommand: Boolean(commandName),
		});
	}

	if (!input) {
		const help = formatGeneralHelp(agent);
		return { content: help.content };
	}

	const help = formatCommandHelp(agent, commandName);

	if (!help) {
		const notFound = formatCommandNotFound(agent, commandName);
		return { content: notFound.content };
	}

	return { content: help.content };
}
