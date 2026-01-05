/**
 * Unit tests for workspace state utilities
 * Tests welcome screen workspace-specific state management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type * as vscode from "vscode";
import {
	hasShownWelcomeBefore,
	markWelcomeAsShown,
	getDontShowOnStartup,
	setDontShowOnStartup,
	shouldShowWelcomeAutomatically,
	resetWelcomeState,
	getWelcomeState,
	WelcomeStateKeys,
} from "../../../src/utils/workspace-state";

describe("workspace-state utilities", () => {
	let mockContext: vscode.ExtensionContext;
	let workspaceStateMap: Map<string, any>;

	beforeEach(() => {
		// Create a fresh state map for each test
		workspaceStateMap = new Map();

		// Mock ExtensionContext with workspaceState
		mockContext = {
			workspaceState: {
				get: vi.fn(
					(key: string, defaultValue?: any) =>
						workspaceStateMap.get(key) ?? defaultValue
				),
				update: vi.fn((key: string, value: any) => {
					if (value === undefined) {
						workspaceStateMap.delete(key);
					} else {
						workspaceStateMap.set(key, value);
					}
				}),
				keys: vi.fn(() => Array.from(workspaceStateMap.keys())),
			},
		} as any;
	});

	describe("hasShownWelcomeBefore", () => {
		it("should return false for first-time workspace (no state)", () => {
			const result = hasShownWelcomeBefore(mockContext);
			expect(result).toBe(false);
		});

		it("should return true when welcome has been shown before", () => {
			workspaceStateMap.set(WelcomeStateKeys.HAS_SHOWN, true);
			const result = hasShownWelcomeBefore(mockContext);
			expect(result).toBe(true);
		});

		it("should return false when explicitly set to false", () => {
			workspaceStateMap.set(WelcomeStateKeys.HAS_SHOWN, false);
			const result = hasShownWelcomeBefore(mockContext);
			expect(result).toBe(false);
		});

		it("should call workspaceState.get with correct key", () => {
			hasShownWelcomeBefore(mockContext);
			expect(mockContext.workspaceState.get).toHaveBeenCalledWith(
				WelcomeStateKeys.HAS_SHOWN,
				false
			);
		});
	});

	describe("markWelcomeAsShown", () => {
		it("should set hasShown flag to true", async () => {
			await markWelcomeAsShown(mockContext);
			expect(workspaceStateMap.get(WelcomeStateKeys.HAS_SHOWN)).toBe(true);
		});

		it("should call workspaceState.update with correct arguments", async () => {
			await markWelcomeAsShown(mockContext);
			expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
				WelcomeStateKeys.HAS_SHOWN,
				true
			);
		});

		it("should persist across multiple calls", async () => {
			await markWelcomeAsShown(mockContext);
			await markWelcomeAsShown(mockContext);
			expect(workspaceStateMap.get(WelcomeStateKeys.HAS_SHOWN)).toBe(true);
		});
	});

	describe("getDontShowOnStartup", () => {
		it("should return false by default (user has not opted out)", () => {
			const result = getDontShowOnStartup(mockContext);
			expect(result).toBe(false);
		});

		it("should return true when user has opted out", () => {
			workspaceStateMap.set(WelcomeStateKeys.DONT_SHOW, true);
			const result = getDontShowOnStartup(mockContext);
			expect(result).toBe(true);
		});

		it("should return false when explicitly set to false", () => {
			workspaceStateMap.set(WelcomeStateKeys.DONT_SHOW, false);
			const result = getDontShowOnStartup(mockContext);
			expect(result).toBe(false);
		});

		it("should call workspaceState.get with correct key", () => {
			getDontShowOnStartup(mockContext);
			expect(mockContext.workspaceState.get).toHaveBeenCalledWith(
				WelcomeStateKeys.DONT_SHOW,
				false
			);
		});
	});

	describe("setDontShowOnStartup", () => {
		it("should set dontShow flag to true when user opts out", async () => {
			await setDontShowOnStartup(mockContext, true);
			expect(workspaceStateMap.get(WelcomeStateKeys.DONT_SHOW)).toBe(true);
		});

		it("should set dontShow flag to false when user opts in", async () => {
			await setDontShowOnStartup(mockContext, false);
			expect(workspaceStateMap.get(WelcomeStateKeys.DONT_SHOW)).toBe(false);
		});

		it("should call workspaceState.update with correct arguments", async () => {
			await setDontShowOnStartup(mockContext, true);
			expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
				WelcomeStateKeys.DONT_SHOW,
				true
			);
		});

		it("should allow toggling preference", async () => {
			await setDontShowOnStartup(mockContext, true);
			expect(workspaceStateMap.get(WelcomeStateKeys.DONT_SHOW)).toBe(true);

			await setDontShowOnStartup(mockContext, false);
			expect(workspaceStateMap.get(WelcomeStateKeys.DONT_SHOW)).toBe(false);
		});
	});

	describe("shouldShowWelcomeAutomatically", () => {
		it("should return true for first-time workspace (not shown, not opted out)", () => {
			const result = shouldShowWelcomeAutomatically(mockContext);
			expect(result).toBe(true);
		});

		it("should return false when user has opted out (even if first time)", () => {
			workspaceStateMap.set(WelcomeStateKeys.DONT_SHOW, true);
			const result = shouldShowWelcomeAutomatically(mockContext);
			expect(result).toBe(false);
		});

		it("should return false when already shown before", () => {
			workspaceStateMap.set(WelcomeStateKeys.HAS_SHOWN, true);
			const result = shouldShowWelcomeAutomatically(mockContext);
			expect(result).toBe(false);
		});

		it("should return false when both shown before AND opted out", () => {
			workspaceStateMap.set(WelcomeStateKeys.HAS_SHOWN, true);
			workspaceStateMap.set(WelcomeStateKeys.DONT_SHOW, true);
			const result = shouldShowWelcomeAutomatically(mockContext);
			expect(result).toBe(false);
		});

		it("should prioritize opt-out over first-time status", () => {
			// User opted out but welcome was never shown
			workspaceStateMap.set(WelcomeStateKeys.HAS_SHOWN, false);
			workspaceStateMap.set(WelcomeStateKeys.DONT_SHOW, true);
			const result = shouldShowWelcomeAutomatically(mockContext);
			expect(result).toBe(false);
		});
	});

	describe("resetWelcomeState", () => {
		it("should clear both hasShown and dontShow flags", async () => {
			workspaceStateMap.set(WelcomeStateKeys.HAS_SHOWN, true);
			workspaceStateMap.set(WelcomeStateKeys.DONT_SHOW, true);

			await resetWelcomeState(mockContext);

			expect(workspaceStateMap.has(WelcomeStateKeys.HAS_SHOWN)).toBe(false);
			expect(workspaceStateMap.has(WelcomeStateKeys.DONT_SHOW)).toBe(false);
		});

		it("should call workspaceState.update with undefined to clear", async () => {
			await resetWelcomeState(mockContext);

			expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
				WelcomeStateKeys.HAS_SHOWN,
				undefined
			);
			expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
				WelcomeStateKeys.DONT_SHOW,
				undefined
			);
		});

		it("should restore first-time behavior after reset", async () => {
			workspaceStateMap.set(WelcomeStateKeys.HAS_SHOWN, true);
			await resetWelcomeState(mockContext);

			const shouldShow = shouldShowWelcomeAutomatically(mockContext);
			expect(shouldShow).toBe(true);
		});
	});

	describe("getWelcomeState", () => {
		it("should return default state for fresh workspace", () => {
			const state = getWelcomeState(mockContext);
			expect(state).toEqual({
				hasShown: false,
				dontShow: false,
			});
		});

		it("should return current state when welcome has been shown", () => {
			workspaceStateMap.set(WelcomeStateKeys.HAS_SHOWN, true);
			const state = getWelcomeState(mockContext);
			expect(state).toEqual({
				hasShown: true,
				dontShow: false,
			});
		});

		it("should return current state when user has opted out", () => {
			workspaceStateMap.set(WelcomeStateKeys.DONT_SHOW, true);
			const state = getWelcomeState(mockContext);
			expect(state).toEqual({
				hasShown: false,
				dontShow: true,
			});
		});

		it("should return both flags when both are set", () => {
			workspaceStateMap.set(WelcomeStateKeys.HAS_SHOWN, true);
			workspaceStateMap.set(WelcomeStateKeys.DONT_SHOW, true);
			const state = getWelcomeState(mockContext);
			expect(state).toEqual({
				hasShown: true,
				dontShow: true,
			});
		});
	});

	describe("WelcomeStateKeys constant", () => {
		it("should have correct key for HAS_SHOWN", () => {
			expect(WelcomeStateKeys.HAS_SHOWN).toBe("gatomia.welcomeScreen.hasShown");
		});

		it("should have correct key for DONT_SHOW", () => {
			expect(WelcomeStateKeys.DONT_SHOW).toBe("gatomia.welcomeScreen.dontShow");
		});
	});

	describe("integration scenarios", () => {
		it("scenario: first-time user completes welcome flow", async () => {
			// Initial state: first time in workspace
			expect(shouldShowWelcomeAutomatically(mockContext)).toBe(true);
			expect(hasShownWelcomeBefore(mockContext)).toBe(false);

			// User views welcome screen
			await markWelcomeAsShown(mockContext);

			// After viewing, should not show automatically anymore
			expect(shouldShowWelcomeAutomatically(mockContext)).toBe(false);
			expect(hasShownWelcomeBefore(mockContext)).toBe(true);
		});

		it("scenario: user opts out during first-time welcome", async () => {
			// User sees welcome for first time and opts out
			await setDontShowOnStartup(mockContext, true);
			await markWelcomeAsShown(mockContext);

			// Should not show automatically
			expect(shouldShowWelcomeAutomatically(mockContext)).toBe(false);

			// Both flags should be set
			const state = getWelcomeState(mockContext);
			expect(state.hasShown).toBe(true);
			expect(state.dontShow).toBe(true);
		});

		it("scenario: user re-enables automatic display", async () => {
			// User had opted out
			await setDontShowOnStartup(mockContext, true);
			await markWelcomeAsShown(mockContext);

			// User re-enables
			await setDontShowOnStartup(mockContext, false);

			// Should not show automatically (because already shown before)
			expect(shouldShowWelcomeAutomatically(mockContext)).toBe(false);
			expect(getDontShowOnStartup(mockContext)).toBe(false);
		});

		it("scenario: admin resets extension state", async () => {
			// User has seen welcome and opted out
			await markWelcomeAsShown(mockContext);
			await setDontShowOnStartup(mockContext, true);

			// Admin resets state
			await resetWelcomeState(mockContext);

			// Should behave like first-time again
			expect(shouldShowWelcomeAutomatically(mockContext)).toBe(true);
			expect(hasShownWelcomeBefore(mockContext)).toBe(false);
			expect(getDontShowOnStartup(mockContext)).toBe(false);
		});
	});
});
