/**
 * Cloud Agent Store Tests
 *
 * Tests for the webview state store.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createCloudAgentStore } from "../../../ui/src/stores/cloud-agent-store";

describe("CloudAgentStore", () => {
	let store: ReturnType<typeof createCloudAgentStore>;

	beforeEach(() => {
		store = createCloudAgentStore();
	});

	it("should initialize with empty state", () => {
		const state = store.getState();
		expect(state.sessions).toEqual([]);
		expect(state.activeProvider).toBeNull();
		expect(state.isLoading).toBe(false);
		expect(state.error).toBeNull();
	});

	it("should update sessions", () => {
		store.setSessions([
			{
				localId: "s1",
				providerId: "devin",
				status: "running",
				displayStatus: "Running",
				branch: "main",
				specPath: "/spec.md",
				createdAt: Date.now(),
				updatedAt: Date.now(),
				isReadOnly: false,
				tasks: [],
				pullRequests: [],
			},
		]);
		expect(store.getState().sessions).toHaveLength(1);
		expect(store.getState().sessions[0].localId).toBe("s1");
	});

	it("should track active provider", () => {
		store.setActiveProvider({ id: "devin", displayName: "Devin" });
		expect(store.getState().activeProvider).toEqual({
			id: "devin",
			displayName: "Devin",
		});
	});

	it("should clear active provider", () => {
		store.setActiveProvider({ id: "devin", displayName: "Devin" });
		store.setActiveProvider(null);
		expect(store.getState().activeProvider).toBeNull();
	});

	it("should set loading state", () => {
		store.setLoading(true);
		expect(store.getState().isLoading).toBe(true);
		store.setLoading(false);
		expect(store.getState().isLoading).toBe(false);
	});

	it("should set error state", () => {
		store.setError("Something went wrong");
		expect(store.getState().error).toBe("Something went wrong");
		store.setError(null);
		expect(store.getState().error).toBeNull();
	});
});
