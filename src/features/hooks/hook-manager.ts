import {
	EventEmitter,
	type Event,
	type ExtensionContext,
	type OutputChannel,
} from "vscode";
import { randomUUID } from "node:crypto";
import {
	type Hook,
	isValidHook,
	HOOKS_STORAGE_KEY,
	MAX_HOOK_NAME_LENGTH,
} from "./types";

/**
 * ValidationError - Describes a validation error
 */
export interface ValidationError {
	field: string;
	message: string;
}

/**
 * ValidationResult - Result of hook validation
 */
export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

/**
 * Custom error classes
 */
export class HookValidationError extends Error {
	errors: ValidationError[];

	constructor(message: string, errors: ValidationError[]) {
		super(message);
		this.name = "HookValidationError";
		this.errors = errors;
	}
}

export class DuplicateHookNameError extends Error {
	constructor(name: string) {
		super(`Hook with name "${name}" already exists`);
		this.name = "DuplicateHookNameError";
	}
}

export class HookNotFoundError extends Error {
	constructor(id: string) {
		super(`Hook with ID "${id}" not found`);
		this.name = "HookNotFoundError";
	}
}

export class PersistenceError extends Error {
	cause?: Error;

	constructor(message: string, cause?: Error) {
		super(message);
		this.name = "PersistenceError";
		this.cause = cause;
	}
}

/**
 * HookManager - Manages hook CRUD operations and persistence
 */
export class HookManager {
	private readonly context: ExtensionContext;
	private readonly outputChannel: OutputChannel;
	private hooks: Hook[] = [];

	// Event emitters
	private readonly _onHookCreated = new EventEmitter<Hook>();
	private readonly _onHookUpdated = new EventEmitter<Hook>();
	private readonly _onHookDeleted = new EventEmitter<string>();
	private readonly _onHooksChanged = new EventEmitter<void>();

	// Public events
	readonly onHookCreated: Event<Hook> = this._onHookCreated.event;
	readonly onHookUpdated: Event<Hook> = this._onHookUpdated.event;
	readonly onHookDeleted: Event<string> = this._onHookDeleted.event;
	readonly onHooksChanged: Event<void> = this._onHooksChanged.event;

	constructor(context: ExtensionContext, outputChannel: OutputChannel) {
		this.context = context;
		this.outputChannel = outputChannel;
	}

	/**
	 * Initialize the hook manager - loads hooks from workspace state
	 */
	async initialize(): Promise<void> {
		await this.loadHooks();
		this.outputChannel.appendLine(
			`[HookManager] Initialized with ${this.hooks.length} hooks`
		);
	}

	/**
	 * Dispose of resources
	 */
	dispose(): void {
		this._onHookCreated.dispose();
		this._onHookUpdated.dispose();
		this._onHookDeleted.dispose();
		this._onHooksChanged.dispose();
		this.outputChannel.appendLine("[HookManager] Disposed");
	}

	/**
	 * Create a new hook
	 */
	async createHook(
		hook: Omit<Hook, "id" | "createdAt" | "modifiedAt" | "executionCount">
	): Promise<Hook> {
		// Check name uniqueness
		const nameExists = await this.isHookNameUnique(hook.name);
		if (!nameExists) {
			throw new DuplicateHookNameError(hook.name);
		}

		// Create full hook with generated fields
		const now = Date.now();
		const newHook: Hook = {
			...hook,
			id: randomUUID(),
			createdAt: now,
			modifiedAt: now,
			executionCount: 0,
		};

		// Validate
		const validation = this.validateHook(newHook);
		if (!validation.valid) {
			throw new HookValidationError(
				"Hook validation failed",
				validation.errors
			);
		}

		// Add to collection
		this.hooks.push(newHook);

		// Persist
		await this.saveHooks();

		// Emit events
		this._onHookCreated.fire(newHook);
		this._onHooksChanged.fire();

		this.outputChannel.appendLine(
			`[HookManager] Created hook: ${newHook.name} (${newHook.id})`
		);

		return newHook;
	}

