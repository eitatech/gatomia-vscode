/**
 * AgentLoader
 *
 * Discovers and loads agent definitions from markdown files with YAML frontmatter.
 * Validates agent definitions and provides error reporting.
 */

import { Uri, workspace, type OutputChannel } from "vscode";
import matter from "gray-matter";
import type { AgentDefinition, AgentCommand, ValidationResult } from "./types";

const AGENT_ID_PATTERN = /^[a-z0-9-]+$/;

export class AgentLoader {
	private readonly outputChannel: OutputChannel;

	constructor(outputChannel: OutputChannel) {
		this.outputChannel = outputChannel;
	}

	/**
	 * Load all agent definitions from a directory
	 * @param agentsDir Absolute path to agents directory
	 * @returns Array of valid agent definitions
	 */
	async loadAgents(agentsDir: string): Promise<AgentDefinition[]> {
		const agents: AgentDefinition[] = [];

		try {
			const dirUri = Uri.file(agentsDir);

			if (!(await this.checkDirectoryExists(dirUri, agentsDir))) {
				return agents;
			}

			await this.loadAgentsFromDirectory(dirUri, agents);

			this.outputChannel.appendLine(
				`[AgentLoader] Loaded ${agents.length} agent(s) from ${agentsDir}`
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.outputChannel.appendLine(
				`[AgentLoader] Failed to load agents from ${agentsDir}: ${message}`
			);
		}

		return agents;
	}

	/**
	 * Recursively load agents from directory and subdirectories
	 */
	private async loadAgentsFromDirectory(
		dirUri: Uri,
		agents: AgentDefinition[]
	): Promise<void> {
		const entries = await workspace.fs.readDirectory(dirUri);

		for (const [name, fileType] of entries) {
			const fullPath = `${dirUri.fsPath}/${name}`;

			if (fileType === 2) {
				// Directory - recurse
				await this.loadAgentsFromDirectory(Uri.file(fullPath), agents);
			} else if (this.shouldProcessFile(name, fileType)) {
				// File - process if it's an agent file
				await this.processAgentFile(fullPath, name, agents);
			}
		}
	}

	/**
	 * Check if directory exists
	 */
	private async checkDirectoryExists(
		dirUri: Uri,
		agentsDir: string
	): Promise<boolean> {
		try {
			await workspace.fs.stat(dirUri);
			return true;
		} catch {
			this.outputChannel.appendLine(
				`[AgentLoader] Error loading agents: Agents directory not found: ${agentsDir}`
			);
			return false;
		}
	}

	/**
	 * Check if file should be processed
	 */
	private shouldProcessFile(name: string, fileType: number): boolean {
		return fileType === 1 && name.endsWith(".agent.md");
	}

	/**
	 * Process a single agent file
	 */
	private async processAgentFile(
		filePath: string,
		name: string,
		agents: AgentDefinition[]
	): Promise<void> {
		try {
			const agent = await this.parseAgentFile(filePath);
			const validation = this.validateDefinition(agent);

			if (validation.valid) {
				agents.push(agent);
				this.outputChannel.appendLine(
					`[AgentLoader] Loaded agent: ${agent.id} (${agent.name})`
				);
			} else {
				this.logValidationErrors(name, validation.errors);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.outputChannel.appendLine(
				`[AgentLoader] Failed to parse ${name}: ${message}`
			);
		}
	}

	/**
	 * Log validation errors
	 */
	private logValidationErrors(name: string, errors: string[]): void {
		this.outputChannel.appendLine(
			`[AgentLoader] Invalid agent definition in ${name}:`
		);
		for (const error of errors) {
			this.outputChannel.appendLine(`  - ${error}`);
		}
	}

	/**
	 * Parse an agent definition file
	 * @param filePath Absolute path to agent file
	 * @returns Parsed agent definition
	 */
	async parseAgentFile(filePath: string): Promise<AgentDefinition> {
		const uri = Uri.file(filePath);

		// Read file contents
		const bytes = await workspace.fs.readFile(uri);
		const content = Buffer.from(bytes).toString("utf8");

		// Parse YAML frontmatter
		const parsed = matter(content);

		// Check if frontmatter exists
		if (!parsed.data || Object.keys(parsed.data).length === 0) {
			throw new Error(`No frontmatter found in ${filePath}`);
		}

		// Extract frontmatter data
		const data = parsed.data as Record<string, unknown>;
		const resources = (data.resources as Record<string, unknown>) || {};

		// Build agent definition
		const commands = this.parseCommands(data.commands);

		// T068 - Automatically inject /help command if not already defined
		const hasHelpCommand = commands.some((cmd) => cmd.name === "help");
		if (!hasHelpCommand) {
			commands.push({
				name: "help",
				description: "Show help information for this agent",
				tool: "agent.help",
			});
		}

		const agent: AgentDefinition = {
			id: String(data.id || ""),
			name: String(data.name || ""),
			fullName: String(data.fullName || data.name || ""),
			description: String(data.description || ""),
			icon: data.icon ? String(data.icon) : undefined,
			commands,
			resources: {
				prompts: this.parseStringArray(resources.prompts),
				skills: this.parseStringArray(resources.skills),
				instructions: this.parseStringArray(resources.instructions),
			},
			filePath,
			content: parsed.content,
		};

		return agent;
	}

	/**
	 * Parse commands array from frontmatter
	 */
	private parseCommands(commands: unknown): AgentCommand[] {
		if (!Array.isArray(commands)) {
			return [];
		}

		return commands
			.map((cmd) => {
				if (typeof cmd !== "object" || cmd === null) {
					return null;
				}

				const command = cmd as Record<string, unknown>;

				return {
					name: String(command.name || ""),
					description: String(command.description || ""),
					tool: String(command.tool || ""),
					parameters: Array.isArray(command.parameters)
						? (command.parameters as unknown[]).map((p) => {
								if (typeof p === "object" && p !== null) {
									return p as Record<string, unknown>;
								}
								return {} as Record<string, unknown>;
							})
						: undefined,
				};
			})
			.filter((cmd): cmd is Agentcommand => cmd !== null);
	}

	/**
	 * Parse string array from frontmatter field
	 */
	private parseStringArray(value: unknown): string[] | undefined {
		if (!Array.isArray(value)) {
			return;
		}

		return value
			.filter((item) => typeof item === "string")
			.map((item) => String(item));
	}

	/**
	 * Validate an agent definition
	 * @param agent Agent definition to validate
	 * @returns Validation result with errors if any
	 */
	validateDefinition(agent: AgentDefinition): ValidationResult {
		const errors: string[] = [];

		this.validateId(agent.id, errors);
		this.validateName(agent.name, errors);
		this.validateFullName(agent.fullName, errors);
		this.validateDescription(agent.description, errors);
		this.validateCommands(agent.commands, errors);

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Validate agent ID
	 */
	private validateId(id: string | undefined, errors: string[]): void {
		if (!(id && AGENT_ID_PATTERN.test(id))) {
			errors.push(
				"Agent id must be lowercase alphanumeric with hyphens (e.g., 'task-planner')"
			);
		}
	}

	/**
	 * Validate agent name
	 */
	private validateName(name: string | undefined, errors: string[]): void {
		if (!name || name.trim().length === 0) {
			errors.push("Agent name is required");
		}
	}

	/**
	 * Validate agent full name
	 */
	private validateFullName(
		fullName: string | undefined,
		errors: string[]
	): void {
		if (!fullName || fullName.trim().length === 0) {
			errors.push("Agent fullName is required");
		}
	}

	/**
	 * Validate agent description
	 */
	private validateDescription(
		description: string | undefined,
		errors: string[]
	): void {
		if (!description || description.trim().length === 0) {
			errors.push("Agent description is required");
		}
	}

	/**
	 * Validate agent commands
	 */
	private validateCommands(
		commands: AgentCommand[] | undefined,
		errors: string[]
	): void {
		if (!commands || commands.length === 0) {
			errors.push("Agent must have at least one commands");
			return;
		}

		for (let i = 0; i < commands.length; i++) {
			this.validateCommand(commands[i], i + 1, errors);
		}
	}

	/**
	 * Validate a single command
	 */
	private validateCommand(
		cmd: AgentCommand,
		index: number,
		errors: string[]
	): void {
		const prefix = `command ${index}`;

		if (!cmd.name || cmd.name.trim().length === 0) {
			errors.push(`${prefix}: name is required`);
		}

		if (!cmd.description || cmd.description.trim().length === 0) {
			errors.push(`${prefix}: description is required`);
		}

		if (!cmd.tool || cmd.tool.trim().length === 0) {
			errors.push(`${prefix}: tool is required`);
		}
	}
}
