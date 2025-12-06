import { beforeEach, describe, expect, it, vi } from "vitest";
import { MCPParameterResolver } from "../../../../../src/features/hooks/services/mcp-parameter-resolver";
import type {
	ParameterMapping,
	TemplateContext,
} from "../../../../../src/features/hooks/services/mcp-contracts";
import { expandTemplate } from "../../../../../src/features/hooks/template-utils";

vi.mock("../../../../../src/features/hooks/template-utils", () => ({
	expandTemplate: vi.fn(),
}));

describe("MCPParameterResolver", () => {
	let resolver: MCPParameterResolver;

	const mockContext: TemplateContext = {
		feature: "mcp-hooks-integration",
		branch: "feature/mcp-integration",
		timestamp: "2024-12-05T10:30:00Z",
		user: "developer",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		resolver = new MCPParameterResolver();
	});

	describe("resolve", () => {
		it("resolves empty mappings array", () => {
			const result = resolver.resolve([], mockContext);
			expect(result).toEqual({});
		});

		it("resolves single mapping with context source", () => {
			const mappings: ParameterMapping[] = [
				{
					toolParam: "featureName",
					source: "context",
					value: "feature",
				},
			];

			const result = resolver.resolve(mappings, mockContext);

			expect(result).toEqual({
				featureName: "mcp-hooks-integration",
			});
		});

		it("resolves single mapping with literal source", () => {
			const mappings: ParameterMapping[] = [
				{
					toolParam: "title",
					source: "literal",
					value: "Issue Title",
				},
			];

			const result = resolver.resolve(mappings, mockContext);

			expect(result).toEqual({
				title: "Issue Title",
			});
		});

		it("resolves single mapping with template source", () => {
			vi.mocked(expandTemplate).mockReturnValue(
				"Feature: mcp-hooks-integration on feature/mcp-integration"
			);

			const mappings: ParameterMapping[] = [
				{
					toolParam: "description",
					source: "template",
					value: "Feature: {{feature}} on {{branch}}",
				},
			];

			const result = resolver.resolve(mappings, mockContext);

			expect(result).toEqual({
				description:
					"Feature: mcp-hooks-integration on feature/mcp-integration",
			});
			expect(expandTemplate).toHaveBeenCalledWith(
				"Feature: {{feature}} on {{branch}}",
				mockContext
			);
		});

		it("resolves multiple mappings with mixed sources", () => {
			vi.mocked(expandTemplate).mockReturnValue(
				"Branch: feature/mcp-integration"
			);

			const mappings: ParameterMapping[] = [
				{
					toolParam: "featureName",
					source: "context",
					value: "feature",
				},
				{
					toolParam: "priority",
					source: "literal",
					value: "high",
				},
				{
					toolParam: "description",
					source: "template",
					value: "Branch: {{branch}}",
				},
			];

			const result = resolver.resolve(mappings, mockContext);

			expect(result).toEqual({
				featureName: "mcp-hooks-integration",
				priority: "high",
				description: "Branch: feature/mcp-integration",
			});
		});

		it("preserves parameter order", () => {
			const mappings: ParameterMapping[] = [
				{ toolParam: "param1", source: "literal", value: "value1" },
				{ toolParam: "param2", source: "literal", value: "value2" },
				{ toolParam: "param3", source: "literal", value: "value3" },
			];

			const result = resolver.resolve(mappings, mockContext);

			expect(Object.keys(result)).toEqual(["param1", "param2", "param3"]);
		});

		it("handles duplicate toolParam names by using last value", () => {
			const mappings: ParameterMapping[] = [
				{ toolParam: "title", source: "literal", value: "First Value" },
				{ toolParam: "title", source: "literal", value: "Second Value" },
			];

			const result = resolver.resolve(mappings, mockContext);

			expect(result).toEqual({
				title: "Second Value",
			});
		});
	});

	describe("resolveSingle - context source", () => {
		it("resolves feature from context", () => {
			const mapping: ParameterMapping = {
				toolParam: "featureName",
				source: "context",
				value: "feature",
			};

			const result = resolver.resolveSingle(mapping, mockContext);

			expect(result).toBe("mcp-hooks-integration");
		});

		it("resolves branch from context", () => {
			const mapping: ParameterMapping = {
				toolParam: "branchName",
				source: "context",
				value: "branch",
			};

			const result = resolver.resolveSingle(mapping, mockContext);

			expect(result).toBe("feature/mcp-integration");
		});

		it("resolves timestamp from context", () => {
			const mapping: ParameterMapping = {
				toolParam: "time",
				source: "context",
				value: "timestamp",
			};

			const result = resolver.resolveSingle(mapping, mockContext);

			expect(result).toBe("2024-12-05T10:30:00Z");
		});

		it("resolves user from context", () => {
			const mapping: ParameterMapping = {
				toolParam: "author",
				source: "context",
				value: "user",
			};

			const result = resolver.resolveSingle(mapping, mockContext);

			expect(result).toBe("developer");
		});

		it("returns undefined for non-existent context key", () => {
			const mapping: ParameterMapping = {
				toolParam: "missing",
				source: "context",
				value: "nonexistent",
			};

			const result = resolver.resolveSingle(mapping, mockContext);

			expect(result).toBeUndefined();
		});

		it("handles empty context", () => {
			const mapping: ParameterMapping = {
				toolParam: "featureName",
				source: "context",
				value: "feature",
			};

			const result = resolver.resolveSingle(mapping, {});

			expect(result).toBeUndefined();
		});
	});

	describe("resolveSingle - literal source", () => {
		it("returns string literal value", () => {
			const mapping: ParameterMapping = {
				toolParam: "title",
				source: "literal",
				value: "Fixed Issue Title",
			};

			const result = resolver.resolveSingle(mapping, mockContext);

			expect(result).toBe("Fixed Issue Title");
		});

		it("returns empty string literal", () => {
			const mapping: ParameterMapping = {
				toolParam: "title",
				source: "literal",
				value: "",
			};

			const result = resolver.resolveSingle(mapping, mockContext);

			expect(result).toBe("");
		});

		it("returns literal with special characters", () => {
			const mapping: ParameterMapping = {
				toolParam: "body",
				source: "literal",
				value: "Line 1\nLine 2\tTabbed",
			};

			const result = resolver.resolveSingle(mapping, mockContext);

			expect(result).toBe("Line 1\nLine 2\tTabbed");
		});

		it("returns literal with template-like syntax as-is", () => {
			const mapping: ParameterMapping = {
				toolParam: "description",
				source: "literal",
				value: "This looks like {{template}} but it's literal",
			};

			const result = resolver.resolveSingle(mapping, mockContext);

			expect(result).toBe("This looks like {{template}} but it's literal");
		});
	});

	describe("resolveSingle - template source", () => {
		it("expands template with single variable", () => {
			vi.mocked(expandTemplate).mockReturnValue("mcp-hooks-integration");

			const mapping: ParameterMapping = {
				toolParam: "description",
				source: "template",
				value: "{{feature}}",
			};

			const result = resolver.resolveSingle(mapping, mockContext);

			expect(result).toBe("mcp-hooks-integration");
			expect(expandTemplate).toHaveBeenCalledWith("{{feature}}", mockContext);
		});

		it("expands template with multiple variables", () => {
			vi.mocked(expandTemplate).mockReturnValue(
				"Feature mcp-hooks-integration by developer"
			);

			const mapping: ParameterMapping = {
				toolParam: "description",
				source: "template",
				value: "Feature {{feature}} by {{user}}",
			};

			const result = resolver.resolveSingle(mapping, mockContext);

			expect(result).toBe("Feature mcp-hooks-integration by developer");
			expect(expandTemplate).toHaveBeenCalledWith(
				"Feature {{feature}} by {{user}}",
				mockContext
			);
		});

		it("expands template with text and variables", () => {
			vi.mocked(expandTemplate).mockReturnValue(
				"Deployed mcp-hooks-integration to production at 2024-12-05T10:30:00Z"
			);

			const mapping: ParameterMapping = {
				toolParam: "message",
				source: "template",
				value: "Deployed {{feature}} to production at {{timestamp}}",
			};

			const result = resolver.resolveSingle(mapping, mockContext);

			expect(result).toBe(
				"Deployed mcp-hooks-integration to production at 2024-12-05T10:30:00Z"
			);
		});

		it("expands empty template", () => {
			vi.mocked(expandTemplate).mockReturnValue("");

			const mapping: ParameterMapping = {
				toolParam: "description",
				source: "template",
				value: "",
			};

			const result = resolver.resolveSingle(mapping, mockContext);

			expect(result).toBe("");
			expect(expandTemplate).toHaveBeenCalledWith("", mockContext);
		});
	});

	describe("resolveSingle - unknown source", () => {
		it("returns value as-is for unknown source type", () => {
			const mapping = {
				toolParam: "param",
				source: "unknown-source" as "context", // Type cast to bypass TS check
				value: "fallback-value",
			};

			const result = resolver.resolveSingle(mapping, mockContext);

			expect(result).toBe("fallback-value");
		});
	});

	describe("integration scenarios", () => {
		it("resolves GitHub issue creation parameters", () => {
			vi.mocked(expandTemplate).mockImplementation((template: string) =>
				template
					.replace("{{feature}}", "mcp-hooks-integration")
					.replace("{{user}}", "developer")
					.replace("{{timestamp}}", "2024-12-05T10:30:00Z")
			);

			const mappings: ParameterMapping[] = [
				{
					toolParam: "title",
					source: "template",
					value: "Implement {{feature}}",
				},
				{
					toolParam: "body",
					source: "template",
					value:
						"Feature implementation for {{feature}} by {{user}} at {{timestamp}}",
				},
				{
					toolParam: "labels",
					source: "literal",
					value: "enhancement",
				},
				{
					toolParam: "assignee",
					source: "context",
					value: "user",
				},
			];

			const result = resolver.resolve(mappings, mockContext);

			expect(result).toEqual({
				title: "Implement mcp-hooks-integration",
				body: "Feature implementation for mcp-hooks-integration by developer at 2024-12-05T10:30:00Z",
				labels: "enhancement",
				assignee: "developer",
			});
		});

		it("resolves Slack message parameters", () => {
			vi.mocked(expandTemplate).mockImplementation((template: string) =>
				template
					.replace("{{feature}}", "mcp-hooks-integration")
					.replace("{{branch}}", "feature/mcp-integration")
			);

			const mappings: ParameterMapping[] = [
				{
					toolParam: "channel",
					source: "literal",
					value: "#dev-updates",
				},
				{
					toolParam: "message",
					source: "template",
					value: "Deployed {{feature}} from {{branch}}",
				},
			];

			const result = resolver.resolve(mappings, mockContext);

			expect(result).toEqual({
				channel: "#dev-updates",
				message: "Deployed mcp-hooks-integration from feature/mcp-integration",
			});
		});

		it("handles partial context gracefully", () => {
			const partialContext: TemplateContext = {
				feature: "test-feature",
				// Missing branch, timestamp, user
			};

			const mappings: ParameterMapping[] = [
				{
					toolParam: "existing",
					source: "context",
					value: "feature",
				},
				{
					toolParam: "missing",
					source: "context",
					value: "branch",
				},
			];

			const result = resolver.resolve(mappings, partialContext);

			expect(result).toEqual({
				existing: "test-feature",
				missing: undefined,
			});
		});
	});
});
