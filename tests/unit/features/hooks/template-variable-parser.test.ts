/**
 * Unit Tests for TemplateVariableParser
 *
 * Tests for Phase 4 (T027-T029): Template variable extraction and substitution
 *
 * Test Strategy:
 * - T027: Test extractVariables() method
 * - T028: Test substitute() method with all trigger types
 * - T029: Test missing variable replacement (empty string)
 *
 * NOTE: These tests are written FIRST following TDD principles.
 * They should FAIL initially because the parser methods are stubbed.
 *
 * @see src/features/hooks/template-variable-parser.ts
 * @see specs/011-custom-agent-hooks/tasks.md
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	TemplateVariableParser,
	type TemplateContext,
} from "../../../../src/features/hooks/template-variable-parser";

describe("TemplateVariableParser", () => {
	let parser: TemplateVariableParser;

	beforeEach(() => {
		parser = new TemplateVariableParser();
	});

	// ============================================================================
	// T027: Test extractVariables() method
	// ============================================================================

	describe("extractVariables()", () => {
		it("should extract single variable from template", () => {
			const template = "Spec: $specId";
			const variables = parser.extractVariables(template);

			expect(variables).toEqual(["specId"]);
		});

		it("should extract multiple variables from template", () => {
			const template = "Spec $specId changed to $newStatus";
			const variables = parser.extractVariables(template);

			expect(variables).toEqual(["specId", "newStatus"]);
		});

		it("should extract all variables including duplicates removed", () => {
			const template = "Review $specId status: $newStatus for $specId";
			const variables = parser.extractVariables(template);

			// Should remove duplicates and return unique variables
			expect(variables).toEqual(["specId", "newStatus"]);
		});

		it("should handle template with no variables", () => {
			const template = "Plain text without variables";
			const variables = parser.extractVariables(template);

			expect(variables).toEqual([]);
		});

		it("should handle empty template string", () => {
			const template = "";
			const variables = parser.extractVariables(template);

			expect(variables).toEqual([]);
		});

		it("should handle variables with underscores", () => {
			const template = "User: $user_name, ID: $user_id";
			const variables = parser.extractVariables(template);

			expect(variables).toEqual(["user_name", "user_id"]);
		});

		it("should handle variables with numbers", () => {
			const template = "Version $version2 released on $date123";
			const variables = parser.extractVariables(template);

			expect(variables).toEqual(["version2", "date123"]);
		});

		it("should ignore malformed variables with spaces after $", () => {
			const template = "Valid: $specId Invalid: $ spaced";
			const variables = parser.extractVariables(template);

			// Should only extract valid variables (no spaces after $)
			expect(variables).toEqual(["specId"]);
		});

		it("should extract partial variable before hyphen", () => {
			const template = "Valid: $specId Invalid: $spec-id";
			const variables = parser.extractVariables(template);

			// Regex extracts 'spec' before the hyphen (hyphen terminates variable)
			expect(variables).toEqual(["specId", "spec"]);
		});

		it("should handle adjacent variables without spaces", () => {
			const template = "$var1$var2$var3";
			const variables = parser.extractVariables(template);

			expect(variables).toEqual(["var1", "var2", "var3"]);
		});

		it("should handle variables at start and end of template", () => {
			const template = "$start middle content $end";
			const variables = parser.extractVariables(template);

			expect(variables).toEqual(["start", "end"]);
		});

		it("should handle dollar signs in regular text", () => {
			const template = "Normal $var and literal dollar $100 and $";
			const variables = parser.extractVariables(template);

			// Should extract 'var' but not numbers-only variables
			expect(variables).toContain("var");
		});
	});

	// ============================================================================
	// T028: Test substitute() method with all trigger types
	// ============================================================================

	describe("substitute()", () => {
		it("should substitute single variable with context value", () => {
			const template = "Spec: $specId";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				specId: "011-custom-agent-hooks",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Spec: 011-custom-agent-hooks");
		});

		it("should substitute multiple variables with context values", () => {
			const template = "Spec $specId changed to $newStatus";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				specId: "011-custom-agent-hooks",
				newStatus: "review",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Spec 011-custom-agent-hooks changed to review");
		});

		it("should substitute all occurrences of duplicate variables", () => {
			const template = "Review $specId status for $specId";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				specId: "011-custom-agent-hooks",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe(
				"Review 011-custom-agent-hooks status for 011-custom-agent-hooks"
			);
		});

		it("should handle template with no variables", () => {
			const template = "Plain text without variables";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Plain text without variables");
		});

		it("should handle empty template string", () => {
			const template = "";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("");
		});

		it("should substitute standard variables (timestamp, triggerType)", () => {
			const template = "Triggered at $timestamp for operation $triggerType";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe(
				"Triggered at 2026-01-26T10:30:00Z for operation clarify"
			);
		});

		it("should substitute optional standard variables (user, branch, feature)", () => {
			const template = "User: $user, Branch: $branch, Feature: $feature";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				user: "john-doe",
				branch: "011-custom-agent-hooks",
				feature: "custom-agent-hooks",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe(
				"User: john-doe, Branch: 011-custom-agent-hooks, Feature: custom-agent-hooks"
			);
		});

		it("should substitute spec-specific variables (specId, specPath, oldStatus, newStatus)", () => {
			const template =
				"Spec $specId at $specPath changed from $oldStatus to $newStatus";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				specId: "011-custom-agent-hooks",
				specPath: "/path/to/specs/011-custom-agent-hooks/spec.md",
				oldStatus: "draft",
				newStatus: "review",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe(
				"Spec 011-custom-agent-hooks at /path/to/specs/011-custom-agent-hooks/spec.md changed from draft to review"
			);
		});

		it("should convert number values to strings", () => {
			const template = "Line: $lineNumber, Count: $count";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				lineNumber: 42,
				count: 100,
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Line: 42, Count: 100");
		});

		it("should convert boolean values to strings", () => {
			const template = "Valid: $isValid, Complete: $isComplete";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				isValid: true,
				isComplete: false,
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Valid: true, Complete: false");
		});

		it("should handle adjacent variables without spaces", () => {
			const template = "$var1$var2$var3";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				var1: "A",
				var2: "B",
				var3: "C",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("ABC");
		});

		it("should handle variables at start and end of template", () => {
			const template = "$start middle content $end";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				start: "BEGIN",
				end: "FINISH",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("BEGIN middle content FINISH");
		});
	});

	// ============================================================================
	// T029: Test missing variable replacement (empty string)
	// ============================================================================

	describe("substitute() - missing variable handling", () => {
		it("should replace missing variable with empty string", () => {
			const template = "Spec: $missingVar";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				// missingVar is not provided
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Spec: ");
		});

		it("should replace multiple missing variables with empty strings", () => {
			const template = "$missing1 and $missing2 and $missing3";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				// No variables provided
			};

			const result = parser.substitute(template, context);

			expect(result).toBe(" and  and ");
		});

		it("should handle partial substitution (some present, some missing)", () => {
			const template = "Present: $present, Missing: $missing";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				present: "VALUE",
				// missing is not provided
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Present: VALUE, Missing: ");
		});

		it("should handle all missing variables in complex template", () => {
			const template = "$a $b $c";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				// No variables provided
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("  ");
		});

		it("should replace undefined context values with empty string", () => {
			const template = "Value: $undefinedValue";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				undefinedValue: undefined,
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Value: ");
		});

		it("should handle missing optional standard variables", () => {
			const template = "User: $user, Branch: $branch";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				// user and branch not provided
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("User: , Branch: ");
		});

		it("should handle missing spec-specific variables", () => {
			const template = "Old: $oldStatus, New: $newStatus";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				// oldStatus and newStatus not provided
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Old: , New: ");
		});

		it("should not replace missing variables with 'undefined' or 'null' strings", () => {
			const template = "$missing";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
			};

			const result = parser.substitute(template, context);

			// Should be empty string, not "undefined" or "null"
			expect(result).toBe("");
			expect(result).not.toBe("undefined");
			expect(result).not.toBe("null");
		});
	});

	// ============================================================================
	// Edge Cases and Integration Tests
	// ============================================================================

	describe("edge cases", () => {
		it("should handle complex real-world template", () => {
			const template =
				"[$timestamp] Spec '$specId' transitioned from '$oldStatus' to '$newStatus' by $changeAuthor on branch $branch";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				specId: "011-custom-agent-hooks",
				oldStatus: "draft",
				newStatus: "review",
				changeAuthor: "john-doe",
				branch: "011-custom-agent-hooks",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe(
				"[2026-01-26T10:30:00Z] Spec '011-custom-agent-hooks' transitioned from 'draft' to 'review' by john-doe on branch 011-custom-agent-hooks"
			);
		});

		it("should handle template with only variable placeholders", () => {
			const template = "$specId";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				specId: "011-custom-agent-hooks",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("011-custom-agent-hooks");
		});

		it("should handle template with special characters around variables", () => {
			const template = "($specId), [$newStatus], <$timestamp>";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				specId: "011-custom-agent-hooks",
				newStatus: "review",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe(
				"(011-custom-agent-hooks), [review], <2026-01-26T10:30:00Z>"
			);
		});

		it("should handle empty string values in context", () => {
			const template = "Value: '$value'";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				value: "",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Value: ''");
		});

		it("should handle whitespace in template around variables", () => {
			const template = "  $var1  $var2  ";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				var1: "A",
				var2: "B",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("  A  B  ");
		});

		it("should preserve case sensitivity in variable names", () => {
			const template = "$SpecId vs $specId";
			const context: TemplateContext = {
				timestamp: "2026-01-26T10:30:00Z",
				triggerType: "clarify",
				SpecId: "UPPER",
				specId: "lower",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("UPPER vs lower");
		});
	});

	// ============================================================================
	// Output Capture Variables Tests (Phase 4: 011-custom-agent-hooks)
	// ============================================================================

	describe("substitute() - output capture variables", () => {
		it("should substitute agentOutput variable", () => {
			const template = "Agent output: $agentOutput";
			const context: TemplateContext = {
				timestamp: "2026-01-27T10:00:00Z",
				triggerType: "specify",
				agentOutput: "# Specification\n\n## Use Case 1",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Agent output: # Specification\n\n## Use Case 1");
		});

		it("should substitute clipboardContent variable", () => {
			const template = "Clipboard: $clipboardContent";
			const context: TemplateContext = {
				timestamp: "2026-01-27T10:00:00Z",
				triggerType: "specify",
				clipboardContent: "Copied text from Copilot Chat",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Clipboard: Copied text from Copilot Chat");
		});

		it("should substitute outputPath variable", () => {
			const template = "File: $outputPath";
			const context: TemplateContext = {
				timestamp: "2026-01-27T10:00:00Z",
				triggerType: "specify",
				outputPath: "/workspace/.specify/specs/011-custom-agent-hooks/spec.md",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe(
				"File: /workspace/.specify/specs/011-custom-agent-hooks/spec.md"
			);
		});

		it("should substitute all output variables together", () => {
			const template =
				"Output: $agentOutput\nFile: $outputPath\nClipboard: $clipboardContent";
			const context: TemplateContext = {
				timestamp: "2026-01-27T10:00:00Z",
				triggerType: "specify",
				agentOutput: "# Test",
				outputPath: "/test.md",
				clipboardContent: "test clipboard",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe(
				"Output: # Test\nFile: /test.md\nClipboard: test clipboard"
			);
		});

		it("should handle empty output variables gracefully", () => {
			const template = "Output: $agentOutput, Path: $outputPath";
			const context: TemplateContext = {
				timestamp: "2026-01-27T10:00:00Z",
				triggerType: "specify",
				agentOutput: "",
				outputPath: "",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Output: , Path: ");
		});

		it("should handle missing output variables (replaced with empty string)", () => {
			const template =
				"Output: $agentOutput, Clipboard: $clipboardContent, Path: $outputPath";
			const context: TemplateContext = {
				timestamp: "2026-01-27T10:00:00Z",
				triggerType: "specify",
				// No output variables provided
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Output: , Clipboard: , Path: ");
		});

		it("should combine output variables with standard variables", () => {
			const template =
				"Spec $specId changed by $changeAuthor. Output: $agentOutput";
			const context: TemplateContext = {
				timestamp: "2026-01-27T10:00:00Z",
				triggerType: "specify",
				specId: "011-custom-agent-hooks",
				changeAuthor: "test-user",
				agentOutput: "# New Spec Content",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe(
				"Spec 011-custom-agent-hooks changed by test-user. Output: # New Spec Content"
			);
		});

		it("should handle multiline agentOutput", () => {
			const template = "Content:\n$agentOutput\n---End---";
			const context: TemplateContext = {
				timestamp: "2026-01-27T10:00:00Z",
				triggerType: "specify",
				agentOutput: "Line 1\nLine 2\nLine 3",
			};

			const result = parser.substitute(template, context);

			expect(result).toBe("Content:\nLine 1\nLine 2\nLine 3\n---End---");
		});
	});
});