	/**
	 * Get a hook by ID
	 */
	getHook(id: string): Hook | undefined {
		return this.hooks.find((h) => h.id === id);
	}

	/**
	 * Get all hooks
	 */
	getAllHooks(): Hook[] {
		return [...this.hooks]; // Return copy
	}

	/**
	 * Update a hook
	 */
	async updateHook(id: string, updates: Partial<Hook>): Promise<Hook> {
		const index = this.hooks.findIndex((h) => h.id === id);
		if (index === -1) {
			throw new HookNotFoundError(id);
		}

		const existingHook = this.hooks[index];

		// Prevent updating immutable fields
		const {
			id: _id,
			createdAt: _createdAt,
			executionCount: _execCount,
			...allowedUpdates
		} = updates;

		// Check name uniqueness if name is being changed
		if (allowedUpdates.name && allowedUpdates.name !== existingHook.name) {
			const nameExists = await this.isHookNameUnique(allowedUpdates.name, id);
			if (!nameExists) {
				throw new DuplicateHookNameError(allowedUpdates.name);
			}
		}

		// Merge updates
		const updatedHook: Hook = {
			...existingHook,
			...allowedUpdates,
			modifiedAt: Date.now(),
		};

		// Validate
		const validation = this.validateHook(updatedHook);
		if (!validation.valid) {
			throw new HookValidationError(
				"Hook validation failed",
				validation.errors
			);
		}

		// Update in collection
		this.hooks[index] = updatedHook;

		// Persist
		await this.saveHooks();

		// Emit events
		this._onHookUpdated.fire(updatedHook);
		this._onHooksChanged.fire();

		this.outputChannel.appendLine(
			`[HookManager] Updated hook: ${updatedHook.name} (${id})`
		);

		return updatedHook;
	}

	/**
	 * Delete a hook
	 */
	async deleteHook(id: string): Promise<boolean> {
		const index = this.hooks.findIndex((h) => h.id === id);
		if (index === -1) {
			return false;
		}

		const deletedHook = this.hooks[index];
		this.hooks.splice(index, 1);

		// Persist
		await this.saveHooks();

		// Emit events
		this._onHookDeleted.fire(id);
		this._onHooksChanged.fire();

		this.outputChannel.appendLine(
			`[HookManager] Deleted hook: ${deletedHook.name} (${id})`
		);

		return true;
	}

	/**
	 * Get all enabled hooks
	 */
	getEnabledHooks(): Hook[] {
		return this.hooks.filter((h) => h.enabled);
	}

	/**
	 * Get hooks by trigger condition
	 */
	getHooksByTrigger(agent: string, operation: string): Hook[] {
		return this.hooks.filter(
			(h) => h.trigger.agent === agent && h.trigger.operation === operation
		);
	}

	/**
	 * Disable all hooks
	 */
	async disableAllHooks(): Promise<void> {
		for (const hook of this.hooks) {
			hook.enabled = false;
			hook.modifiedAt = Date.now();
		}

		await this.saveHooks();
		this._onHooksChanged.fire();

		this.outputChannel.appendLine("[HookManager] Disabled all hooks");
	}

	/**
	 * Enable all hooks
	 */
	async enableAllHooks(): Promise<void> {
		for (const hook of this.hooks) {
			hook.enabled = true;
			hook.modifiedAt = Date.now();
		}

		await this.saveHooks();
		this._onHooksChanged.fire();

		this.outputChannel.appendLine("[HookManager] Enabled all hooks");
	}

	/**
	 * Save hooks to workspace state
	 */
	async saveHooks(): Promise<void> {
		try {
			await this.context.workspaceState.update(HOOKS_STORAGE_KEY, this.hooks);
			this.outputChannel.appendLine(
				`[HookManager] Saved ${this.hooks.length} hooks to workspace state`
			);
		} catch (error) {
			const err = error as Error;
			this.outputChannel.appendLine(
				`[HookManager] Error saving hooks: ${err.message}`
			);
			throw new PersistenceError("Failed to save hooks", err);
		}
	}

