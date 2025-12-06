import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	CustomActionParams,
	TemplateContext,
} from "../../../../../src/features/hooks/types";
import {
	CustomActionExecutor,
	CustomActionValidationError,
	CustomAgentInvocationError,
} from "../../../../../src/features/hooks/actions/custom-action";

const templateContext: TemplateContext = {
	feature: "hooks-module",
	branch: "001-hooks-module",
	timestamp: "2025-12-03T10:00:00.000Z",
	user: "Test User",
};

const noopLogger = {
	warn: vi.fn(),
};

describe("CustomActionExecutor", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("execute", () => {
		it("invokes custom agent with no arguments", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "my-custom-agent",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(true);
			expect(result.duration).toBeGreaterThanOrEqual(0);
			expect(mockPromptSender).toHaveBeenCalledWith("@my-custom-agent");
		});

		it("invokes custom agent with simple arguments", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "code-generator",
				arguments: "--mode=auto --verbose",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(true);
			expect(mockPromptSender).toHaveBeenCalledWith(
				"@code-generator --mode=auto --verbose"
			);
		});

		it("expands template variables in arguments", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "feature-helper",
				arguments: "--feature={feature} --branch={branch} --user={user}",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(true);
			expect(mockPromptSender).toHaveBeenCalledWith(
				"@feature-helper --feature=hooks-module --branch=001-hooks-module --user=Test User"
			);
		});

		it("handles missing template variables by replacing with empty string", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "test-agent",
				arguments: "--unknown={nonexistent} --feature={feature}",
			};

			const emptyContext: TemplateContext = {
				feature: "test",
			};

			const result = await executor.execute(params, emptyContext);

			expect(result.success).toBe(true);
			expect(mockPromptSender).toHaveBeenCalledWith(
				"@test-agent --unknown= --feature=test"
			);
		});

		it("trims whitespace from expanded arguments", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "trimmer",
				arguments: "  --option=value  ",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(true);
			expect(mockPromptSender).toHaveBeenCalledWith("@trimmer --option=value");
		});

		it("handles empty arguments string", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "simple-agent",
				arguments: "",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(true);
			expect(mockPromptSender).toHaveBeenCalledWith("@simple-agent");
		});

		it("handles whitespace-only arguments", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "simple-agent",
				arguments: "   ",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(true);
			expect(mockPromptSender).toHaveBeenCalledWith("@simple-agent");
		});
	});

	describe("validation errors", () => {
		it("rejects empty agent name", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(CustomActionValidationError);
			expect(mockPromptSender).not.toHaveBeenCalled();
		});

		it("rejects agent name with invalid characters", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "invalid_agent@name",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(CustomActionValidationError);
			// The isValidCustomParams check catches this first with a generic message
			expect(result.error?.message).toContain("alphanumeric with hyphens");
			expect(mockPromptSender).not.toHaveBeenCalled();
		});

		it("rejects agent name starting with hyphen", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "-invalid-start",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(CustomActionValidationError);
			expect(result.error?.message).toContain("not start or end with a hyphen");
			expect(mockPromptSender).not.toHaveBeenCalled();
		});

		it("rejects agent name ending with hyphen", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "invalid-end-",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(CustomActionValidationError);
			expect(result.error?.message).toContain("not start or end with a hyphen");
			expect(mockPromptSender).not.toHaveBeenCalled();
		});

		it("rejects agent name with spaces", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "invalid agent",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(CustomActionValidationError);
			expect(mockPromptSender).not.toHaveBeenCalled();
		});
	});

	describe("invocation errors", () => {
		it("handles prompt sender errors gracefully", async () => {
			const mockPromptSender = vi
				.fn()
				.mockRejectedValue(new Error("Chat unavailable"));
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "failing-agent",
				arguments: "--test",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(CustomAgentInvocationError);
			expect(result.error?.message).toContain("failing-agent");
			expect(result.error?.message).toContain("Chat unavailable");
		});

		it("logs warnings on execution failure", async () => {
			const mockPromptSender = vi
				.fn()
				.mockRejectedValue(new Error("Connection failed"));
			const logger = { warn: vi.fn() };
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger,
			});

			const params: CustomActionParams = {
				agentName: "test-agent",
			};

			await executor.execute(params, templateContext);

			expect(logger.warn).toHaveBeenCalled();
			expect(logger.warn.mock.calls[0][0]).toContain("CustomActionExecutor");
		});

		it("includes duration even on failure", async () => {
			const mockPromptSender = vi
				.fn()
				.mockRejectedValue(new Error("Test error"));
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "test-agent",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.duration).toBeDefined();
			expect(result.duration).toBeGreaterThanOrEqual(0);
		});
	});

	describe("isValid", () => {
		it("returns true for valid params with agent name only", () => {
			const executor = new CustomActionExecutor({ logger: noopLogger });

			const params: CustomActionParams = {
				agentName: "valid-agent",
			};

			expect(executor.isValid(params)).toBe(true);
		});

		it("returns true for valid params with agent name and arguments", () => {
			const executor = new CustomActionExecutor({ logger: noopLogger });

			const params: CustomActionParams = {
				agentName: "valid-agent",
				arguments: "--option=value",
			};

			expect(executor.isValid(params)).toBe(true);
		});

		it("returns false for empty agent name", () => {
			const executor = new CustomActionExecutor({ logger: noopLogger });

			const params: CustomActionParams = {
				agentName: "",
			};

			expect(executor.isValid(params)).toBe(false);
		});

		it("returns false for agent name with invalid characters", () => {
			const executor = new CustomActionExecutor({ logger: noopLogger });

			const params: CustomActionParams = {
				agentName: "invalid@agent",
			};

			expect(executor.isValid(params)).toBe(false);
		});

		it("returns false for agent name starting with hyphen", () => {
			const executor = new CustomActionExecutor({ logger: noopLogger });

			const params: CustomActionParams = {
				agentName: "-invalid",
			};

			expect(executor.isValid(params)).toBe(false);
		});

		it("returns false for agent name ending with hyphen", () => {
			const executor = new CustomActionExecutor({ logger: noopLogger });

			const params: CustomActionParams = {
				agentName: "invalid-",
			};

			expect(executor.isValid(params)).toBe(false);
		});

		it("accepts alphanumeric agent names", () => {
			const executor = new CustomActionExecutor({ logger: noopLogger });

			expect(executor.isValid({ agentName: "agent123" })).toBe(true);
			expect(executor.isValid({ agentName: "123agent" })).toBe(true);
			expect(executor.isValid({ agentName: "Agent" })).toBe(true);
		});

		it("accepts agent names with hyphens in the middle", () => {
			const executor = new CustomActionExecutor({ logger: noopLogger });

			expect(executor.isValid({ agentName: "my-agent" })).toBe(true);
			expect(executor.isValid({ agentName: "my-custom-agent" })).toBe(true);
			expect(executor.isValid({ agentName: "agent-1-test" })).toBe(true);
		});
	});

	describe("edge cases", () => {
		it("handles undefined arguments", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "test-agent",
				arguments: undefined,
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(true);
			expect(mockPromptSender).toHaveBeenCalledWith("@test-agent");
		});

		it("handles single character agent name", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "a",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(true);
			expect(mockPromptSender).toHaveBeenCalledWith("@a");
		});

		it("handles complex arguments with template variables", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const params: CustomActionParams = {
				agentName: "builder",
				arguments:
					"build {feature} from branch {branch} by {user} at {timestamp}",
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(true);
			expect(mockPromptSender).toHaveBeenCalledWith(
				"@builder build hooks-module from branch 001-hooks-module by Test User at 2025-12-03T10:00:00.000Z"
			);
		});

		it("returns error immediately for null-like params", async () => {
			const mockPromptSender = vi.fn().mockResolvedValue(undefined);
			const executor = new CustomActionExecutor({
				promptSender: mockPromptSender,
				logger: noopLogger,
			});

			const result = await executor.execute(
				{} as CustomActionParams,
				templateContext
			);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(CustomActionValidationError);
			expect(mockPromptSender).not.toHaveBeenCalled();
		});
	});
});
