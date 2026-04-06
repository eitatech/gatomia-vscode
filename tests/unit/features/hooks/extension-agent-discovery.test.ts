/**
 * Unit Tests: ExtensionAgentDiscovery
 *
 * Tests for discovering agents from VS Code extensions via chatParticipants
 * contribution point.
 *
 * Test Strategy:
 * - Mock vscode.extensions.all to provide test extension data
 * - Verify extension manifest scanning logic
 * - Verify chatParticipants extraction and conversion
 * - Verify agent ID generation (extension:participant format)
 * - Verify source and type metadata
 *
 * @see src/features/hooks/extension-agent-discovery.ts
 * @see specs/011-custom-agent-hooks/contracts/agent-registry-api.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Extension } from "vscode";

// ============================================================================
// Mock vscode module at top level
// ============================================================================

// Create a mutable mock state
const mockState = {
	extensions: [] as readonly Extension<any>[],
};

// Mock vscode module
vi.mock("vscode", () => ({
	extensions: {
		get all() {
			return mockState.extensions;
		},
		getExtension: (id: string) =>
			mockState.extensions.find((ext) => ext.id === id),
	},
}));

// Import after mocking
const { ExtensionAgentDiscovery } = await import(
	"../../../../src/features/hooks/extension-agent-discovery"
);

// ============================================================================
// Test Setup
// ============================================================================

describe("ExtensionAgentDiscovery", () => {
	let discovery: InstanceType<typeof ExtensionAgentDiscovery>;

	beforeEach(() => {
		discovery = new ExtensionAgentDiscovery();
		// Reset mock state
		mockState.extensions = [];
	});

	afterEach(() => {
		mockState.extensions = [];
	});

	// ========================================================================
	// T068: Extension Manifest Scanning
	// ========================================================================

	describe("discoverAgents()", () => {
		it("should discover agents from extensions with chatParticipants contribution", async () => {
			// Setup mock extensions
			mockState.extensions = [
				{
					id: "github.copilot",
					packageJSON: {
						contributes: {
							chatParticipants: [
								{
									id: "copilot",
									name: "copilot",
									description: "GitHub Copilot",
								},
							],
						},
					},
					isActive: true,
				},
			] as unknown as readonly Extension<any>[];

			const result = await discovery.discoverAgents();

			expect(result.agents).toHaveLength(1);
			expect(result.agents[0]?.id).toBe("extension:github.copilot:copilot");
			expect(result.agents[0]?.name).toBe("copilot");
			expect(result.agents[0]?.displayName).toBe("copilot");
			expect(result.agents[0]?.description).toBe("GitHub Copilot");
			expect(result.agents[0]?.type).toBe("background");
			expect(result.agents[0]?.source).toBe("extension");
			expect(result.agents[0]?.available).toBe(true);
		});

		it("should handle extensions without chatParticipants contribution", async () => {
			mockState.extensions = [
				{
					id: "other.extension",
					packageJSON: {
						contributes: {
							// No chatParticipants
						},
					},
					isActive: false,
				},
			] as unknown as readonly Extension<any>[];

			const result = await discovery.discoverAgents();

			expect(result.agents).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
		});

		it("should handle extensions with empty chatParticipants array", async () => {
			mockState.extensions = [
				{
					id: "empty.extension",
					packageJSON: {
						contributes: {
							chatParticipants: [],
						},
					},
					isActive: true,
				},
			] as unknown as readonly Extension<any>[];

			const result = await discovery.discoverAgents();

			expect(result.agents).toHaveLength(0);
		});

		it("should discover multiple agents from single extension", async () => {
			mockState.extensions = [
				{
					id: "multi.extension",
					packageJSON: {
						contributes: {
							chatParticipants: [
								{
									id: "agent1",
									name: "agent1",
									description: "Agent 1",
								},
								{
									id: "agent2",
									name: "agent2",
									description: "Agent 2",
								},
							],
						},
					},
					isActive: true,
				},
			] as unknown as readonly Extension<any>[];

			const result = await discovery.discoverAgents();

			expect(result.agents).toHaveLength(2);
			expect(result.agents[0]?.id).toBe("extension:multi.extension:agent1");
			expect(result.agents[1]?.id).toBe("extension:multi.extension:agent2");
		});

		it("should discover agents from multiple extensions", async () => {
			mockState.extensions = [
				{
					id: "ext1",
					packageJSON: {
						contributes: {
							chatParticipants: [
								{
									id: "agent1",
									name: "agent1",
									description: "Agent from Ext 1",
								},
							],
						},
					},
					isActive: true,
				},
				{
					id: "ext2",
					packageJSON: {
						contributes: {
							chatParticipants: [
								{
									id: "agent2",
									name: "agent2",
									description: "Agent from Ext 2",
								},
							],
						},
					},
					isActive: true,
				},
			] as unknown as readonly Extension<any>[];

			const result = await discovery.discoverAgents();

			expect(result.agents).toHaveLength(2);
			expect(result.agents[0]?.id).toBe("extension:ext1:agent1");
			expect(result.agents[1]?.id).toBe("extension:ext2:agent2");
		});

		it("should handle malformed extension manifests gracefully", async () => {
			mockState.extensions = [
				{
					id: "malformed.extension",
					packageJSON: {
						contributes: {
							chatParticipants: "not-an-array", // Invalid type
						},
					},
					isActive: true,
				},
			] as unknown as readonly Extension<any>[];

			const result = await discovery.discoverAgents();

			expect(result.agents).toHaveLength(0);
			// Should not throw, just skip malformed entries
		});

		it("should set discoveredAt timestamp for all agents", async () => {
			mockState.extensions = [
				{
					id: "test.extension",
					packageJSON: {
						contributes: {
							chatParticipants: [
								{
									id: "test-agent",
									name: "test-agent",
									description: "Test Agent",
								},
							],
						},
					},
					isActive: true,
				},
			] as unknown as readonly Extension<any>[];

			const before = Date.now();
			const result = await discovery.discoverAgents();
			const after = Date.now();

			expect(result.agents[0]?.discoveredAt).toBeGreaterThanOrEqual(before);
			expect(result.agents[0]?.discoveredAt).toBeLessThanOrEqual(after);
		});
	});

	// ========================================================================
	// T069: chatParticipants Extraction
	// ========================================================================

	describe("getAgentFromExtension()", () => {
		it("should get agent from specific extension by ID", async () => {
			mockState.extensions = [
				{
					id: "github.copilot",
					packageJSON: {
						contributes: {
							chatParticipants: [
								{
									id: "copilot",
									name: "copilot",
									description: "GitHub Copilot",
								},
							],
						},
					},
					isActive: true,
				},
			] as unknown as readonly Extension<any>[];

			const agent = await discovery.getAgentFromExtension("github.copilot");

			expect(agent).toBeDefined();
			expect(agent?.id).toBe("extension:github.copilot:copilot");
			expect(agent?.name).toBe("copilot");
			expect(agent?.type).toBe("background");
			expect(agent?.source).toBe("extension");
		});

		it("should return undefined for extension without chatParticipants", async () => {
			mockState.extensions = [
				{
					id: "other.extension",
					packageJSON: {
						contributes: {},
					},
					isActive: false,
				},
			] as unknown as readonly Extension<any>[];

			const agent = await discovery.getAgentFromExtension("other.extension");

			expect(agent).toBeUndefined();
		});

		it("should return undefined for non-existent extension", async () => {
			mockState.extensions = [];

			const agent = await discovery.getAgentFromExtension(
				"non.existent.extension"
			);

			expect(agent).toBeUndefined();
		});

		it("should return first agent if extension has multiple chatParticipants", async () => {
			mockState.extensions = [
				{
					id: "multi.extension",
					packageJSON: {
						contributes: {
							chatParticipants: [
								{
									id: "first-agent",
									name: "first-agent",
									description: "First Agent",
								},
								{
									id: "second-agent",
									name: "second-agent",
									description: "Second Agent",
								},
							],
						},
					},
					isActive: true,
				},
			] as unknown as readonly Extension<any>[];

			const agent = await discovery.getAgentFromExtension("multi.extension");

			expect(agent).toBeDefined();
			expect(agent?.id).toBe("extension:multi.extension:first-agent");
		});
	});

	describe("isAgentExtension()", () => {
		it("should return true for extension with chatParticipants", () => {
			mockState.extensions = [
				{
					id: "agent.extension",
					packageJSON: {
						contributes: {
							chatParticipants: [
								{
									id: "test-agent",
									name: "test-agent",
									description: "Test Agent",
								},
							],
						},
					},
					isActive: true,
				},
			] as unknown as readonly Extension<any>[];

			const result = discovery.isAgentExtension("agent.extension");

			expect(result).toBe(true);
		});

		it("should return false for extension without chatParticipants", () => {
			mockState.extensions = [
				{
					id: "other.extension",
					packageJSON: {
						contributes: {},
					},
					isActive: false,
				},
			] as unknown as readonly Extension<any>[];

			const result = discovery.isAgentExtension("other.extension");

			expect(result).toBe(false);
		});

		it("should return false for non-existent extension", () => {
			mockState.extensions = [];

			const result = discovery.isAgentExtension("non.existent.extension");

			expect(result).toBe(false);
		});

		it("should return false for extension with empty chatParticipants array", () => {
			mockState.extensions = [
				{
					id: "empty.extension",
					packageJSON: {
						contributes: {
							chatParticipants: [],
						},
					},
					isActive: true,
				},
			] as unknown as readonly Extension<any>[];

			const result = discovery.isAgentExtension("empty.extension");

			expect(result).toBe(false);
		});
	});

	// ========================================================================
	// Edge Cases
	// ========================================================================

	describe("edge cases", () => {
		it("should handle undefined packageJSON gracefully", async () => {
			mockState.extensions = [
				{
					id: "broken.extension",
					packageJSON: undefined,
					isActive: false,
				},
			] as unknown as readonly Extension<any>[];

			const result = await discovery.discoverAgents();

			expect(result.agents).toHaveLength(0);
			// Should not throw
		});

		it("should handle undefined contributes gracefully", async () => {
			mockState.extensions = [
				{
					id: "no-contributes.extension",
					packageJSON: {
						// No contributes field
					},
					isActive: true,
				},
			] as unknown as readonly Extension<any>[];

			const result = await discovery.discoverAgents();

			expect(result.agents).toHaveLength(0);
		});

		it("should handle participant without required fields", async () => {
			mockState.extensions = [
				{
					id: "incomplete.extension",
					packageJSON: {
						contributes: {
							chatParticipants: [
								{
									// Missing id, name, description
								},
							],
						},
					},
					isActive: true,
				},
			] as unknown as readonly Extension<any>[];

			const result = await discovery.discoverAgents();

			// Should skip invalid entries
			expect(result.agents).toHaveLength(0);
		});

		it("should include extensionId in agent metadata", async () => {
			mockState.extensions = [
				{
					id: "test.extension",
					packageJSON: {
						contributes: {
							chatParticipants: [
								{
									id: "test-agent",
									name: "test-agent",
									description: "Test Agent",
								},
							],
						},
					},
					isActive: true,
				},
			] as unknown as readonly Extension<any>[];

			const result = await discovery.discoverAgents();

			expect(result.agents[0]?.extensionId).toBe("test.extension");
		});
	});
});
