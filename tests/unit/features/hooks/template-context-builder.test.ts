/**
 * Unit Tests for TemplateContextBuilder
 *
 * Tests for Phase 4 (T030): Context building for different trigger types
 *
 * Test Strategy:
 * - Test buildContext() for different operation types
 * - Test standard variable population (timestamp, triggerType, user, branch, feature)
 * - Test spec-specific variable population (specId, specPath, oldStatus, newStatus)
 * - Test optional variable handling
 *
 * NOTE: These tests are written FIRST following TDD principles.
 * They should FAIL initially because TemplateContextBuilder doesn't exist yet.
 *
 * @see src/features/hooks/template-context-builder.ts (to be created)
 * @see specs/011-custom-agent-hooks/tasks.md
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	TemplateContextBuilder,
	type ContextBuildOptions,
} from "../../../../src/features/hooks/template-context-builder";
import type { TemplateContext } from "../../../../src/features/hooks/template-variable-parser";

// ISO 8601 timestamp pattern (top-level for performance)
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("TemplateContextBuilder", () => {
	let builder: TemplateContextBuilder;

	beforeEach(() => {
		builder = new TemplateContextBuilder();
	});

	// ============================================================================
	// Standard Variables (Always Present)
	// ============================================================================

	describe("standard variables", () => {
		it("should always include timestamp in ISO 8601 format", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
			};

			const context = builder.buildContext(options);

			expect(context.timestamp).toBeDefined();
			expect(typeof context.timestamp).toBe("string");
			// Should match ISO 8601 format
			expect(context.timestamp).toMatch(ISO_8601_PATTERN);
		});

		it("should always include triggerType", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
			};

			const context = builder.buildContext(options);

			expect(context.triggerType).toBe("clarify");
		});

		it("should include user if provided", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				user: "john-doe",
			};

			const context = builder.buildContext(options);

			expect(context.user).toBe("john-doe");
		});

		it("should include branch if provided", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				branch: "011-custom-agent-hooks",
			};

			const context = builder.buildContext(options);

			expect(context.branch).toBe("011-custom-agent-hooks");
		});

		it("should include feature if provided", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				feature: "custom-agent-hooks",
			};

			const context = builder.buildContext(options);

			expect(context.feature).toBe("custom-agent-hooks");
		});

		it("should handle all standard variables together", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				user: "john-doe",
				branch: "011-custom-agent-hooks",
				feature: "custom-agent-hooks",
			};

			const context = builder.buildContext(options);

			expect(context.timestamp).toBeDefined();
			expect(context.triggerType).toBe("clarify");
			expect(context.user).toBe("john-doe");
			expect(context.branch).toBe("011-custom-agent-hooks");
			expect(context.feature).toBe("custom-agent-hooks");
		});
	});

	// ============================================================================
	// Spec-Specific Variables
	// ============================================================================

	describe("spec-specific variables", () => {
		it("should include specId for spec triggers", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				specId: "011-custom-agent-hooks",
			};

			const context = builder.buildContext(options);

			expect(context.specId).toBe("011-custom-agent-hooks");
		});

		it("should include specPath for spec triggers", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				specPath: "/path/to/specs/011-custom-agent-hooks/spec.md",
			};

			const context = builder.buildContext(options);

			expect(context.specPath).toBe(
				"/path/to/specs/011-custom-agent-hooks/spec.md"
			);
		});

		it("should include oldStatus for spec status changes", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				oldStatus: "draft",
			};

			const context = builder.buildContext(options);

			expect(context.oldStatus).toBe("draft");
		});

		it("should include newStatus for spec status changes", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				newStatus: "review",
			};

			const context = builder.buildContext(options);

			expect(context.newStatus).toBe("review");
		});

		it("should include changeAuthor for spec changes", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				changeAuthor: "john-doe",
			};

			const context = builder.buildContext(options);

			expect(context.changeAuthor).toBe("john-doe");
		});

		it("should handle all spec variables together", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				specId: "011-custom-agent-hooks",
				specPath: "/path/to/specs/011-custom-agent-hooks/spec.md",
				oldStatus: "draft",
				newStatus: "review",
				changeAuthor: "john-doe",
			};

			const context = builder.buildContext(options);

			expect(context.specId).toBe("011-custom-agent-hooks");
			expect(context.specPath).toBe(
				"/path/to/specs/011-custom-agent-hooks/spec.md"
			);
			expect(context.oldStatus).toBe("draft");
			expect(context.newStatus).toBe("review");
			expect(context.changeAuthor).toBe("john-doe");
		});
	});

	// ============================================================================
	// Different Trigger Types
	// ============================================================================

	describe("different trigger types", () => {
		it("should build context for 'specify' trigger", () => {
			const options: ContextBuildOptions = {
				triggerType: "specify",
				specId: "011-custom-agent-hooks",
			};

			const context = builder.buildContext(options);

			expect(context.triggerType).toBe("specify");
			expect(context.specId).toBe("011-custom-agent-hooks");
		});

		it("should build context for 'plan' trigger", () => {
			const options: ContextBuildOptions = {
				triggerType: "plan",
				specId: "011-custom-agent-hooks",
			};

			const context = builder.buildContext(options);

			expect(context.triggerType).toBe("plan");
			expect(context.specId).toBe("011-custom-agent-hooks");
		});

		it("should build context for 'tasks' trigger", () => {
			const options: ContextBuildOptions = {
				triggerType: "tasks",
				specId: "011-custom-agent-hooks",
			};

			const context = builder.buildContext(options);

			expect(context.triggerType).toBe("tasks");
			expect(context.specId).toBe("011-custom-agent-hooks");
		});

		it("should build context for 'analyze' trigger", () => {
			const options: ContextBuildOptions = {
				triggerType: "analyze",
				specId: "011-custom-agent-hooks",
			};

			const context = builder.buildContext(options);

			expect(context.triggerType).toBe("analyze");
			expect(context.specId).toBe("011-custom-agent-hooks");
		});
	});

	// ============================================================================
	// Optional Variables Handling
	// ============================================================================

	describe("optional variables", () => {
		it("should not include optional variables if not provided", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
			};

			const context = builder.buildContext(options);

			// Standard required variables should be present
			expect(context.timestamp).toBeDefined();
			expect(context.triggerType).toBe("clarify");

			// Optional variables should not be present
			expect(context.user).toBeUndefined();
			expect(context.branch).toBeUndefined();
			expect(context.feature).toBeUndefined();
		});

		it("should not include spec variables if not provided", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
			};

			const context = builder.buildContext(options);

			expect(context.specId).toBeUndefined();
			expect(context.specPath).toBeUndefined();
			expect(context.oldStatus).toBeUndefined();
			expect(context.newStatus).toBeUndefined();
		});

		it("should handle partial spec variables", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				specId: "011-custom-agent-hooks",
				// oldStatus and newStatus not provided
			};

			const context = builder.buildContext(options);

			expect(context.specId).toBe("011-custom-agent-hooks");
			expect(context.oldStatus).toBeUndefined();
			expect(context.newStatus).toBeUndefined();
		});
	});

	// ============================================================================
	// Custom Dynamic Variables
	// ============================================================================

	describe("custom dynamic variables", () => {
		it("should include custom string variables", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				customVar1: "value1",
				customVar2: "value2",
			};

			const context = builder.buildContext(options);

			expect(context.customVar1).toBe("value1");
			expect(context.customVar2).toBe("value2");
		});

		it("should include custom number variables", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				lineNumber: 42,
				count: 100,
			};

			const context = builder.buildContext(options);

			expect(context.lineNumber).toBe(42);
			expect(context.count).toBe(100);
		});

		it("should include custom boolean variables", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				isValid: true,
				isComplete: false,
			};

			const context = builder.buildContext(options);

			expect(context.isValid).toBe(true);
			expect(context.isComplete).toBe(false);
		});

		it("should handle mixed custom variables", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				customString: "text",
				customNumber: 42,
				customBoolean: true,
			};

			const context = builder.buildContext(options);

			expect(context.customString).toBe("text");
			expect(context.customNumber).toBe(42);
			expect(context.customBoolean).toBe(true);
		});
	});

	// ============================================================================
	// Edge Cases
	// ============================================================================

	describe("edge cases", () => {
		it("should handle empty options except triggerType", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
			};

			const context = builder.buildContext(options);

			expect(context.timestamp).toBeDefined();
			expect(context.triggerType).toBe("clarify");
			expect(Object.keys(context).length).toBeGreaterThanOrEqual(2);
		});

		it("should handle complex real-world scenario", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
				specId: "011-custom-agent-hooks",
				specPath: "/path/to/specs/011-custom-agent-hooks/spec.md",
				oldStatus: "draft",
				newStatus: "review",
				changeAuthor: "john-doe",
				user: "john-doe",
				branch: "011-custom-agent-hooks",
				feature: "custom-agent-hooks",
			};

			const context = builder.buildContext(options);

			// All variables should be present
			expect(context.timestamp).toBeDefined();
			expect(context.triggerType).toBe("clarify");
			expect(context.specId).toBe("011-custom-agent-hooks");
			expect(context.specPath).toBe(
				"/path/to/specs/011-custom-agent-hooks/spec.md"
			);
			expect(context.oldStatus).toBe("draft");
			expect(context.newStatus).toBe("review");
			expect(context.changeAuthor).toBe("john-doe");
			expect(context.user).toBe("john-doe");
			expect(context.branch).toBe("011-custom-agent-hooks");
			expect(context.feature).toBe("custom-agent-hooks");
		});

		it("should return TemplateContext interface compatible object", () => {
			const options: ContextBuildOptions = {
				triggerType: "clarify",
			};

			const context = builder.buildContext(options);

			// Type check: should have required fields from TemplateContext
			const templateContext: TemplateContext = context;
			expect(templateContext.timestamp).toBeDefined();
			expect(templateContext.triggerType).toBeDefined();
		});
	});
});