	/**
	 * Load hooks from workspace state
	 */
	loadHooks(): void {
		try {
			const stored = this.context.workspaceState.get<Hook[]>(
				HOOKS_STORAGE_KEY,
				[]
			);

			// Validate all loaded hooks
			const validHooks: Hook[] = [];
			for (const hook of stored) {
				if (isValidHook(hook)) {
					validHooks.push(hook);
				} else {
					this.outputChannel.appendLine(
						`[HookManager] Warning: Invalid hook found in storage, skipping: ${JSON.stringify(hook)}`
					);
				}
			}

			this.hooks = validHooks;
			this.outputChannel.appendLine(
				`[HookManager] Loaded ${this.hooks.length} hooks from workspace state`
			);
		} catch (error) {
			const err = error as Error;
			this.outputChannel.appendLine(
				`[HookManager] Error loading hooks: ${err.message}`
			);
			this.hooks = [];
		}
	}

	/**
	 * Export hooks to JSON string
	 */
	exportHooks(): string {
		return JSON.stringify(this.hooks, null, 2);
	}

	/**
	 * Import hooks from JSON string
	 */
	async importHooks(json: string): Promise<number> {
		try {
			const imported = JSON.parse(json) as Hook[];

			if (!Array.isArray(imported)) {
				throw new Error("Invalid JSON: expected array of hooks");
			}

			let importedCount = 0;

			for (const hook of imported) {
				// Validate hook structure
				if (!isValidHook(hook)) {
					this.outputChannel.appendLine(
						`[HookManager] Warning: Skipping invalid hook: ${JSON.stringify(hook)}`
					);
					continue;
				}

				// Skip duplicates by name
				const nameExists = await this.isHookNameUnique(hook.name);
				if (!nameExists) {
					this.outputChannel.appendLine(
						`[HookManager] Warning: Skipping duplicate hook: ${hook.name}`
					);
					continue;
				}

				// Add hook (regenerate ID to avoid conflicts)
				const newHook: Hook = {
					...hook,
					id: randomUUID(),
					createdAt: Date.now(),
					modifiedAt: Date.now(),
				};

				this.hooks.push(newHook);
				importedCount += 1;
			}

			if (importedCount > 0) {
				await this.saveHooks();
				this._onHooksChanged.fire();
			}

			this.outputChannel.appendLine(
				`[HookManager] Imported ${importedCount} hooks`
			);

			return importedCount;
		} catch (error) {
			const err = error as Error;
			this.outputChannel.appendLine(
				`[HookManager] Error importing hooks: ${err.message}`
			);
			throw new Error(`Failed to import hooks: ${err.message}`);
		}
	}

	/**
	 * Validate a hook
	 */
	validateHook(hook: Hook): ValidationResult {
		const errors: ValidationError[] = [];

		// Basic structure validation
		if (!hook || typeof hook !== "object") {
			errors.push({
				field: "hook",
				message: "Hook must be an object",
			});
			return { valid: false, errors };
		}

		// Name validation
		if (typeof hook.name !== "string" || hook.name.length === 0) {
			errors.push({
				field: "name",
				message: "Hook name cannot be empty",
			});
		} else if (hook.name.length > MAX_HOOK_NAME_LENGTH) {
			errors.push({
				field: "name",
				message: `Hook name must be ${MAX_HOOK_NAME_LENGTH} characters or less`,
			});
		}

		// Validate using type guard for deeper validation
		if (!isValidHook(hook)) {
			errors.push({
				field: "hook",
				message: "Hook structure is invalid",
			});
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Check if a hook name is unique
	 */
	isHookNameUnique(name: string, excludeId?: string): boolean {
		const existing = this.hooks.find(
			(h) => h.name === name && h.id !== excludeId
		);
		return !existing;
	}
}
