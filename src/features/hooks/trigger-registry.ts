import { EventEmitter, type Event, type OutputChannel } from "vscode";
import {
	type TriggerEvent,
	isValidTriggerEvent,
	MAX_TRIGGER_HISTORY,
} from "./types";

/**
 * TriggerRegistry - Centralized event system for hook triggers
 *
 * Allows components to emit trigger events when agent operations complete
 * and enables HookExecutor to subscribe to these events.
 */
export class TriggerRegistry {
	private readonly outputChannel: OutputChannel;
	private readonly _onTrigger = new EventEmitter<TriggerEvent>();
	private triggerHistory: TriggerEvent[] = [];
	private disposed = false;

	/**
	 * Event emitted when a trigger fires
	 */
	readonly onTrigger: Event<TriggerEvent> = this._onTrigger.event;

	constructor(outputChannel: OutputChannel) {
		this.outputChannel = outputChannel;
	}

	/**
	 * Initialize the trigger registry
	 */
	initialize(): void {
		if (this.disposed) {
			throw new Error("TriggerRegistry has been disposed");
		}
		this.outputChannel.appendLine("[TriggerRegistry] Initialized");
	}

	/**
	 * Dispose of resources
	 */
	dispose(): void {
		this._onTrigger.dispose();
		this.triggerHistory = [];
		this.disposed = true;
		this.outputChannel.appendLine("[TriggerRegistry] Disposed");
	}

	/**
	 * Fire a trigger event (simple API)
	 *
	 * @param agent - Agent system ('speckit' | 'openspec')
	 * @param operation - Operation name ('specify' | 'clarify' | 'plan' | 'analyze' | 'checklist')
	 * @param timing - When the trigger fires ('before' | 'after')
	 * @param outputData - Optional output capture data
	 */
	fireTrigger(
		agent: string,
		operation: string,
		timing: "before" | "after" = "after",
		outputData?: {
			outputPath?: string;
			outputContent?: string;
		}
	): void {
		const event: TriggerEvent = {
			agent,
			operation,
			timestamp: Date.now(),
			timing,
			outputPath: outputData?.outputPath,
			outputContent: outputData?.outputContent,
		};

		this.fireTriggerWithContext(event);
	}

	/**
	 * Fire a trigger event with additional context (advanced API)
	 *
	 * @param event - Trigger event with optional metadata
	 */
	fireTriggerWithContext(event: TriggerEvent): void {
		if (this.disposed) {
			this.outputChannel.appendLine(
				"[TriggerRegistry] Warning: Cannot fire trigger, registry disposed"
			);
			return;
		}

		// Validate event
		if (!isValidTriggerEvent(event)) {
			this.outputChannel.appendLine(
				`[TriggerRegistry] Invalid trigger event: ${JSON.stringify(event)}`
			);
			return;
		}

		// Log trigger
		this.outputChannel.appendLine(
			`[TriggerRegistry] Trigger fired: ${event.agent}.${event.operation} (${event.timing || "after"}) at ${new Date(event.timestamp).toISOString()}`
		);

		// Store in history (FIFO)
		this.triggerHistory.push(event);
		if (this.triggerHistory.length > MAX_TRIGGER_HISTORY) {
			this.triggerHistory.shift();
		}

		// Emit event
		try {
			this._onTrigger.fire(event);
		} catch (error) {
			this.outputChannel.appendLine(
				`[TriggerRegistry] Error emitting trigger event: ${error}`
			);
		}
	}

	/**
	 * Get the last trigger event
	 *
	 * @returns Last trigger event or undefined if none
	 */
	getLastTrigger(): TriggerEvent | undefined {
		return this.triggerHistory.at(-1);
	}

	/**
	 * Get trigger history
	 *
	 * @param limit - Optional limit on number of events to return (defaults to all)
	 * @returns Array of trigger events (newest last)
	 */
	getTriggerHistory(limit?: number): TriggerEvent[] {
		const history = [...this.triggerHistory]; // Copy to prevent mutation

		if (limit !== undefined && limit > 0) {
			return history.slice(-limit); // Last N events
		}

		return history;
	}

	/**
	 * Clear trigger history
	 */
	clearTriggerHistory(): void {
		this.triggerHistory = [];
		this.outputChannel.appendLine("[TriggerRegistry] Trigger history cleared");
	}
}
