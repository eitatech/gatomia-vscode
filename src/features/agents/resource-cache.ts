/**
 * ResourceCache
 * Caches agent resources (prompts, skills, instructions) in memory for fast access
 * Supports hot-reload of changed files
 */

import { workspace, Uri, type OutputChannel, type Disposable } from "vscode";
import { relative, join } from "node:path";

export interface ResourceCacheInterface {
	prompts: Map<string, string>;
	skills: Map<string, string>;
	instructions: Map<string, string>;
	load(resourcesDir: string): Promise<void>;
	reload(changedFiles: string[]): Promise<void>;
	get(
		type: "prompt" | "skill" | "instruction",
		name: string
	): string | undefined;
	getAll(type: "prompt" | "skill" | "instruction"): Map<string, string>;
	dispose(): void;
}

/**
 * Manages caching of agent resources with hot-reload support
 */
export class ResourceCache implements ResourceCacheInterface, Disposable {
	readonly prompts: Map<string, string> = new Map();
	readonly skills: Map<string, string> = new Map();
	readonly instructions: Map<string, string> = new Map();

	private resourcesDir = "";
	private readonly outputChannel: OutputChannel;

	constructor(outputChannel: OutputChannel) {
		this.outputChannel = outputChannel;
	}

	/**
	 * Load all resources from directory
	 * Scans prompts/, skills/, instructions/ subdirectories
	 */
	async load(resourcesDir: string): Promise<void> {
		this.resourcesDir = resourcesDir;
		this.outputChannel.appendLine(
			`[ResourceCache] Loading resources from ${resourcesDir}`
		);

		const startTime = Date.now();

		try {
			await Promise.all([
				this.loadResourceType("prompts", this.prompts),
				this.loadResourceType("skills", this.skills),
				this.loadResourceType("instructions", this.instructions),
			]);

			const duration = Date.now() - startTime;
			const totalResources =
				this.prompts.size + this.skills.size + this.instructions.size;

			this.outputChannel.appendLine(
				`[ResourceCache] Loaded ${totalResources} resources in ${duration}ms (prompts: ${this.prompts.size}, skills: ${this.skills.size}, instructions: ${this.instructions.size})`
			);
		} catch (error) {
			this.outputChannel.appendLine(
				`[ResourceCache] Error loading resources: ${error instanceof Error ? error.message : String(error)}`
			);
			throw error;
		}
	}

