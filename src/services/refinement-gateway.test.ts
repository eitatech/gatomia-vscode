import { describe, it, expect, vi, beforeEach } from "vitest";
import { RefinementGateway } from "./refinement-gateway";
import type { RefinementRequestPayload } from "../types/preview";
import { sendPromptToChat } from "../utils/chat-prompt-runner";

vi.mock("../utils/chat-prompt-runner", () => ({
	sendPromptToChat: vi.fn(),
}));

vi.mock("vscode", () => ({
	env: {
		machineId: "test-machine-id",
	},
}));

describe("RefinementGateway", () => {
	let gateway: RefinementGateway;
	let mockOutputChannel: {
		appendLine: ReturnType<typeof vi.fn>;
		append: ReturnType<typeof vi.fn>;
		clear: ReturnType<typeof vi.fn>;
		dispose: ReturnType<typeof vi.fn>;
		hide: ReturnType<typeof vi.fn>;
		show: ReturnType<typeof vi.fn>;
		replace: ReturnType<typeof vi.fn>;
		name: string;
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
			hide: vi.fn(),
			show: vi.fn(),
			replace: vi.fn(),
			name: "Test Channel",
		};
		gateway = new RefinementGateway(mockOutputChannel as any);
	});

	describe("submitRequest", () => {
		it("should send spec document refinement to /speckit.specify", async () => {
			const payload: RefinementRequestPayload = {
				requestId: "test-123",
				documentId: "001-feature-spec",
				documentType: "spec",
				issueType: "missingDetail",
				description: "Need more details on API endpoints",
				submittedAt: "2025-12-15T10:00:00Z",
			};

			const result = await gateway.submitRequest(payload);

			expect(result.status).toBe("success");
			expect(result.requestId).toBe("test-123");
			expect(result.message).toBe("Refinement request sent to agent");
			expect(sendPromptToChat).toHaveBeenCalledWith(
				expect.stringContaining("/speckit.specify")
			);
			expect(sendPromptToChat).toHaveBeenCalledWith(
				expect.stringContaining("001-feature-spec")
			);
			expect(sendPromptToChat).toHaveBeenCalledWith(
				expect.stringContaining("Need more details on API endpoints")
			);
		});

		it("should send plan document refinement to /speckit.plan", async () => {
			const payload: RefinementRequestPayload = {
				requestId: "test-456",
				documentId: "002-implementation-plan",
				documentType: "plan",
				issueType: "incorrectInfo",
				description: "Timeline needs adjustment",
				submittedAt: "2025-12-15T10:00:00Z",
			};

			await gateway.submitRequest(payload);

			expect(sendPromptToChat).toHaveBeenCalledWith(
				expect.stringContaining("/speckit.plan")
			);
		});

		it("should send task document refinement to /speckit.tasks", async () => {
			const payload: RefinementRequestPayload = {
				requestId: "test-789",
				documentId: "003-tasks",
				documentType: "task",
				issueType: "missingDetail",
				description: "Add acceptance criteria",
				submittedAt: "2025-12-15T10:00:00Z",
			};

			await gateway.submitRequest(payload);

			expect(sendPromptToChat).toHaveBeenCalledWith(
				expect.stringContaining("/speckit.tasks")
			);
		});

		it("should include section reference in prompt when provided", async () => {
			const payload: RefinementRequestPayload = {
				requestId: "test-section",
				documentId: "spec-doc",
				documentType: "spec",
				sectionRef: "Architecture Overview",
				issueType: "missingDetail",
				description: "Need diagram",
				submittedAt: "2025-12-15T10:00:00Z",
			};

			await gateway.submitRequest(payload);

			expect(sendPromptToChat).toHaveBeenCalledWith(
				expect.stringContaining("Section: Architecture Overview")
			);
		});

		it("should format issue type as human-readable label", async () => {
			const payload: RefinementRequestPayload = {
				requestId: "test-label",
				documentId: "spec-doc",
				documentType: "spec",
				issueType: "missingDetail",
				description: "Test",
				submittedAt: "2025-12-15T10:00:00Z",
			};

			await gateway.submitRequest(payload);

			expect(sendPromptToChat).toHaveBeenCalledWith(
				expect.stringContaining("Missing Detail")
			);
		});

		it("should handle errors when sending to chat fails", async () => {
			const payload: RefinementRequestPayload = {
				requestId: "test-error",
				documentId: "spec-doc",
				documentType: "spec",
				issueType: "missingDetail",
				description: "Test",
				submittedAt: "2025-12-15T10:00:00Z",
			};

			vi.mocked(sendPromptToChat).mockRejectedValueOnce(
				new Error("Chat not available")
			);

			const result = await gateway.submitRequest(payload);

			expect(result.status).toBe("error");
			expect(result.message).toContain("Failed to send refinement");
			expect(result.message).toContain("Chat not available");
		});

		it("should log all refinement operations", async () => {
			const payload: RefinementRequestPayload = {
				requestId: "test-log",
				documentId: "spec-doc",
				documentType: "spec",
				issueType: "missingDetail",
				description: "Test",
				submittedAt: "2025-12-15T10:00:00Z",
			};

			await gateway.submitRequest(payload);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("[RefinementGateway] Processing")
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Sending refinement to spec agent")
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Successfully sent refinement request")
			);
		});

		it("should generate request ID if not provided", async () => {
			const payload: RefinementRequestPayload = {
				requestId: "",
				documentId: "spec-doc",
				documentType: "spec",
				issueType: "missingDetail",
				description: "Test",
				submittedAt: "2025-12-15T10:00:00Z",
			};

			const result = await gateway.submitRequest(payload);

			expect(result.requestId).toBeTruthy();
			expect(result.requestId).not.toBe("");
		});

		it("should use /speckit.research for research documents", async () => {
			const payload: RefinementRequestPayload = {
				requestId: "test-research",
				documentId: "research-doc",
				documentType: "research",
				issueType: "missingDetail",
				description: "Add more sources",
				submittedAt: "2025-12-15T10:00:00Z",
			};

			await gateway.submitRequest(payload);

			expect(sendPromptToChat).toHaveBeenCalledWith(
				expect.stringContaining("/speckit.research")
			);
		});

		it("should use /speckit.checklist for checklist documents", async () => {
			const payload: RefinementRequestPayload = {
				requestId: "test-checklist",
				documentId: "checklist-doc",
				documentType: "checklist",
				issueType: "missingDetail",
				description: "Add validation steps",
				submittedAt: "2025-12-15T10:00:00Z",
			};

			await gateway.submitRequest(payload);

			expect(sendPromptToChat).toHaveBeenCalledWith(
				expect.stringContaining("/speckit.checklist")
			);
		});
	});
});
