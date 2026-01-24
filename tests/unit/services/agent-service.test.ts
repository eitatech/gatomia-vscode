/**
 * Unit tests for AgentService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AgentService } from "../../../src/services/agent-service";
import type { OutputChannel } from "vscode";

// Mock vscode module
vi.mock("vscode", async () => ({
	Uri: {
		file: (path: string) => ({
			fsPath: path,
			with: vi.fn(),
			toString: () => path,
		}),
		joinPath: (...paths: any[]) => ({
			fsPath: paths.map((p: any) => p.fsPath || p).join("/"),
			with: vi.fn(),
			toString: () => paths.map((p: any) => p.fsPath || p).join("/"),
		}),
	},
	chat: {
		createChatParticipant: vi.fn(() => ({
			dispose: vi.fn(),
		})),
	},
	workspace: {
		fs: {
			stat: vi.fn(),
			readDirectory: vi.fn(),
			readFile: vi.fn(),
		},
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
		onDidChangeConfiguration: vi.fn(() => ({
			dispose: vi.fn(),
		})),
	},
	FileType: {
		File: 1,
		Directory: 2,
	},
	Disposable: class {
		private fn: () => void;
		constructor(fn: () => void) {
			this.fn = fn;
		}
		dispose() {
			this.fn();
		}
	},
}));

// Mock AgentLoader
vi.mock("../../../src/features/agents/agent-loader", () => ({
	AgentLoader: class {
		private outputChannel: any;
		constructor(outputChannel: any) {
			this.outputChannel = outputChannel;
		}
		loadAgents(dir: string) {
			return Promise.resolve([
				{
					id: "test-agent",
					name: "Test Agent",
					fullName: "Test Agent Full",
					description: "Test description",
					commands: [
						{
							name: "test",
							description: "Test command",
							tool: "test.tool",
						},
					],
					resources: {},
					filePath: "/test/test-agent.agent.md",
					content: "# Test",
				},
			]);
		}
	},
}));

// Mock ChatParticipantRegistry
vi.mock("../../../src/features/agents/chat-participant-registry", () => ({
	ChatParticipantRegistry: class {
		private agents = new Set<string>();
		registerAgent(agent: any) {
			this.agents.add(agent.id);
			return {
				dispose: () => {
					this.agents.delete(agent.id);
				},
			};
		}
		getRegisteredAgents() {
			return Array.from(this.agents);
		}
		isRegistered(id: string) {
			return this.agents.has(id);
		}
		dispose() {
			this.agents.clear();
		}
		setToolRegistry() {
			// Mock implementation
		}
		setResourceCache() {
			// Mock implementation
		}
	},
}));

// Mock ResourceCache
vi.mock("../../../src/features/agents/resource-cache", () => ({
	ResourceCache: class {
		prompts = new Map();
		skills = new Map();
		instructions = new Map();
		load() {
			return Promise.resolve();
		}
		dispose() {
			// Mock implementation
		}
	},
}));

// Mock ToolRegistry
vi.mock("../../../src/features/agents/tool-registry", () => ({
	ToolRegistry: class {
		register() {
			// Mock implementation
		}
		dispose() {
			// Mock implementation
		}
	},
}));

// Mock ConfigurationService
vi.mock("../../../src/services/configuration-service", () => ({
	ConfigurationService: class {
		getConfiguration() {
			return {
				resourcesPath: "resources",
				enableHotReload: true,
				logLevel: "info",
			};
		}
		getResourcesPath() {
			return "resources";
		}
		isHotReloadEnabled() {
			return true;
		}
		getLogLevel() {
			return "info";
		}
	},
}));

describe("AgentService", () => {
	let service: AgentService;
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

		service = new AgentService(mockOutputChannel);
	});

	afterEach(() => {
		if (service) {
			service.dispose();
		}
		vi.clearAllMocks();
	});

	describe("initialize", () => {
		it("should initialize and load agents", async () => {
			await service.initialize("/test/extension/path");

			const agents = service.getAgents();
			expect(agents).toHaveLength(1);
			expect(agents[0].id).toBe("test-agent");
		});

		it("should register agents as chat participants", async () => {
			await service.initialize("/test/extension/path");

			const registered = service.getRegisteredAgentIds();
			expect(registered).toContain("test-agent");
		});

		it("should track registered agent count", async () => {
			await service.initialize("/test/extension/path");

			expect(service.getAgents()).toHaveLength(1);
			expect(service.getRegisteredAgentIds()).toHaveLength(1);
		});
	});

	describe("getAgents", () => {
		it("should return empty array before initialization", () => {
			expect(service.getAgents()).toEqual([]);
		});

		it("should return loaded agents after initialization", async () => {
			await service.initialize("/test/extension/path");

			const agents = service.getAgents();
			expect(agents).toHaveLength(1);
			expect(agents[0].id).toBe("test-agent");
		});

		it("should return a copy of agents array", async () => {
			await service.initialize("/test/extension/path");

			const agents1 = service.getAgents();
			const agents2 = service.getAgents();

			expect(agents1).not.toBe(agents2);
			expect(agents1).toEqual(agents2);
		});
	});

	describe("isAgentRegistered", () => {
		it("should return false for unregistered agent", async () => {
			await service.initialize("/test/extension/path");

			expect(service.isAgentRegistered("non-existent")).toBe(false);
		});

		it("should return true for registered agent", async () => {
			await service.initialize("/test/extension/path");

			expect(service.isAgentRegistered("test-agent")).toBe(true);
		});
	});

	describe("dispose", () => {
		it("should cleanup resources", async () => {
			await service.initialize("/test/extension/path");

			expect(service.getAgents()).toHaveLength(1);

			service.dispose();

			expect(service.getAgents()).toHaveLength(0);
		});

		it("should unregister all participants", async () => {
			await service.initialize("/test/extension/path");

			expect(service.getRegisteredAgentIds()).toHaveLength(1);

			service.dispose();

			expect(service.getRegisteredAgentIds()).toHaveLength(0);
		});
	});
});
