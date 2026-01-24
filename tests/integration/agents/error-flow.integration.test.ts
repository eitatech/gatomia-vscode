/**
 * Integration tests for error flow: error → log → display
 * T056 - Full error flow testing
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type * as vscode from "vscode";
import { ToolRegistry } from "../../../src/features/agents/tool-registry";
import { ChatParticipantRegistry } from "../../../src/features/agents/chat-participant-registry";
import {
	AgentError,
	ToolExecutionError,
	ResourceError,
	type AgentDefinition,
	type ToolHandler,
} from "../../../src/features/agents/types";

const TEMPLATE_OR_RESOURCE_REGEX = /template\.md|resource|missing/i;
const CANCEL_REGEX = /cancel/i;
const ERROR_OR_FAILED_REGEX = /error|failed/i;

// Mock VS Code API
vi.mock("vscode", () => ({
	Uri: {
		file: (path: string) => ({ fsPath: path, scheme: "file", path }),
	},
	chat: {
		createChatParticipant: vi.fn((id: string, handler: any) => ({
			iconPath: undefined,
			dispose: vi.fn(),
		})),
	},
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: "/test/workspace", scheme: "file" },
				name: "test-workspace",
				index: 0,
			},
		],
	},
	window: {},
	commands: {},
	ChatResponseStream: class ChatResponseStream {
		markdown = vi.fn();
		button = vi.fn();
		progress = vi.fn();
		reference = vi.fn();
		push = vi.fn();
	},
}));

describe("Error Flow Integration Tests", () => {
	let toolRegistry: ToolRegistry;
	let chatRegistry: ChatParticipantRegistry;
	let mockOutputChannel: vscode.OutputChannel;

	beforeEach(() => {
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
			name: "GatomIA Test",
			replace: vi.fn(),
		} as unknown as vscode.OutputChannel;

		toolRegistry = new ToolRegistry(mockOutputChannel);
		chatRegistry = new ChatParticipantRegistry(mockOutputChannel);
		chatRegistry.setToolRegistry(toolRegistry);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("T056 - Full error flow", () => {
		it("should handle tool execution error and display user-friendly message", async () => {
			// Register agent with failing tool
			const failingHandler: ToolHandler = vi.fn(() => {
				throw new Error("Database connection failed");
			});
			toolRegistry.register("data.query", failingHandler);

			const agent: AgentDefinition = {
				id: "test-agent",
				name: "Test Agent",
				fullName: "Test Agent for Errors",
				description: "Test agent for error handling",
				commands: [
					{
						name: "query",
						description: "Query data",
						tool: "data.query",
					},
				],
				resources: {
					prompts: [],
					skills: [],
					instructions: [],
				},
				filePath: "/test/agent.md",
				content: "# Test Agent",
			};

			chatRegistry.registerAgent(agent);

			// Create mock chat request
			const mockRequest = {
				prompt: "query users",
				command: "query",
			} as vscode.ChatRequest;

			const mockContext = {
				telemetry: {
					sendTelemetryEvent: vi.fn(),
					sendTelemetryErrorEvent: vi.fn(),
				},
			} as unknown as vscode.ChatContext;
			const mockToken = {
				isCancellationRequested: false,
				onCancellationRequested: vi.fn(),
			} as unknown as vscode.CancellationToken;

			const mockStream = {
				markdown: vi.fn(),
				button: vi.fn(),
				progress: vi.fn(),
			} as unknown as vscode.ChatResponseStream;

			// Execute and expect error handling
			await (chatRegistry as any).handleChatRequest({
				agent,
				request: mockRequest,
				context: mockContext,
				stream: mockStream,
				token: mockToken,
			});

			// Verify error was logged
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("ERROR")
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("data.query")
			);

			// Verify user-friendly error message was displayed
			expect(mockStream.markdown).toHaveBeenCalledWith(
				expect.stringMatching(ERROR_OR_FAILED_REGEX)
			);
		});

		it("should provide actionable guidance for missing resources", async () => {
			const resourceHandler: ToolHandler = vi.fn((params) => {
				const template = params.resources.prompts.get("template.md");
				if (!template) {
					throw new ResourceError(
						"Required template not found",
						"prompt",
						"template.md"
					);
				}
				return { content: template };
			});
			toolRegistry.register("template.render", resourceHandler);

			const agent: AgentDefinition = {
				id: "template-agent",
				name: "Template Agent",
				fullName: "Template Rendering Agent",
				description: "Renders templates",
				commands: [
					{
						name: "render",
						description: "Render template",
						tool: "template.render",
					},
				],
				resources: {
					prompts: ["template.md"], // Reference but don't provide
					skills: [],
					instructions: [],
				},
				filePath: "/test/agent.md",
				content: "# Template Agent",
			};

			chatRegistry.registerAgent(agent);

			const mockRequest = {
				prompt: "render my-template",
				command: "render",
			} as vscode.ChatRequest;

			const mockContext = {
				telemetry: {
					sendTelemetryEvent: vi.fn(),
					sendTelemetryErrorEvent: vi.fn(),
				},
			} as unknown as vscode.ChatContext;
			const mockToken = {
				isCancellationRequested: false,
				onCancellationRequested: vi.fn(),
			} as unknown as vscode.CancellationToken;

			const mockStream = {
				markdown: vi.fn(),
				button: vi.fn(),
				progress: vi.fn(),
			} as unknown as vscode.ChatResponseStream;

			// Execute and verify actionable guidance
			await (chatRegistry as any).handleChatRequest({
				agent,
				request: mockRequest,
				context: mockContext,
				stream: mockStream,
				token: mockToken,
			});

			// Verify actionable error message
			expect(mockStream.markdown).toHaveBeenCalledWith(
				expect.stringMatching(TEMPLATE_OR_RESOURCE_REGEX)
			);
		});

		it("should handle cancellation gracefully", async () => {
			const cancelHandler: ToolHandler = vi.fn((params) => {
				if (params.token.isCancellationRequested) {
					throw new AgentError("Operation cancelled", "CANCELLED");
				}
				return { content: "completed" };
			});
			toolRegistry.register("cancel.test", cancelHandler);

			const agent: AgentDefinition = {
				id: "cancel-agent",
				name: "Cancel Agent",
				fullName: "Cancellation Test Agent",
				description: "Tests cancellation",
				commands: [
					{
						name: "test",
						description: "Test cancellation",
						tool: "cancel.test",
					},
				],
				resources: {
					prompts: [],
					skills: [],
					instructions: [],
				},
				filePath: "/test/agent.md",
				content: "# Cancel Agent",
			};

			chatRegistry.registerAgent(agent);

			const mockRequest = {
				prompt: "test cancel",
				command: "test",
			} as vscode.ChatRequest;

			const mockContext = {
				telemetry: {
					sendTelemetryEvent: vi.fn(),
					sendTelemetryErrorEvent: vi.fn(),
				},
			} as unknown as vscode.ChatContext;
			const mockToken = {
				isCancellationRequested: true,
				onCancellationRequested: vi.fn(),
			} as unknown as vscode.CancellationToken;

			const mockStream = {
				markdown: vi.fn(),
				button: vi.fn(),
				progress: vi.fn(),
			} as unknown as vscode.ChatResponseStream;

			await (chatRegistry as any).handleChatRequest({
				agent,
				request: mockRequest,
				context: mockContext,
				stream: mockStream,
				token: mockToken,
			});

			// Verify cancellation message
			expect(mockStream.markdown).toHaveBeenCalledWith(
				expect.stringMatching(CANCEL_REGEX)
			);
		});

		it("should classify and report different error types via telemetry", async () => {
			const errors = [
				new AgentError("Agent config error", "CONFIG_ERROR"),
				new ToolExecutionError("Tool failed", "test.tool"),
				new ResourceError("Missing resource", "prompt", "test.md"),
			];

			for (const error of errors) {
				const errorHandler: ToolHandler = vi.fn(() => {
					throw error;
				});

				const toolName = `error-test-${errors.indexOf(error)}`;
				toolRegistry.register(toolName, errorHandler);

				const agent: AgentDefinition = {
					id: "error-agent",
					name: "Error Agent",
					fullName: "Error Classification Agent",
					description: "Tests error classification",
					commands: [
						{
							name: "test",
							description: "Test error",
							tool: toolName,
						},
					],
					resources: {
						prompts: [],
						skills: [],
						instructions: [],
					},
					filePath: "/test/agent.md",
					content: "# Error Agent",
				};

				chatRegistry.registerAgent(agent);

				const mockRequest = {
					prompt: "test error",
					command: "test",
				} as vscode.ChatRequest;

				const mockContext = {
					telemetry: {
						sendTelemetryEvent: vi.fn(),
						sendTelemetryErrorEvent: vi.fn(),
					},
				} as unknown as vscode.ChatContext;
				const mockToken = {
					isCancellationRequested: false,
					onCancellationRequested: vi.fn(),
				} as unknown as vscode.CancellationToken;

				const mockStream = {
					markdown: vi.fn(),
					button: vi.fn(),
					progress: vi.fn(),
				} as unknown as vscode.ChatResponseStream;

				await (chatRegistry as any).handleChatRequest({
					agent,
					request: mockRequest,
					context: mockContext,
					stream: mockStream,
					token: mockToken,
				});

				// Verify error was logged with correct classification
				expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
					expect.stringContaining(error.name)
				);
			}
		});

		it("should maintain error context through execution chain", async () => {
			const contextHandler: ToolHandler = vi.fn((params) => {
				try {
					// Simulate nested error
					throw new Error("Inner error with context");
				} catch (innerError) {
					throw new ToolExecutionError(
						"Failed to process request",
						"context.test",
						innerError as Error
					);
				}
			});

			toolRegistry.register("context.test", contextHandler);

			const agent: AgentDefinition = {
				id: "context-agent",
				name: "Context Agent",
				fullName: "Error Context Agent",
				description: "Tests error context",
				commands: [
					{
						name: "test",
						description: "Test context",
						tool: "context.test",
					},
				],
				resources: {
					prompts: [],
					skills: [],
					instructions: [],
				},
				filePath: "/test/agent.md",
				content: "# Context Agent",
			};

			chatRegistry.registerAgent(agent);

			const mockRequest = {
				prompt: "test context",
				command: "test",
			} as vscode.ChatRequest;

			const mockContext = {
				telemetry: {
					sendTelemetryEvent: vi.fn(),
					sendTelemetryErrorEvent: vi.fn(),
				},
			} as unknown as vscode.ChatContext;
			const mockToken = {
				isCancellationRequested: false,
				onCancellationRequested: vi.fn(),
			} as unknown as vscode.CancellationToken;

			const mockStream = {
				markdown: vi.fn(),
				button: vi.fn(),
				progress: vi.fn(),
			} as unknown as vscode.ChatResponseStream;

			await (chatRegistry as any).handleChatRequest({
				agent,
				request: mockRequest,
				context: mockContext,
				stream: mockStream,
				token: mockToken,
			});

			// Verify both inner and outer error contexts are logged
			const logCalls = (mockOutputChannel.appendLine as any).mock.calls;
			const logMessages = logCalls.map((call: any[]) => call[0]).join(" ");
			expect(logMessages).toContain("context.test");
			expect(logMessages).toContain("Inner error");
		});
	});
});
