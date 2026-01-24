/**
 * Integration test for /help command end-to-end
 * T066 - Full help command flow
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type * as vscode from "vscode";
import { ToolRegistry } from "../../../src/features/agents/tool-registry";
import { ChatParticipantRegistry } from "../../../src/features/agents/chat-participant-registry";
import type { AgentDefinition } from "../../../src/features/agents/types";

const SLASH_PREFIX_REGEX = /^\//;

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

describe("Help Command Integration Tests", () => {
	let toolRegistry: ToolRegistry;
	let chatRegistry: ChatParticipantRegistry;
	let mockOutputChannel: vscode.OutputChannel;

	const testAgent: AgentDefinition = {
		id: "docs-agent",
		name: "Docs",
		fullName: "Documentation Agent",
		description: "Helps you write and maintain documentation",
		commands: [
			{
				name: "write",
				description: "Write documentation for code",
				tool: "docs.write",
				parameters: "<file-path>",
			},
			{
				name: "review",
				description: "Review documentation quality",
				tool: "docs.review",
			},
			{
				name: "help",
				description: "Show help information",
				tool: "agent.help",
			},
		],
		resources: {
			prompts: [],
			skills: [],
			instructions: [],
		},
		filePath: "/test/docs-agent.md",
		content: `# Documentation Agent

Helps you create and maintain high-quality documentation.

## Commands

### /write
Writes comprehensive documentation for the specified file or component.

**Usage**: \`@docs /write <file-path>\`

**Parameters**:
- \`file-path\`: Path to the file to document

**Examples**:
- \`@docs /write src/utils/helper.ts\` - Document a utility file
- \`@docs /write src/components/Button.tsx\` - Document a React component

**What it does**:
1. Analyzes the code structure
2. Generates JSDoc comments
3. Creates usage examples
4. Adds inline explanations

### /review
Reviews existing documentation and suggests improvements.

**Usage**: \`@docs /review\`

**What it checks**:
- Completeness of documentation
- Accuracy of examples
- Clarity of explanations
- Consistency with code
`,
	};

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

		// Register help handler (will be implemented)
		const helpHandler = (params: any): Promise<any> => {
			const agent = params.context.agent as AgentDefinition;
			const input = params.input.trim();

			if (!input) {
				const commandList = agent.commands
					.filter((cmd) => cmd.name !== "help")
					.map(
						(cmd) =>
							`### /${cmd.name}\n${cmd.description}${cmd.parameters ? `\n**Parameters**: ${cmd.parameters}` : ""}`
					)
					.join("\n\n");

				return Promise.resolve({
					content: `# ${agent.fullName}\n\n${agent.description}\n\n## Available Commands\n\n${commandList}\n\n---\n\n**Tip**: Type \`@${agent.id} /help <command>\` for detailed help on a specific command.`,
				});
			}

			const commandName = input.replace(SLASH_PREFIX_REGEX, "");
			const command = agent.commands.find((cmd) => cmd.name === commandName);

			if (!command) {
				return Promise.resolve({
					content: `❌ Command "/${commandName}" not found.\n\nUse \`@${agent.id} /help\` to see available commands.`,
				});
			}

			const contentLines = agent.content.split("\n");
			const commandSection: string[] = [];
			let capturing = false;

			for (const line of contentLines) {
				if (line.startsWith(`### /${commandName}`)) {
					capturing = true;
				}

				if (capturing) {
					if (
						line.startsWith("### /") &&
						!line.startsWith(`### /${commandName}`)
					) {
						break;
					}
					commandSection.push(line);
				}
			}

			const helpContent =
				commandSection.length > 0
					? commandSection.join("\n")
					: `### /${command.name}\n\n${command.description}`;

			return Promise.resolve({
				content: `# ${agent.name} - /${command.name}\n\n${helpContent}`,
			});
		};

		toolRegistry.register("agent.help", helpHandler);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("T066 - End-to-end help command flow", () => {
		it("should display general help when /help is invoked without parameters", async () => {
			chatRegistry.registerAgent(testAgent);

			const mockRequest = {
				prompt: "",
				command: "help",
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
				agent: testAgent,
				request: mockRequest,
				context: mockContext,
				stream: mockStream,
				token: mockToken,
			});

			// Verify help content was rendered
			expect(mockStream.markdown).toHaveBeenCalled();
			const renderedContent = (mockStream.markdown as any).mock.calls
				.map((call: any[]) => call[0])
				.join("");

			expect(renderedContent).toContain("Documentation Agent");
			expect(renderedContent).toContain("Available Commands");
			expect(renderedContent).toContain("/write");
			expect(renderedContent).toContain("/review");
			expect(renderedContent).not.toContain("### /help"); // Help command should be excluded from command list
		});

		it("should display command-specific help when parameter is provided", async () => {
			chatRegistry.registerAgent(testAgent);

			const mockRequest = {
				prompt: "write",
				command: "help",
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
				agent: testAgent,
				request: mockRequest,
				context: mockContext,
				stream: mockStream,
				token: mockToken,
			});

			const renderedContent = (mockStream.markdown as any).mock.calls
				.map((call: any[]) => call[0])
				.join("");

			expect(renderedContent).toContain("/write");
			expect(renderedContent).toContain("Usage");
			expect(renderedContent).toContain("@docs /write <file-path>");
			expect(renderedContent).toContain("Examples");
			expect(renderedContent).toContain("src/utils/helper.ts");
		});

		it("should show error for non-existent command", async () => {
			chatRegistry.registerAgent(testAgent);

			const mockRequest = {
				prompt: "nonexistent",
				command: "help",
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
				agent: testAgent,
				request: mockRequest,
				context: mockContext,
				stream: mockStream,
				token: mockToken,
			});

			const renderedContent = (mockStream.markdown as any).mock.calls
				.map((call: any[]) => call[0])
				.join("");

			expect(renderedContent).toContain("not found");
			expect(renderedContent).toContain("nonexistent");
		});

		it("should complete help request within 200ms", async () => {
			chatRegistry.registerAgent(testAgent);

			const mockRequest = {
				prompt: "",
				command: "help",
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

			const startTime = Date.now();

			await (chatRegistry as any).handleChatRequest({
				agent: testAgent,
				request: mockRequest,
				context: mockContext,
				stream: mockStream,
				token: mockToken,
			});

			const duration = Date.now() - startTime;

			expect(duration).toBeLessThan(200);
		});

		it("should include footer with tip for specific command help", async () => {
			chatRegistry.registerAgent(testAgent);

			const mockRequest = {
				prompt: "",
				command: "help",
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
				agent: testAgent,
				request: mockRequest,
				context: mockContext,
				stream: mockStream,
				token: mockToken,
			});

			const renderedContent = (mockStream.markdown as any).mock.calls
				.map((call: any[]) => call[0])
				.join("");

			expect(renderedContent).toContain("@docs-agent /help <command>");
		});
	});
});
