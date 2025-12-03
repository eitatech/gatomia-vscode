import { compile } from "handlebars";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import matter from "gray-matter";
import type {
	PromptFrontmatter,
	PromptMetadata,
	PromptTemplate,
	ValidationResult,
} from "../types/prompt.types";

const PROMPT_FILE_EXTENSION_REGEX = /\.(prompt\.)?md$/;

// Import all prompts from index
// biome-ignore lint/performance/noNamespaceImport: ignore
import * as prompts from "../prompts/target";

/**
 * Service for loading and rendering prompt templates
 */
export class PromptLoader {
	private static instance: PromptLoader;
	private readonly prompts: Map<string, PromptTemplate> = new Map();
	private readonly compiledTemplates: Map<string, HandlebarsTemplateDelegate> =
		new Map();

	private constructor() {
		// Private constructor for singleton
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(): PromptLoader {
		if (!PromptLoader.instance) {
			PromptLoader.instance = new PromptLoader();
		}
		return PromptLoader.instance;
	}

	/**
	 * Initialize the loader by loading all prompts
	 */
	initialize(): void {
		// Clear existing data
		this.prompts.clear();
		this.compiledTemplates.clear();

		// Load all built-in prompts
		const promptModules = Object.values(prompts);

		// Register each prompt
		for (const module of promptModules) {
			if (module.frontmatter && module.content) {
				this.registerPrompt(module as PromptTemplate);
			}
		}
	}

	/**
	 * Load prompts from a directory
	 * @param directoryPath Absolute path to the directory containing .md prompt files
	 */
	loadPromptsFromDirectory(directoryPath: string): void {
		try {
			const files = readdirSync(directoryPath);

			for (const file of files) {
				if (file.endsWith(".md") || file.endsWith(".prompt.md")) {
					const fullPath = join(directoryPath, file);
					const stat = statSync(fullPath);

					if (stat.isFile()) {
						this.loadPromptFromFile(fullPath);
					}
				}
			}
		} catch (error) {
			// Directory might not exist, which is fine
			console.warn(
				`[PromptLoader] Failed to load prompts from ${directoryPath}: ${error}`
			);
		}
	}

	/**
	 * Load a single prompt from a file
	 */
	private loadPromptFromFile(filePath: string): void {
		try {
			const content = readFileSync(filePath, "utf8");
			const { data, content: body } = matter(content);

			// Generate ID from filename if not provided in frontmatter
			// Remove extension
			const fileName = basename(filePath).replace(
				PROMPT_FILE_EXTENSION_REGEX,
				""
			);
			const id = (data.id as string) || fileName;

			const template: PromptTemplate = {
				frontmatter: {
					id,
					name: (data.name as string) || id,
					description: (data.description as string) || "",
					version: (data.version as string) || "1.0.0",
					variables: (data.variables as Record<string, any>) || {},
					...data,
				},
				content: body,
			};

			this.registerPrompt(template);
		} catch (error) {
			console.error(
				`[PromptLoader] Failed to load prompt from ${filePath}:`,
				error
			);
		}
	}

	/**
	 * Register a prompt template
	 */
	private registerPrompt(template: PromptTemplate): void {
		const { id } = template.frontmatter;

		// Store the template
		this.prompts.set(id, template);

		// Compile the template
		try {
			const compiled = compile(template.content);
			this.compiledTemplates.set(id, compiled);
		} catch (error) {
			console.error(`Failed to compile template ${id}:`, error);
		}
	}

	/**
	 * Load a prompt template by ID
	 */
	loadPrompt(promptId: string): PromptTemplate {
		const template = this.prompts.get(promptId);
		if (!template) {
			throw new Error(
				`Prompt not found: ${promptId}. Available prompts: ${Array.from(this.prompts.keys()).join(", ")}`
			);
		}
		return template;
	}

	/**
	 * Render a prompt with variables
	 */
	renderPrompt(promptId: string, variables: Record<string, any> = {}): string {
		const template = this.loadPrompt(promptId);
		const compiled = this.compiledTemplates.get(promptId);

		if (!compiled) {
			throw new Error(`Compiled template not found: ${promptId}`);
		}

		// Validate required variables
		const validation = this.validateVariables(template.frontmatter, variables);
		if (!validation.valid) {
			throw new Error(
				`Variable validation failed: ${validation.errors?.join(", ")}`
			);
		}

		// Render the template
		try {
			return compiled(variables);
		} catch (error) {
			throw new Error(`Failed to render template ${promptId}: ${error}`);
		}
	}

	/**
	 * Validate variables against template requirements
	 */
	private validateVariables(
		frontmatter: PromptFrontmatter,
		variables: Record<string, any>
	): ValidationResult {
		const errors: string[] = [];

		if (frontmatter.variables) {
			for (const [name, definition] of Object.entries(frontmatter.variables)) {
				if (definition.required && !(name in variables)) {
					errors.push(`Missing required variable: ${name}`);
				}
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * List all available prompts
	 */
	listPrompts(): PromptMetadata[] {
		const metadata: PromptMetadata[] = [];

		for (const [id, template] of this.prompts) {
			const category = id.split("-")[0]; // Extract category from ID
			metadata.push({
				id,
				name: template.frontmatter.name,
				version: template.frontmatter.version,
				description: template.frontmatter.description,
				category,
			});
		}

		return metadata;
	}
}
