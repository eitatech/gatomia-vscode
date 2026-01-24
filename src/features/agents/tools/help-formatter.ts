/**
 * Help content formatter
 * T069-T070 - Format help content and usage examples
 */

import type { AgentDefinition, AgentCommand } from "../types";

export interface FormattedHelp {
	title: string;
	content: string;
}

/**
 * Format general help showing all available commands
 * T069 - Implement help content formatter
 */
export function formatGeneralHelp(agent: AgentDefinition): FormattedHelp {
	const commandList = agent.commands
		.filter((cmd) => cmd.name !== "help")
		.map((cmd) => formatCommandListItem(cmd))
		.join("\n\n");

	const content = `# ${agent.fullName}

${agent.description}

## Available Commands

${commandList}

---

**Tip**: Type \`@${agent.id} /help <command>\` for detailed help on a specific command.`;

	return {
		title: `${agent.name} - Help`,
		content,
	};
}

/**
 * Format a command list item
 */
function formatCommandListItem(command: AgentCommand): string {
	const params = command.parameters
		? ` ${formatParameters(command.parameters)}`
		: "";

	return `### /${command.name}${params}
${command.description}`;
}

/**
 * Format command parameters
 * T070 - Add command usage examples to help output
 */
function formatParameters(
	parameters: string | Record<string, unknown>[]
): string {
	if (typeof parameters === "string") {
		return parameters;
	}

	if (Array.isArray(parameters)) {
		return parameters
			.map((param) => {
				const name = String(param.name || "");
				const required = param.required === true;
				return required ? `<${name}>` : `[${name}]`;
			})
			.join(" ");
	}

	return "";
}

/**
 * Format help for a specific command
 */
export function formatCommandHelp(
	agent: AgentDefinition,
	commandName: string
): FormattedHelp | null {
	const command = agent.commands.find((cmd) => cmd.name === commandName);

	if (!command) {
		return null;
	}

	const helpContent = extractCommandDocumentation(agent, commandName);

	return {
		title: `${agent.name} - /${command.name}`,
		content: `# ${agent.name} - /${command.name}

${helpContent}`,
	};
}

/**
 * Extract command documentation from agent markdown content
 * T070 - Includes usage examples
 */
function extractCommandDocumentation(
	agent: AgentDefinition,
	commandName: string
): string {
	const contentLines = agent.content.split("\n");
	const commandSection: string[] = [];
	let capturing = false;

	for (const line of contentLines) {
		if (line.startsWith(`### /${commandName}`)) {
			capturing = true;
		}

		if (capturing) {
			if (line.startsWith("### /") && !line.startsWith(`### /${commandName}`)) {
				break;
			}
			commandSection.push(line);
		}
	}

	if (commandSection.length > 0) {
		return commandSection.join("\n");
	}

	// Fallback to basic documentation
	const command = agent.commands.find((cmd) => cmd.name === commandName);
	if (command) {
		const params = command.parameters
			? formatParameters(command.parameters)
			: "";
		const usage = params
			? `\n\n**Usage**: \`@${agent.id} /${command.name} ${params}\``
			: "";

		return `### /${command.name}

${command.description}${usage}`;
	}

	return `No detailed documentation available for /${commandName}`;
}

/**
 * Format command not found error
 */
export function formatCommandNotFound(
	agent: AgentDefinition,
	commandName: string
): FormattedHelp {
	return {
		title: `${agent.name} - Command Not Found`,
		content: `❌ Command "/${commandName}" not found.

Use \`@${agent.id} /help\` to see available commands.`,
	};
}
