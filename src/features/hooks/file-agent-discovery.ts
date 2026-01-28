/**
 * File Agent Discovery Service
 *
 * Discovers agents from .github/agents/*.agent.md files by scanning the directory
 * and parsing YAML frontmatter to extract agent metadata.
 *
 * Features:
 * - Scans .github/agents/ directory for .agent.md files
 * - Parses YAML frontmatter using gray-matter
 * - Validates agent schema
 * - Converts to AgentRegistryEntry format
 * - Handles errors gracefully
 *
 * @see specs/011-custom-agent-hooks/contracts/agent-registry-api.ts
 * @see specs/011-custom-agent-hooks/data-model.md
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type {
	AgentRegistryEntry,
	AgentDiscoveryResult,
	AgentDiscoveryError,
	AgentConfigSchema,
} from "./agent-registry-types";
import { AGENT_ID_PREFIX } from "./agent-registry-constants";

/**
 * Regex pattern for validating agent ID format (lowercase-with-hyphens)
 */
const AGENT_ID_FORMAT_REGEX = /^[a-z][a-z0-9-]*$/;

/**
 * FileAgentDiscovery - Discovers agents from .github/agents/*.agent.md files
 *
 * Responsibilities:
 * - Scan directory for .agent.md files
 * - Parse YAML frontmatter from each file
 * - Validate required fields
 * - Convert to AgentRegistryEntry format
 * - Report errors for malformed files
 */
export class FileAgentDiscovery {
	/**
	 * Discover all agents from a directory
	 *
	 * @param agentsDir Absolute path to .github/agents/ directory
	 * @returns Discovery result with agents and errors
	 */
	async discoverFromDirectory(
		agentsDir: string
	): Promise<AgentDiscoveryResult> {
		const agents: AgentRegistryEntry[] = [];
		const errors: AgentDiscoveryError[] = [];
		const discoveredAt = Date.now();

		try {
			// Check if directory exists
			const dirStats = await fs.stat(agentsDir).catch(() => null);
			if (!dirStats?.isDirectory()) {
				// Directory doesn't exist or isn't a directory - return empty result
				return {
					source: "file",
					agents: [],
					errors: [],
					discoveredAt,
				};
			}

			// Read all files in directory
			const files = await fs.readdir(agentsDir);

			// Filter for .agent.md files only
			const agentFiles = files.filter(
				(file) => file.endsWith(".agent.md") && !file.startsWith(".")
			);

			// Process each agent file
			for (const filename of agentFiles) {
				const filePath = join(agentsDir, filename);

				try {
					const agent = await this.parseAgentFile(filePath, discoveredAt);
					agents.push(agent);
				} catch (error) {
					// Record error and continue with other files
					errors.push({
						filePath,
						code:
							error instanceof SchemaValidationError
								? "INVALID_SCHEMA"
								: "PARSE_ERROR",
						message:
							error instanceof Error
								? error.message
								: "Unknown error parsing file",
					});
				}
			}
		} catch (error) {
			// Directory read failed - record error
			errors.push({
				code: "FILE_NOT_FOUND",
				message:
					error instanceof Error
						? `Failed to read directory: ${error.message}`
						: "Failed to read directory",
			});
		}

		return {
			source: "file",
			agents,
			errors,
			discoveredAt,
		};
	}

	/**
	 * Parse a single .agent.md file
	 *
	 * @param filePath Absolute path to agent file
	 * @param discoveredAt Timestamp for discovery
	 * @returns Parsed agent registry entry
	 * @throws Error if file cannot be parsed or validated
	 */
	private async parseAgentFile(
		filePath: string,
		discoveredAt: number
	): Promise<AgentRegistryEntry> {
		// Read file content
		const content = await fs.readFile(filePath, "utf-8");

		// Parse YAML frontmatter
		const parsed = matter(content);

		if (!parsed.data || Object.keys(parsed.data).length === 0) {
			throw new SchemaValidationError("No YAML frontmatter found in file");
		}

		// Validate required fields
		const schema = this.validateAndExtractSchema(parsed.data);

		// Generate agent ID: "local:{agent-id}"
		const agentId = `${AGENT_ID_PREFIX.FILE}:${schema.id}`;

		// Create agent registry entry
		const agent: AgentRegistryEntry = {
			// Identity
			id: agentId,
			name: schema.name,
			displayName: schema.name, // Will be updated by AgentRegistry if duplicates exist
			description: schema.description,

			// Classification
			type: "local", // All file-based agents are local
			source: "file",

			// Source-specific data
			sourcePath: filePath,

			// Agent configuration schema
			schema,

			// Metadata
			discoveredAt,
			available: true, // Assume available since file exists
		};

		return agent;
	}

	/**
	 * Validate agent schema from YAML frontmatter
	 *
	 * @param data Parsed YAML data
	 * @returns Validated agent config schema
	 * @throws SchemaValidationError if validation fails
	 */
	private validateAndExtractSchema(
		data: Record<string, unknown>
	): AgentConfigSchema {
		// Validate required fields
		if (typeof data.id !== "string" || !data.id) {
			throw new SchemaValidationError("Missing or invalid 'id' field");
		}

		if (typeof data.name !== "string" || !data.name) {
			throw new SchemaValidationError("Missing or invalid 'name' field");
		}

		if (typeof data.description !== "string" || !data.description) {
			throw new SchemaValidationError("Missing or invalid 'description' field");
		}

		// Validate ID format (lowercase-with-hyphens)
		if (!AGENT_ID_FORMAT_REGEX.test(data.id)) {
			throw new SchemaValidationError(
				"Invalid 'id' format. Must be lowercase-with-hyphens (e.g., 'code-reviewer')"
			);
		}

		// Extract schema with optional fields
		const schema: AgentConfigSchema = {
			id: data.id,
			name: data.name,
			fullName: typeof data.fullName === "string" ? data.fullName : data.name,
			description: data.description,
			icon: typeof data.icon === "string" ? data.icon : undefined,
			commands: Array.isArray(data.commands) ? data.commands : [],
			resources: this.extractResources(data.resources),
			content: "", // Will be populated if needed
		};

		return schema;
	}

	/**
	 * Extract and validate resources from YAML data
	 *
	 * @param resources Raw resources data from YAML
	 * @returns Validated AgentResources object
	 */
	private extractResources(resources: unknown): AgentConfigSchema["resources"] {
		if (typeof resources !== "object" || resources === null) {
			return {};
		}

		const res = resources as Record<string, unknown>;
		const extracted: AgentConfigSchema["resources"] = {};

		// Extract optional fields if they're arrays of strings
		if (Array.isArray(res.prompts)) {
			extracted.prompts = res.prompts.filter(
				(p): p is string => typeof p === "string"
			);
		}

		if (Array.isArray(res.skills)) {
			extracted.skills = res.skills.filter(
				(s): s is string => typeof s === "string"
			);
		}

		if (Array.isArray(res.instructions)) {
			extracted.instructions = res.instructions.filter(
				(i): i is string => typeof i === "string"
			);
		}

		return extracted;
	}
}

/**
 * Custom error for schema validation failures
 */
class SchemaValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SchemaValidationError";
	}
}
