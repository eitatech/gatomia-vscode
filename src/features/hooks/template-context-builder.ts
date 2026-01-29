/**
 * Template Context Builder
 *
 * Builds runtime context objects for template variable substitution based on trigger events.
 *
 * Responsibilities:
 * - Build TemplateContext from hook trigger events
 * - Populate standard variables (timestamp, triggerType, user, branch, feature)
 * - Populate spec-specific variables (specId, specPath, oldStatus, newStatus)
 * - Handle optional and custom variables
 *
 * @see src/features/hooks/template-variable-parser.ts
 * @see specs/011-custom-agent-hooks/data-model.md
 */

import type { OperationType } from "./types";
import type { TemplateContext } from "./template-variable-parser";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for building template context
 */
export interface ContextBuildOptions {
	// Required
	triggerType: OperationType;

	// Standard optional variables
	user?: string;
	branch?: string;
	feature?: string;

	// Spec-specific variables
	specId?: string;
	specPath?: string;
	oldStatus?: string;
	newStatus?: string;
	changeAuthor?: string;

	// Custom dynamic variables (any key-value pairs)
	[key: string]: string | number | boolean | undefined;
}

// ============================================================================
// Template Context Builder
// ============================================================================

/**
 * TemplateContextBuilder - Builds runtime context for template substitution
 *
 * Implementation phases:
 * - Phase 2 (T008): Skeleton created (FUTURE)
 * - Phase 4 (T035-T036): Full implementation (CURRENT)
 */
export class TemplateContextBuilder {
	/**
	 * Build template context from trigger event options
	 *
	 * @param options Context build options with trigger type and variables
	 * @returns TemplateContext with populated variables
	 */
	buildContext(options: ContextBuildOptions): TemplateContext {
		// Build base context with required standard variables
		const context: TemplateContext = {
			timestamp: new Date().toISOString(),
			triggerType: options.triggerType,
		};

		// Add optional standard variables if provided
		if (options.user !== undefined) {
			context.user = options.user;
		}
		if (options.branch !== undefined) {
			context.branch = options.branch;
		}
		if (options.feature !== undefined) {
			context.feature = options.feature;
		}

		// Add spec-specific variables if provided
		if (options.specId !== undefined) {
			context.specId = options.specId;
		}
		if (options.specPath !== undefined) {
			context.specPath = options.specPath;
		}
		if (options.oldStatus !== undefined) {
			context.oldStatus = options.oldStatus;
		}
		if (options.newStatus !== undefined) {
			context.newStatus = options.newStatus;
		}
		if (options.changeAuthor !== undefined) {
			context.changeAuthor = options.changeAuthor;
		}

		// Add any custom dynamic variables
		// Copy all properties from options except the standard ones we've already handled
		const standardKeys = new Set([
			"triggerType",
			"user",
			"branch",
			"feature",
			"specId",
			"specPath",
			"oldStatus",
			"newStatus",
			"changeAuthor",
		]);

		for (const [key, value] of Object.entries(options)) {
			if (!standardKeys.has(key) && value !== undefined) {
				context[key] = value;
			}
		}

		return context;
	}
}
