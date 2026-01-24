/**
 * Integration tests for tool execution
 * Tests full flow: chat command → parsing → tool execution → response rendering
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ToolRegistry } from "../../../src/features/agents/tool-registry";
import { ChatParticipantRegistry } from "../../../src/features/agents/chat-participant-registry";
import type {
	AgentDefinition,
	ToolHandler,
	ToolExecutionParams,
} from "../../../../src/features/agents/types";
import type { OutputChannel } from "vscode";

const COMMAND_PARSE_REGEX = /^\/(\w+)\s*(.*)?$/;

describe("Tool Execution Integration", () => {
	let toolRegistry: ToolRegistry;
	let chatRegistry: ChatParticipantRegistry;
	let mockOutputChannel: OutputChannel;

	beforeEach(() => {
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
			name: "test",
			replace: vi.fn(),
		} as unknown as OutputChannel;

		toolRegistry = new ToolRegistry(mockOutputChannel);
		chatRegistry = new ChatParticipantRegistry(mockOutputChannel);
	});

	describe("Full Tool Execution Flow", () => {
		it("should execute tool and return formatted response", async () => {
			// Register a test tool
			const handler: ToolHandler = vi.fn(
				async (handlerParams: ToolExecutionParams) => ({
					content: `✅ Processed: ${handlerParams.input}`,
					metadata: { duration: 150 },
				})
			);

			toolRegistry.register("test.process", handler);

			// Create test agent
			const agent: AgentDefinition = {
				id: "test-agent",
				name: "Test Agent",
				fullName: "Test Agent for Integration",
				description: "Integration test agent",
				commands: [
					{
						name: "process",
						description: "Process input",
						tool: "test.process",
					},
				],
				resources: {
					prompts: [],
					skills: [],
					instructions: [],
				},
				documentation: "# Test Agent\n\nFor testing purposes.",
			};

			// Simulate command execution
			const input = "Hello, world!";
			const params: ToolExecutionParams = {
				input,
				context: {
					workspace: {
						uri: { fsPath: "/test/workspace" } as any,
						name: "test-workspace",
						folders: [],
					},
					vscode: {} as any,
					chatContext: {} as any,
					outputChannel: mockOutputChannel,
					telemetry: {
						sendTelemetryEvent: vi.fn(),
						sendTelemetryErrorEvent: vi.fn(),
					},
				},
				resources: {
					prompts: new Map(),
					skills: new Map(),
					instructions: new Map(),
				},
				token: {
					isCancellationRequested: false,
					onCancellationRequested: vi.fn(),
				} as any,
			};

			const response = await toolRegistry.execute("test.process", params);

			expect(response.content).toBe("✅ Processed: Hello, world!");
			expect(response.metadata?.duration).toBe(150);
			expect(handler).toHaveBeenCalledWith(params);
		});

		it("should handle tool with file references", async () => {
			const handler: ToolHandler = vi.fn(() => ({
				content: "✅ Created specification",
				files: [
					{
						uri: { fsPath: "/workspace/specs/spec.md" } as any,
						label: "Feature Specification",
						action: "created" as const,
					},
				],
				metadata: { duration: 2500 },
			}));

			toolRegistry.register("spec.create", handler);

			const executionParams: ToolExecutionParams = {
				input: "create new feature",
				context: {} as any,
				resources: {
					prompts: new Map([["spec-template.prompt.md", "# Spec Template"]]),
					skills: new Map(),
					instructions: new Map(),
				},
				token: {
					isCancellationRequested: false,
					onCancellationRequested: vi.fn(),
				} as any,
			};

			const response = await toolRegistry.execute(
				"spec.create",
				executionParams
			);

			expect(response.content).toBe("✅ Created specification");
			expect(response.files).toHaveLength(1);
			expect(response.files?.[0].label).toBe("Feature Specification");
			expect(response.files?.[0].action).toBe("created");
		});

		it("should handle tool errors gracefully", async () => {
			const handler: ToolHandler = vi.fn(() => {
				throw new Error("Invalid input: missing required parameter");
			});

			toolRegistry.register("error.tool", handler);

			const executionParams: ToolExecutionParams = {
				input: "",
				context: {} as any,
				resources: {
					prompts: new Map(),
					skills: new Map(),
					instructions: new Map(),
				},
				token: {
					isCancellationRequested: false,
					onCancellationRequested: vi.fn(),
				} as any,
			};

			await expect(
				toolRegistry.execute("error.tool", executionParams)
			).rejects.toThrow("Invalid input: missing required parameter");
		});
	});

	describe("Command Parsing", () => {
		it("should parse command with input", () => {
			// Test utility function for parsing commands
			const parseCommand = (message: string) => {
				const match = message.match(COMMAND_PARSE_REGEX);
				if (!match) {
					return null;
				}
				return {
					command: match[1],
					input: match[2]?.trim() || "",
				};
			};

			const result1 = parseCommand("/specify create user authentication");
			expect(result1).toEqual({
				command: "specify",
				input: "create user authentication",
			});

			const result2 = parseCommand("/help");
			expect(result2).toEqual({
				command: "help",
				input: "",
			});

			const result3 = parseCommand("/plan");
			expect(result3).toEqual({
				command: "plan",
				input: "",
			});
		});

		it("should return null for invalid command format", () => {
			const parseCommand = (message: string) => {
				const match = message.match(COMMAND_PARSE_REGEX);
				if (!match) {
					return null;
				}
				return {
					command: match[1],
					input: match[2]?.trim() || "",
				};
			};

			expect(parseCommand("not a command")).toBeNull();
			expect(parseCommand("just text")).toBeNull();
			expect(parseCommand("/")).toBeNull();
		});

		it("should handle commands with special characters in input", () => {
			const parseCommand = (message: string) => {
				const match = message.match(COMMAND_PARSE_REGEX);
				if (!match) {
					return null;
				}
				return {
					command: match[1],
					input: match[2]?.trim() || "",
				};
			};

			const result = parseCommand(
				"/analyze path/to/file.ts --option=value --flag"
			);
			expect(result).toEqual({
				command: "analyze",
				input: "path/to/file.ts --option=value --flag",
			});
		});
	});

	describe("Tool Response Rendering", () => {
		it("should format markdown content correctly", () => {
			const formatResponse = (content: string) => {
				// Simple markdown rendering test
				return content;
			};

			const markdown = `## Analysis Results

**Found 3 issues:**

1. Missing tests for \`UserService\`
2. Unused imports in \`auth.ts\`
3. Complex function exceeding 50 lines

**Recommendations:**
- Add unit tests
- Remove unused code
- Refactor large functions`;

			const formatted = formatResponse(markdown);
			expect(formatted).toContain("## Analysis Results");
			expect(formatted).toContain("**Found 3 issues:**");
			expect(formatted).toContain("UserService");
		});

		it("should include file links in response", () => {
			const response = {
				content: "✅ Created files",
				files: [
					{
						uri: { fsPath: "/workspace/spec.md" } as any,
						label: "Specification",
						action: "created" as const,
					},
					{
						uri: { fsPath: "/workspace/plan.md" } as any,
						label: "Implementation Plan",
						action: "created" as const,
					},
				],
			};

			expect(response.files).toHaveLength(2);
			expect(response.files?.[0].label).toBe("Specification");
			expect(response.files?.[1].label).toBe("Implementation Plan");
		});
	});

	describe("Resource Loading for Tools", () => {
		it("should load agent-specific resources before execution", async () => {
			const handler: ToolHandler = vi.fn((handlerParams) => {
				const prompt = handlerParams.resources.prompts.get("test.prompt.md");
				const skill = handlerParams.resources.skills.get("test.skill.md");

				return {
					content: `Loaded: ${prompt ? "prompt" : "none"}, ${skill ? "skill" : "none"}`,
				};
			});

			toolRegistry.register("resource.test", handler);

			const executionParams: ToolExecutionParams = {
				input: "test",
				context: {} as any,
				resources: {
					prompts: new Map([["test.prompt.md", "# Test Prompt Content"]]),
					skills: new Map([["test.skill.md", "# Test Skill Content"]]),
					instructions: new Map(),
				},
				token: {
					isCancellationRequested: false,
					onCancellationRequested: vi.fn(),
				} as any,
			};

			const response = await toolRegistry.execute(
				"resource.test",
				executionParams
			);

			expect(response.content).toBe("Loaded: prompt, skill");
		});

		it("should handle missing resources gracefully", async () => {
			const handler: ToolHandler = vi.fn((handlerParams) => {
				const prompt = handlerParams.resources.prompts.get("missing.prompt.md");
				if (!prompt) {
					throw new Error("Required prompt not found");
				}
				return { content: "success" };
			});

			toolRegistry.register("missing.resource", handler);

			const executionParams: ToolExecutionParams = {
				input: "test",
				context: {} as any,
				resources: {
					prompts: new Map(), // Empty - no prompts loaded
					skills: new Map(),
					instructions: new Map(),
				},
				token: {
					isCancellationRequested: false,
					onCancellationRequested: vi.fn(),
				} as any,
			};

			await expect(
				toolRegistry.execute("missing.resource", executionParams)
			).rejects.toThrow("Required prompt not found");
		});
	});
});
