import {
	EventEmitter,
	type Event,
	type ExtensionContext,
	type OutputChannel,
} from "vscode";
import { randomUUID } from "node:crypto";
import type { IMCPDiscoveryService } from "./services/mcp-contracts";
import type { AgentRegistry } from "./agent-registry";
import {
	type Hook,
	type MCPActionParams,
	type CustomActionParams,
	isValidHook,
	isValidAction,
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
	private readonly mcpDiscoveryService?: IMCPDiscoveryService;
	private readonly agentRegistry?: AgentRegistry;
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

	constructor(
		context: ExtensionContext,
		outputChannel: OutputChannel,
		mcpDiscoveryService?: IMCPDiscoveryService,
		agentRegistry?: AgentRegistry
	) {
		this.context = context;
		this.outputChannel = outputChannel;
		this.mcpDiscoveryService = mcpDiscoveryService;
		this.agentRegistry = agentRegistry;
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

		// Validate (now async to support MCP validation)
		const validation = await this.validateHook(newHook);
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

		// Validate (now async to support MCP validation)
		const validation = await this.validateHook(updatedHook);
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

			// Validate all loaded hooks and migrate old hooks
			const validHooks: Hook[] = [];
			for (const hook of stored) {
				// Migration: Add default timing "after" for hooks created before timing feature
				if (!hook.trigger.timing) {
					hook.trigger.timing = "after";
					this.outputChannel.appendLine(
						`[HookManager] Migration: Set default timing "after" for hook: ${hook.name}`
					);
				}

				// Migration: Rename agentId to modelId in MCP actions
				if (hook.action.type === "mcp") {
					const mcpParams = hook.action.parameters as any;
					if (mcpParams.agentId && !mcpParams.modelId) {
						mcpParams.modelId = mcpParams.agentId;
						mcpParams.agentId = undefined;
						this.outputChannel.appendLine(
							`[HookManager] Migration: Renamed agentId to modelId for MCP hook: ${hook.name}`
						);
					}
				}
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
	 * T085: Add MCP server validation check
	 */
	async validateHook(hook: Hook): Promise<ValidationResult> {
		const errors: ValidationError[] = [];

		// Basic structure validation - early return for invalid structure
		if (!hook || typeof hook !== "object") {
			errors.push({
				field: "hook",
				message: "Hook must be an object",
			});
			return { valid: false, errors };
		}

		// Collect all validation errors
		errors.push(...this.validateHookName(hook.name));
		errors.push(...this.validateAgentTypeParam(hook));
		errors.push(...this.validateHookStructure(hook));

		// Async validations
		const asyncErrors = await this.performAsyncValidations(hook);
		errors.push(...asyncErrors);

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Validate hook structure using type guards
	 */
	private validateHookStructure(hook: Hook): ValidationError[] {
		if (isValidHook(hook)) {
			return [];
		}

		const errors: ValidationError[] = [];
		errors.push(...this.validateHookId(hook));
		errors.push(...this.validateHookTrigger(hook));
		errors.push(...this.validateHookAction(hook));

		return errors;
	}

	/**
	 * Validate hook ID field
	 */
	private validateHookId(hook: Hook): ValidationError[] {
		if (!hook.id || typeof hook.id !== "string") {
			return [{ field: "id", message: "Hook ID is missing or invalid" }];
		}
		return [];
	}

	/**
	 * Validate hook trigger configuration
	 */
	private validateHookTrigger(hook: Hook): ValidationError[] {
		if (!hook.trigger || typeof hook.trigger !== "object") {
			return [
				{
					field: "trigger",
					message: "Trigger configuration is invalid",
				},
			];
		}
		return [];
	}

	/**
	 * Validate hook action configuration
	 */
	private validateHookAction(hook: Hook): ValidationError[] {
		if (!hook.action || typeof hook.action !== "object") {
			return [
				{
					field: "action",
					message: "Action configuration is invalid",
				},
			];
		}

		if (!isValidAction(hook.action)) {
			return this.validateActionParameters(hook.action);
		}

		return [];
	}

	/**
	 * Validate action parameters for specific action types
	 */
	private validateActionParameters(action: HookAction): ValidationError[] {
		if (action.type === "custom") {
			const params = action.parameters as any;
			if (!(params?.agentId || params?.agentName)) {
				return [
					{
						field: "action.parameters.agentId",
						message: "Agent ID or agent name is required",
					},
				];
			}
		}

		return [
			{
				field: "action",
				message: "Action parameters are invalid",
			},
		];
	}

	/**
	 * Perform all async validations (MCP and custom agents)
	 */
	private async performAsyncValidations(
		hook: Hook
	): Promise<ValidationError[]> {
		const errors: ValidationError[] = [];

		// T085: Validate MCP server references
		if (hook.action.type === "mcp" && this.mcpDiscoveryService) {
			const mcpErrors = await this.validateMCPServerRef(hook);
			errors.push(...mcpErrors);
		}

		// T025: Validate custom agent references
		if (hook.action.type === "custom" && this.agentRegistry) {
			const customErrors = await this.validateCustomAgentRef(hook);
			errors.push(...customErrors);
		}

		return errors;
	}

	/**
	 * Validate hook name field
	 */
	private validateHookName(name: string | undefined): ValidationError[] {
		const errors: ValidationError[] = [];

		if (!name || name.length === 0) {
			errors.push({
				field: "name",
				message: "Hook name cannot be empty",
			});
			return errors;
		}

		if (name.length > MAX_HOOK_NAME_LENGTH) {
			errors.push({
				field: "name",
				message: `Hook name must be ${MAX_HOOK_NAME_LENGTH} characters or less`,
			});
		}

		return errors;
	}

	/**
	 * Validate agent type parameter (T051)
	 */
	private validateAgentTypeParam(hook: Hook): ValidationError[] {
		if (hook.action?.type !== "custom") {
			return [];
		}

		const customParams = hook.action.parameters as any;
		if (!customParams?.agentType) {
			return [];
		}

		const validTypes: string[] = ["local", "background"];
		if (!validTypes.includes(customParams.agentType)) {
			return [
				{
					field: "action.parameters.agentType",
					message: `Invalid agent type "${customParams.agentType}". Must be "local" or "background".`,
				},
			];
		}

		return [];
	}

	/**
	 * Validate MCP server reference (T085)
	 */
	private async validateMCPServerRef(hook: Hook): Promise<ValidationError[]> {
		const mcpParams = hook.action.parameters as MCPActionParams;
		const serverId = mcpParams.serverId;
		const toolName = mcpParams.toolName;

		// Skip validation if legacy fields not present
		if (!(serverId && toolName)) {
			return [];
		}

		const serverValid = await this.validateMCPServer(serverId, toolName);
		return serverValid.valid ? [] : serverValid.errors;
	}

	/**
	 * Validate custom agent reference (T025)
	 */
	private async validateCustomAgentRef(hook: Hook): Promise<ValidationError[]> {
		const customParams = hook.action.parameters as CustomActionParams;
		const agentId = customParams.agentId || customParams.agentName;
		const agentValid = await this.validateCustomAgent(agentId);
		return agentValid.valid ? [] : agentValid.errors;
	}

	/**
	 * T025: Validate custom agent references
	 * Checks if the referenced agent exists and is available
	 */
	async validateCustomAgent(agentId?: string): Promise<ValidationResult> {
		const errors: ValidationError[] = [];

		if (!this.agentRegistry) {
			// If no registry, skip validation (graceful degradation)
			return { valid: true, errors };
		}

		if (!agentId) {
			errors.push({
				field: "action.parameters.agentId",
				message: "Agent ID is required for custom actions",
			});
			return { valid: false, errors };
		}

		try {
			// Check if agent exists
			const agent = this.agentRegistry.getAgentById(agentId);

			if (!agent) {
				errors.push({
					field: "action.parameters.agentId",
					message: `Agent "${agentId}" not found. Please select a valid agent.`,
				});
				return { valid: false, errors };
			}

			// T025.5: Check if agent is available (warn but don't fail)
			// TypeScript: agentId is guaranteed non-undefined here due to check above
			const availCheck = await this.agentRegistry.checkAgentAvailability(
				agentId as string
			);
			if (!availCheck.available) {
				// Warning - allow saving but notify
				this.outputChannel.appendLine(
					`[HookManager] Warning: Agent "${agentId}" is not currently available: ${availCheck.reason}`
				);
			}

			return { valid: true, errors };
		} catch (error) {
			errors.push({
				field: "action.parameters.agentId",
				message: `Failed to validate agent: ${(error as Error).message}`,
			});
			return { valid: false, errors };
		}
	}

	/**
	 * T085: Validate MCP server and tool references
	 * Checks if the referenced MCP server exists and if the tool is available
	 */
	async validateMCPServer(
		serverId: string,
		toolName: string
	): Promise<ValidationResult> {
		const errors: ValidationError[] = [];

		if (!this.mcpDiscoveryService) {
			// If no discovery service, skip validation (graceful degradation)
			return { valid: true, errors };
		}

		try {
			// Check if server exists
			const server = await this.mcpDiscoveryService.getServer(serverId);

			if (!server) {
				errors.push({
					field: "action.parameters.serverId",
					message: `MCP server "${serverId}" not found. Please verify the server ID or update the hook configuration.`,
				});
				return { valid: false, errors };
			}

			// T086: Check if server is available (warn but don't fail validation)
			if (server.status === "unavailable") {
				this.outputChannel.appendLine(
					`[HookManager] Warning: MCP server "${serverId}" is currently unavailable`
				);
			}

			// Check if tool exists in server
			const tool = await this.mcpDiscoveryService.getTool(serverId, toolName);

			if (!tool) {
				errors.push({
					field: "action.parameters.toolName",
					message: `MCP tool "${toolName}" not found in server "${serverId}". Please verify the tool name or update the hook configuration.`,
				});
				return { valid: false, errors };
			}

			return { valid: true, errors };
		} catch (error) {
			// Graceful degradation - log error but don't fail validation
			const err = error as Error;
			this.outputChannel.appendLine(
				`[HookManager] Warning: Failed to validate MCP server: ${err.message}`
			);

			// Return valid to allow hook to be saved (execution will fail gracefully)
			return { valid: true, errors };
		}
	}

	/**
	 * T085: Get all hooks with invalid MCP server references
	 */
	async getInvalidMCPHooks(): Promise<
		Array<{ hook: Hook; errors: ValidationError[] }>
	> {
		const invalidHooks: Array<{ hook: Hook; errors: ValidationError[] }> = [];

		for (const hook of this.hooks) {
			if (hook.action.type === "mcp") {
				const validation = await this.validateHook(hook);
				if (!validation.valid) {
					invalidHooks.push({
						hook,
						errors: validation.errors,
					});
				}
			}
		}

		return invalidHooks;
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
