import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AgentActionExecutor } from "../../../../../src/features/hooks/actions/agent-action";
import type {
	AgentActionParams,
	ExecutionContext,
} from "../../../../../src/features/hooks/types";

// Mock sendPromptToChat
vi.mock("../../../../../src/utils/chat-prompt-runner", () => ({
	sendPromptToChat: vi.fn(),
}));

import { sendPromptToChat } from "../../../../../src/utils/chat-prompt-runner";

describe("AgentActionExecutor", () => {
	let executor: AgentActionExecutor;

	beforeEach(() => {
		executor = new AgentActionExecutor();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("execute", () => {
		it("should execute valid SpecKit command", async () => {
			const params: AgentActionParams = {
				command: "/speckit.clarify",
			};

			const result = await executor.execute(params);

			expect(result.success).toBe(true);
			expect(result.duration).toBeDefined();
			expect(sendPromptToChat).toHaveBeenCalledWith("/speckit.clarify", {
				instructionType: "runPrompt",
			});
		});

		it("should execute valid OpenSpec command", async () => {
			const params: AgentActionParams = {
				command: "/openspec.analyze",
			};

			const result = await executor.execute(params);

			expect(result.success).toBe(true);
			expect(sendPromptToChat).toHaveBeenCalledWith("/openspec.analyze", {
				instructionType: "runPrompt",
			});
		});

		it("should include execution context when provided", async () => {
			const params: AgentActionParams = {
				command: "/speckit.plan",
			};

			const context: ExecutionContext = {
				executionId: "test-execution-id",
				chainDepth: 1,
				executedHooks: new Set(["hook-1"]),
				startedAt: Date.now(),
			};

			const result = await executor.execute(params, context);

			expect(result.success).toBe(true);
		});

		it("should measure execution duration", async () => {
			const params: AgentActionParams = {
				command: "/speckit.specify",
			};

			const result = await executor.execute(params);

			expect(result.duration).toBeDefined();
			expect(result.duration).toBeGreaterThanOrEqual(0);
		});

		it("should reject empty command", async () => {
			const params: AgentActionParams = {
				command: "",
			};

			const result = await executor.execute(params);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error?.message).toContain(
				"Invalid agent action parameters"
			);
		});

		it("should reject command without slash prefix", async () => {
			const params: AgentActionParams = {
				command: "speckit.clarify",
			};

			const result = await executor.execute(params);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error?.message).toContain(
				"Invalid agent action parameters"
			);
		});

		it("should reject command without proper agent prefix", async () => {
			const params: AgentActionParams = {
				command: "/invalid.command",
			};

			const result = await executor.execute(params);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});

		it("should handle sendPromptToChat errors gracefully", async () => {
			const params: AgentActionParams = {
				command: "/speckit.clarify",
			};

			const mockError = new Error("Chat failed");
			vi.mocked(sendPromptToChat).mockRejectedValueOnce(mockError);

			const result = await executor.execute(params);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error?.message).toBe("Chat failed");
			expect(result.duration).toBeDefined();
		});
	});

	describe("validateCommand", () => {
		it("should accept valid SpecKit commands", async () => {
			const validCommands = [
				"/speckit.specify",
				"/speckit.clarify",
				"/speckit.plan",
				"/speckit.analyze",
				"/speckit.checklist",
				"/speckit.research",
				"/speckit.design",
				"/speckit.tasks",
			];

			for (const command of validCommands) {
				const params: AgentActionParams = { command };
				const result = await executor.execute(params);
				expect(result.success).toBe(true);
			}
		});

		it("should accept valid OpenSpec commands", async () => {
			const validCommands = [
				"/openspec.analyze",
				"/openspec.validate",
				"/openspec.generate",
			];

			for (const command of validCommands) {
				const params: AgentActionParams = { command };
				const result = await executor.execute(params);
				expect(result.success).toBe(true);
			}
		});

		it("should reject commands with invalid format", async () => {
			const invalidCommands = [
				"/speckit", // Missing operation
				"/speckit.", // Empty operation
				"speckit.clarify", // Missing slash
				"/invalid.command", // Invalid agent
				"/speckit/clarify", // Wrong separator
				"/speckit..clarify", // Double dots
				"/speckit.clarify.extra", // Extra parts (but should work)
			];

			for (const command of invalidCommands) {
				const params: AgentActionParams = { command };
				const result = await executor.execute(params);

				if (command === "/speckit.clarify.extra") {
					// This should actually succeed as extra parts are allowed
					expect(result.success).toBe(true);
				} else {
					expect(result.success).toBe(false);
				}
			}
		});

		it("should reject commands with whitespace only", async () => {
			const params: AgentActionParams = {
				command: "   ",
			};

			const result = await executor.execute(params);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain(
				"Invalid agent action parameters"
			);
		});

		it("should reject operations with invalid characters", async () => {
			const invalidCommands = [
				"/speckit.clar@ify", // Invalid character @
				"/speckit.clar!ify", // Invalid character !
				"/speckit.clar ify", // Space
				"/speckit.clar#ify", // Invalid character #
			];

			for (const command of invalidCommands) {
				const params: AgentActionParams = { command };
				const result = await executor.execute(params);
				expect(result.success).toBe(false);
			}
		});

		it("should accept operations with hyphens and underscores", async () => {
			const validCommands = [
				"/speckit.my-command",
				"/speckit.my_command",
				"/speckit.my-long_command-name",
			];

			for (const command of validCommands) {
				const params: AgentActionParams = { command };
				const result = await executor.execute(params);
				expect(result.success).toBe(true);
			}
		});
	});

	describe("isSupported", () => {
		it("should return true for supported commands", () => {
			expect(executor.isSupported("/speckit.clarify")).toBe(true);
			expect(executor.isSupported("/openspec.analyze")).toBe(true);
			expect(executor.isSupported("/speckit.my-custom-command")).toBe(true);
		});

		it("should return false for unsupported commands", () => {
			expect(executor.isSupported("/invalid.command")).toBe(false);
			expect(executor.isSupported("speckit.clarify")).toBe(false);
			expect(executor.isSupported("/speckit")).toBe(false);
			expect(executor.isSupported("")).toBe(false);
			expect(executor.isSupported("/speckit.")).toBe(false);
		});

		it("should not throw errors for invalid commands", () => {
			expect(() => executor.isSupported("/invalid.command")).not.toThrow();
			expect(() => executor.isSupported("")).not.toThrow();
			expect(() => executor.isSupported("random text")).not.toThrow();
		});
	});

	describe("error handling", () => {
		it("should include error in result when validation fails", async () => {
			const params: AgentActionParams = {
				command: "/invalid.command",
			};

			const result = await executor.execute(params);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(Error);
			expect(result.error?.message).toBeDefined();
		});

		it("should include duration even when execution fails", async () => {
			const params: AgentActionParams = {
				command: "/invalid.command",
			};

			const result = await executor.execute(params);

			expect(result.success).toBe(false);
			expect(result.duration).toBeDefined();
			expect(result.duration).toBeGreaterThanOrEqual(0);
		});

		it("should handle very long commands", async () => {
			// Create a command that's within MAX_COMMAND_LENGTH (200)
			const longOperation = "a".repeat(100); // Total: /speckit. + 100 = 109 chars
			const params: AgentActionParams = {
				command: `/speckit.${longOperation}`,
			};

			const result = await executor.execute(params);

			// Should succeed as long as within MAX_COMMAND_LENGTH
			expect(result.success).toBe(true);
		});

		it("should reject commands exceeding MAX_COMMAND_LENGTH", async () => {
			// Create a command that exceeds MAX_COMMAND_LENGTH (200)
			const longOperation = "a".repeat(300);
			const params: AgentActionParams = {
				command: `/speckit.${longOperation}`,
			};

			const result = await executor.execute(params);

			// Should fail due to exceeding MAX_COMMAND_LENGTH
			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe("integration with sendPromptToChat", () => {
		it("should call sendPromptToChat with correct parameters", async () => {
			const params: AgentActionParams = {
				command: "/speckit.clarify",
			};

			await executor.execute(params);

			expect(sendPromptToChat).toHaveBeenCalledTimes(1);
			expect(sendPromptToChat).toHaveBeenCalledWith("/speckit.clarify", {
				instructionType: "runPrompt",
			});
		});

		it("should propagate sendPromptToChat success", async () => {
			vi.mocked(sendPromptToChat).mockResolvedValueOnce(undefined);

			const params: AgentActionParams = {
				command: "/speckit.plan",
			};

			const result = await executor.execute(params);

			expect(result.success).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should propagate sendPromptToChat errors", async () => {
			const error = new Error("Network timeout");
			vi.mocked(sendPromptToChat).mockRejectedValueOnce(error);

			const params: AgentActionParams = {
				command: "/speckit.analyze",
			};

			const result = await executor.execute(params);

			expect(result.success).toBe(false);
			expect(result.error).toBe(error);
		});
	});
});