	/**
	 * Load all files from a specific resource type directory
	 */
	private async loadResourceType(
		subdirName: string,
		targetMap: Map<string, string>
	): Promise<void> {
		const subdirPath = join(this.resourcesDir, subdirName);
		const subdirUri = Uri.file(subdirPath);

		try {
			const entries = await workspace.fs.readDirectory(subdirUri);

			const loadPromises = entries.map(async ([name, type]) => {
				const fullPath = join(subdirPath, name);
				const fileUri = Uri.file(fullPath);

				if (type === 1) {
					// File
					try {
						const content = await workspace.fs.readFile(fileUri);
						const text = Buffer.from(content).toString("utf8");
						targetMap.set(name, text);
					} catch (error) {
						this.outputChannel.appendLine(
							`[ResourceCache] Failed to read file ${name}: ${error instanceof Error ? error.message : String(error)}`
						);
					}
				} else if (type === 2) {
					// Directory - recursively load
					await this.loadNestedResources(fullPath, name, targetMap);
				}
			});

			await Promise.all(loadPromises);
		} catch (error) {
			// Directory doesn't exist or other error - log and continue
			this.outputChannel.appendLine(
				`[ResourceCache] Skipping ${subdirName} directory: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Recursively load resources from nested directories
	 */
	private async loadNestedResources(
		dirPath: string,
		relativePath: string,
		targetMap: Map<string, string>
	): Promise<void> {
		const dirUri = Uri.file(dirPath);

		try {
			const entries = await workspace.fs.readDirectory(dirUri);

			const loadPromises = entries.map(async ([name, type]) => {
				const fullPath = join(dirPath, name);
				const fileUri = Uri.file(fullPath);
				const nestedRelativePath = `${relativePath}/${name}`;

				if (type === 1) {
					// File
					try {
						const content = await workspace.fs.readFile(fileUri);
						const text = Buffer.from(content).toString("utf8");
						targetMap.set(nestedRelativePath, text);
					} catch (error) {
						this.outputChannel.appendLine(
							`[ResourceCache] Failed to read nested file ${nestedRelativePath}: ${error instanceof Error ? error.message : String(error)}`
						);
					}
				} else if (type === 2) {
					// Directory - continue recursion
					await this.loadNestedResources(
						fullPath,
						nestedRelativePath,
						targetMap
					);
				}
			});

			await Promise.all(loadPromises);
		} catch (error) {
			this.outputChannel.appendLine(
				`[ResourceCache] Error reading nested directory ${relativePath}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Reload specific changed files incrementally
	 * Handles create, update, and delete operations
	 */
	async reload(changedFiles: string[]): Promise<void> {
		this.outputChannel.appendLine(
			`[ResourceCache] Reloading ${changedFiles.length} changed file(s)`
		);

		const startTime = Date.now();
		let reloadedCount = 0;

		for (const filePath of changedFiles) {
			try {
				await this.reloadSingleFile(filePath);
				reloadedCount += 1;
			} catch (error) {
				this.outputChannel.appendLine(
					`[ResourceCache] Failed to reload ${filePath}: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}

		const duration = Date.now() - startTime;
		this.outputChannel.appendLine(
			`[ResourceCache] Reloaded ${reloadedCount}/${changedFiles.length} file(s) in ${duration}ms`
		);
	}

	/**
	 * Reload a single file
	 */
	private async reloadSingleFile(filePath: string): Promise<void> {
		const fileUri = Uri.file(filePath);

		// Determine resource type from path
		const { type, key } = this.parseResourcePath(filePath);
		if (type === null || key === null) {
			this.outputChannel.appendLine(
				`[ResourceCache] Ignoring non-resource file: ${filePath}`
			);
			return;
		}

		const targetMap = this.getMapForType(type);

		try {
			// Try to read file
			const content = await workspace.fs.readFile(fileUri);
			const text = Buffer.from(content).toString("utf8");
			targetMap.set(key, text);
			this.outputChannel.appendLine(`[ResourceCache] Updated ${type}: ${key}`);
		} catch (error) {
			// File doesn't exist - remove from cache
			if (targetMap.has(key)) {
				targetMap.delete(key);
				this.outputChannel.appendLine(
					`[ResourceCache] Removed deleted ${type}: ${key}`
				);
			}
		}
	}

	/**
	 * Parse resource file path to determine type and key
	 */
	private parseResourcePath(filePath: string): {
		type: "prompt" | "skill" | "instruction" | null;
		key: string | null;
	} {
		if (!this.resourcesDir) {
			return { type: null, key: null };
		}

		const relativePath = relative(this.resourcesDir, filePath);
		const parts = relativePath.split("/");

		if (parts.length < 2) {
			return { type: null, key: null };
		}

		const subdir = parts[0];
		const fileName = parts.slice(1).join("/");

		if (subdir === "prompts") {
			return { type: "prompt", key: fileName };
		}
		if (subdir === "skills") {
			return { type: "skill", key: fileName };
		}
		if (subdir === "instructions") {
			return { type: "instruction", key: fileName };
		}

		return { type: null, key: null };
	}

	/**
	 * Get cached resource by type and name
	 * O(1) lookup complexity
	 */
	get(
		type: "prompt" | "skill" | "instruction",
		name: string
	): string | undefined {
		const targetMap = this.getMapForType(type);
		return targetMap.get(name);
	}

	/**
	 * Get all resources of a given type
	 * Returns a copy to prevent external modification
	 */
	getAll(type: "prompt" | "skill" | "instruction"): Map<string, string> {
		const targetMap = this.getMapForType(type);
		return new Map(targetMap);
	}

	/**
	 * Get the appropriate map for a resource type
	 */
	private getMapForType(
		type: "prompt" | "skill" | "instruction"
	): Map<string, string> {
		switch (type) {
			case "prompt":
				return this.prompts;
			case "skill":
				return this.skills;
			case "instruction":
				return this.instructions;
			default:
				return this.prompts;
		}
	}

	/**
	 * Cleanup resources
	 */
	dispose(): void {
		this.prompts.clear();
		this.skills.clear();
		this.instructions.clear();
		this.outputChannel.appendLine("[ResourceCache] Disposed");
	}
}
