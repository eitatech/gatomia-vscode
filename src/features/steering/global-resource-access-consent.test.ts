import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigurationTarget, commands, window, workspace } from "vscode";
import {
	ensureGlobalResourceAccessConsent,
	getEffectiveGlobalResourceAccess,
	isGlobalResourceAccessAllowed,
	resetGlobalResourceAccessConsentSessionForTests,
} from "./global-resource-access-consent";

const createConfiguration = (values: Record<string, string | undefined>) => {
	const update = vi.fn().mockResolvedValue(undefined);
	const get = vi.fn((key: string) => values[key]);
	return {
		get,
		update,
	};
};

describe("global-resource-access-consent", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetGlobalResourceAccessConsentSessionForTests();
		vi.mocked(window.showInformationMessage).mockResolvedValue(undefined);
	});

	it("prioritizes workspace override over global default", () => {
		const config = createConfiguration({
			"steering.workspaceGlobalResourceAccess": "deny",
			"steering.globalResourceAccessDefault": "allow",
		});
		vi.mocked(workspace.getConfiguration).mockReturnValue(config as any);

		expect(getEffectiveGlobalResourceAccess()).toBe("deny");
		expect(isGlobalResourceAccessAllowed()).toBe(false);
	});

	it("uses global default when workspace override inherits", () => {
		const config = createConfiguration({
			"steering.workspaceGlobalResourceAccess": "inherit",
			"steering.globalResourceAccessDefault": "allow",
		});
		vi.mocked(workspace.getConfiguration).mockReturnValue(config as any);

		expect(getEffectiveGlobalResourceAccess()).toBe("allow");
		expect(isGlobalResourceAccessAllowed()).toBe(true);
	});

	it("stores allow decision in workspace settings from prompt", async () => {
		const config = createConfiguration({
			"steering.workspaceGlobalResourceAccess": "inherit",
			"steering.globalResourceAccessDefault": "ask",
		});
		vi.mocked(workspace.getConfiguration).mockReturnValue(config as any);
		vi.mocked(window.showInformationMessage).mockResolvedValue(
			"Allow for This Workspace" as any
		);

		const context = {
			workspaceState: {
				update: vi.fn().mockResolvedValue(undefined),
			},
		} as any;

		const result = await ensureGlobalResourceAccessConsent(context);

		expect(result).toBe(true);
		expect(config.update).toHaveBeenCalledWith(
			"steering.workspaceGlobalResourceAccess",
			"allow",
			ConfigurationTarget.Workspace
		);
		expect(context.workspaceState.update).toHaveBeenCalledWith(
			"gatomia.steering.globalResourceAccess.lastDecision",
			"allow"
		);
	});

	it("opens settings when requested from prompt", async () => {
		const config = createConfiguration({
			"steering.workspaceGlobalResourceAccess": "inherit",
			"steering.globalResourceAccessDefault": "ask",
		});
		vi.mocked(workspace.getConfiguration).mockReturnValue(config as any);
		vi.mocked(window.showInformationMessage).mockResolvedValue(
			"Open Settings" as any
		);

		const context = {
			workspaceState: {
				update: vi.fn().mockResolvedValue(undefined),
			},
		} as any;

		const result = await ensureGlobalResourceAccessConsent(context);

		expect(result).toBe(false);
		expect(commands.executeCommand).toHaveBeenCalledWith(
			"workbench.action.openSettings",
			"gatomia.steering.workspaceGlobalResourceAccess"
		);
		expect(config.update).not.toHaveBeenCalled();
	});

	it("falls back to workspace state when workspace setting cannot be written", async () => {
		const config = createConfiguration({
			"steering.workspaceGlobalResourceAccess": "inherit",
			"steering.globalResourceAccessDefault": "ask",
		});
		config.update.mockRejectedValue(
			new Error(
				"Unable to write to Workspace Settings because gatomia.steering.workspaceGlobalResourceAccess is not a registered configuration."
			)
		);
		vi.mocked(workspace.fs.readFile).mockRejectedValue(new Error("ENOENT"));
		vi.mocked(workspace.fs.writeFile).mockResolvedValue(undefined as any);
		vi.mocked(workspace.getConfiguration).mockReturnValue(config as any);
		vi.mocked(window.showInformationMessage).mockResolvedValue(
			"Allow for This Workspace" as any
		);

		const context = {
			workspaceState: {
				update: vi.fn().mockResolvedValue(undefined),
			},
		} as any;

		const result = await ensureGlobalResourceAccessConsent(context);

		expect(result).toBe(true);
		expect(workspace.fs.writeFile).toHaveBeenCalled();
		expect(context.workspaceState.update).toHaveBeenCalledWith(
			"gatomia.steering.workspaceGlobalResourceAccessFallback",
			undefined
		);
		expect(context.workspaceState.update).not.toHaveBeenCalledWith(
			"gatomia.steering.workspaceGlobalResourceAccessFallback",
			"allow"
		);
		expect(context.workspaceState.update).toHaveBeenCalledWith(
			"gatomia.steering.globalResourceAccess.lastDecision",
			"allow"
		);
	});

	it("uses workspace state as last resort when both config and settings file persistence fail", async () => {
		const config = createConfiguration({
			"steering.workspaceGlobalResourceAccess": "inherit",
			"steering.globalResourceAccessDefault": "ask",
		});
		config.update.mockRejectedValue(
			new Error(
				"Unable to write to Workspace Settings because gatomia.steering.workspaceGlobalResourceAccess is not a registered configuration."
			)
		);
		vi.mocked(workspace.fs.readFile).mockRejectedValue(new Error("ENOENT"));
		vi.mocked(workspace.fs.writeFile).mockRejectedValue(new Error("EACCES"));
		vi.mocked(workspace.getConfiguration).mockReturnValue(config as any);
		vi.mocked(window.showInformationMessage).mockResolvedValue(
			"Allow for This Workspace" as any
		);

		const context = {
			workspaceState: {
				update: vi.fn().mockResolvedValue(undefined),
			},
		} as any;

		const result = await ensureGlobalResourceAccessConsent(context);

		expect(result).toBe(true);
		expect(workspace.fs.writeFile).toHaveBeenCalled();
		expect(context.workspaceState.update).toHaveBeenCalledWith(
			"gatomia.steering.workspaceGlobalResourceAccessFallback",
			"allow"
		);
		expect(context.workspaceState.update).toHaveBeenCalledWith(
			"gatomia.steering.globalResourceAccess.lastDecision",
			"allow"
		);
	});
});
