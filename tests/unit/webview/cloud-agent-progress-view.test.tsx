import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OrchestrationFeature } from "../../../ui/src/features/orchestration";

const NO_PROVIDERS_TEXT = /No cloud agent providers are registered yet/i;

vi.mock("../../../ui/src/bridge/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
		getState: vi.fn(() => ({})),
		setState: vi.fn(),
	},
}));

import { vscode } from "../../../ui/src/bridge/vscode";

const fakeVscode = vscode as unknown as {
	postMessage: ReturnType<typeof vi.fn>;
};

function postSnapshot(payload: unknown) {
	window.dispatchEvent(
		new MessageEvent("message", {
			data: {
				type: "orchestration/snapshot",
				payload,
			},
		})
	);
}

describe("OrchestrationFeature", () => {
	beforeEach(() => {
		fakeVscode.postMessage.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it("renders loading state before the first snapshot arrives", () => {
		render(<OrchestrationFeature />);
		expect(screen.getByText("Loading orchestration state...")).toBeTruthy();
		expect(fakeVscode.postMessage).toHaveBeenCalledWith({
			type: "orchestration/ready",
		});
	});

	it("renders provider-specific empty state guidance", async () => {
		render(<OrchestrationFeature />);
		postSnapshot({
			sessions: [],
			cloudProviderRegistryAvailable: true,
			cloudProviderCount: 0,
			generatedAt: Date.now(),
			degradedReasons: ["No cloud agent providers are registered."],
		});

		expect(await screen.findByText("Connect a cloud provider")).toBeTruthy();
		expect(await screen.findByText(NO_PROVIDERS_TEXT)).toBeTruthy();

		fireEvent.click(screen.getAllByText("Open Cloud Agents")[1]);
		expect(fakeVscode.postMessage).toHaveBeenCalledWith({
			type: "orchestration/open-existing-surface",
			payload: { source: "cloud-agent" },
		});
	});

	it("renders bucket columns", async () => {
		render(<OrchestrationFeature />);
		postSnapshot({
			sessions: [
				{
					id: "agent-chat:1",
					source: "agent-chat",
					sourceSessionId: "1",
					title: "OpenCode (code)",
					agentName: "OpenCode",
					state: "running",
					bucket: "active",
					createdAt: Date.now(),
					updatedAt: Date.now(),
					lastVisibleActivityAt: Date.now(),
					isBlocked: false,
					executionTargetLabel: "Local",
				},
			],
			cloudProviderRegistryAvailable: true,
			cloudProviderCount: 1,
			generatedAt: Date.now(),
			degradedReasons: [],
		});
		expect(
			await screen.findByTestId("orchestration-bucket-active")
		).toBeTruthy();
		expect(
			await screen.findByTestId("orchestration-bucket-waiting")
		).toBeTruthy();
		expect(
			await screen.findByTestId("orchestration-bucket-completed")
		).toBeTruthy();
		expect(
			await screen.findByTestId("orchestration-bucket-failed")
		).toBeTruthy();
	});

	it("renders representative active and failed sessions with actions", async () => {
		render(<OrchestrationFeature />);
		postSnapshot({
			sessions: [
				{
					id: "agent-chat:active-1",
					source: "agent-chat",
					sourceSessionId: "active-1",
					title: "Investigate sidebar refresh loop",
					agentName: "OpenCode",
					state: "running",
					bucket: "active",
					createdAt: 1_710_000_000_000,
					updatedAt: 1_710_000_001_000,
					lastVisibleActivityAt: 1_710_000_002_000,
					isBlocked: false,
					worktreeStatus: "in-use",
					executionTargetLabel: "Worktree",
				},
				{
					id: "cloud-agent:failed-1",
					source: "cloud-agent",
					sourceSessionId: "failed-1",
					title: "T042: Repair provider handshake",
					agentName: "Devin",
					state: "failed",
					bucket: "failed",
					createdAt: 1_710_000_003_000,
					updatedAt: 1_710_000_004_000,
					lastVisibleActivityAt: 1_710_000_005_000,
					isBlocked: false,
					executionTargetLabel: "Cloud",
					externalUrl: "https://example.test/session/failed-1",
					cloudProviderId: "devin",
				},
			],
			cloudProviderRegistryAvailable: true,
			cloudProviderCount: 1,
			activeProvider: {
				id: "devin",
				displayName: "Devin",
			},
			generatedAt: Date.now(),
			degradedReasons: [],
		});

		expect(
			await screen.findByText("Investigate sidebar refresh loop")
		).toBeTruthy();
		expect(
			await screen.findByText("T042: Repair provider handshake")
		).toBeTruthy();
		expect(await screen.findByText("in-use")).toBeTruthy();
		expect(await screen.findByText("failed")).toBeTruthy();
		expect(await screen.findAllByText("Open session")).toHaveLength(2);
		expect(await screen.findAllByText("Open original view")).toHaveLength(2);
		expect(await screen.findByText("Open external")).toBeTruthy();

		fireEvent.click((await screen.findAllByText("Open original view"))[0]);
		expect(fakeVscode.postMessage).toHaveBeenCalledWith({
			type: "orchestration/open-existing-surface",
			payload: { source: "agent-chat" },
		});

		fireEvent.click((await screen.findAllByText("Open original view"))[1]);
		expect(fakeVscode.postMessage).toHaveBeenCalledWith({
			type: "orchestration/open-existing-surface",
			payload: { source: "cloud-agent" },
		});

		fireEvent.click(await screen.findByText("Open external"));
		expect(fakeVscode.postMessage).toHaveBeenCalledWith({
			type: "orchestration/open-external",
			payload: { url: "https://example.test/session/failed-1" },
		});
	});

	it("renders degraded state messaging and orchestration actions", async () => {
		render(<OrchestrationFeature />);
		postSnapshot({
			sessions: [
				{
					id: "cloud-agent:1",
					source: "cloud-agent",
					sourceSessionId: "1",
					title: "T001: Fix auth race",
					agentName: "Devin",
					state: "blocked",
					bucket: "waiting",
					createdAt: Date.now(),
					updatedAt: Date.now(),
					lastVisibleActivityAt: Date.now(),
					isBlocked: true,
					executionTargetLabel: "Cloud",
					externalUrl: "https://example.test/session/1",
					cloudProviderId: "devin",
				},
			],
			cloudProviderRegistryAvailable: true,
			cloudProviderCount: 1,
			activeProvider: {
				id: "devin",
				displayName: "Devin",
			},
			generatedAt: Date.now(),
			degradedReasons: ["Cloud agent session storage is unavailable."],
		});

		expect(
			await screen.findByText("Cloud agent session storage is unavailable.")
		).toBeTruthy();
		expect(await screen.findByText("Status degraded")).toBeTruthy();
		expect(await screen.findByText("Open Cloud Agents")).toBeTruthy();
		expect(await screen.findByText("Open session")).toBeTruthy();
		expect(await screen.findByText("Open external")).toBeTruthy();

		fireEvent.click(screen.getByText("Refresh state"));
		expect(fakeVscode.postMessage).toHaveBeenCalledWith({
			type: "orchestration/refresh",
		});

		fireEvent.click(screen.getByText("Open Cloud Agents"));
		expect(fakeVscode.postMessage).toHaveBeenCalledWith({
			type: "orchestration/open-existing-surface",
			payload: { source: "cloud-agent" },
		});

		fireEvent.click(screen.getByText("Open session"));
		expect(fakeVscode.postMessage).toHaveBeenCalledWith({
			type: "orchestration/open-session",
			payload: { sessionId: "cloud-agent:1" },
		});
	});

	it("renders no-selected-provider guidance when providers exist but none is active", async () => {
		render(<OrchestrationFeature />);
		postSnapshot({
			sessions: [],
			cloudProviderRegistryAvailable: true,
			cloudProviderCount: 1,
			generatedAt: Date.now(),
			degradedReasons: [],
		});

		expect(
			await screen.findByText("No cloud provider is selected")
		).toBeTruthy();
		expect(
			await screen.findByText(
				"Agent Chat sessions will appear here automatically. Open Cloud Agents to choose a provider before dispatching remote work."
			)
		).toBeTruthy();
	});

	it("renders actionable degraded guidance for failed status reads", async () => {
		render(<OrchestrationFeature />);
		postSnapshot({
			sessions: [],
			cloudProviderRegistryAvailable: true,
			cloudProviderCount: 1,
			generatedAt: Date.now(),
			degradedReasons: ["Cloud agent status could not be read."],
		});

		expect(
			await screen.findByText("Session status is temporarily unavailable")
		).toBeTruthy();
		expect(
			await screen.findByText(
				"Refresh state to retry the latest reads, or open Cloud Agents for provider-specific status while the orchestration snapshot recovers."
			)
		).toBeTruthy();
	});
});
