import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env } from "vscode";
import { detectIdeHost, isAcpCandidateHost } from "./ide-host-detector";

interface MutableEnv {
	appName: string;
	remoteName?: string;
}

describe("ide-host-detector", () => {
	let originalAppName: string;
	let originalRemoteName: string | undefined;

	beforeEach(() => {
		originalAppName = (env as unknown as MutableEnv).appName;
		originalRemoteName = (env as unknown as MutableEnv).remoteName;
	});

	afterEach(() => {
		(env as unknown as MutableEnv).appName = originalAppName;
		(env as unknown as MutableEnv).remoteName = originalRemoteName;
	});

	describe("detectIdeHost", () => {
		it("returns 'windsurf' when appName contains Windsurf", () => {
			(env as unknown as MutableEnv).appName = "Windsurf";
			expect(detectIdeHost()).toBe("windsurf");
		});

		it("returns 'windsurf' case-insensitively", () => {
			(env as unknown as MutableEnv).appName = "WINDSURF - Next";
			expect(detectIdeHost()).toBe("windsurf");
		});

		it("returns 'antigravity' when appName contains Antigravity", () => {
			(env as unknown as MutableEnv).appName = "Antigravity";
			expect(detectIdeHost()).toBe("antigravity");
		});

		it("returns 'cursor' when appName contains Cursor", () => {
			(env as unknown as MutableEnv).appName = "Cursor";
			expect(detectIdeHost()).toBe("cursor");
		});

		it("returns 'vscode-insiders' when appName contains Insiders", () => {
			(env as unknown as MutableEnv).appName = "Visual Studio Code - Insiders";
			expect(detectIdeHost()).toBe("vscode-insiders");
		});

		it("returns 'vscodium' when appName contains VSCodium", () => {
			(env as unknown as MutableEnv).appName = "VSCodium";
			expect(detectIdeHost()).toBe("vscodium");
		});

		it("returns 'positron' when appName contains Positron", () => {
			(env as unknown as MutableEnv).appName = "Positron";
			expect(detectIdeHost()).toBe("positron");
		});

		it("returns 'vscode' for stock Visual Studio Code", () => {
			(env as unknown as MutableEnv).appName = "Visual Studio Code";
			expect(detectIdeHost()).toBe("vscode");
		});

		it("returns 'vscode' for bare 'Code' app name", () => {
			(env as unknown as MutableEnv).appName = "Code";
			expect(detectIdeHost()).toBe("vscode");
		});

		it("returns 'unknown' for empty app name", () => {
			(env as unknown as MutableEnv).appName = "";
			expect(detectIdeHost()).toBe("unknown");
		});

		it("returns 'unknown' for completely foreign app names", () => {
			(env as unknown as MutableEnv).appName = "SomeRandomEditor 3000";
			expect(detectIdeHost()).toBe("unknown");
		});

		it("prioritises Insiders over generic Code match", () => {
			(env as unknown as MutableEnv).appName = "Visual Studio Code - Insiders";
			expect(detectIdeHost()).toBe("vscode-insiders");
		});

		it("prioritises Windsurf even when Code appears in name", () => {
			(env as unknown as MutableEnv).appName = "Windsurf (Code edition)";
			expect(detectIdeHost()).toBe("windsurf");
		});
	});

	describe("isAcpCandidateHost", () => {
		it("returns true for Windsurf", () => {
			(env as unknown as MutableEnv).appName = "Windsurf";
			expect(isAcpCandidateHost()).toBe(true);
		});

		it("returns true for Antigravity", () => {
			(env as unknown as MutableEnv).appName = "Antigravity";
			expect(isAcpCandidateHost()).toBe(true);
		});

		it("returns false for stock VS Code", () => {
			(env as unknown as MutableEnv).appName = "Visual Studio Code";
			expect(isAcpCandidateHost()).toBe(false);
		});

		it("returns false for Cursor", () => {
			(env as unknown as MutableEnv).appName = "Cursor";
			expect(isAcpCandidateHost()).toBe(false);
		});

		it("returns false when running in a remote workspace", () => {
			(env as unknown as MutableEnv).appName = "Windsurf";
			(env as unknown as MutableEnv).remoteName = "ssh-remote";
			expect(isAcpCandidateHost()).toBe(false);
		});
	});
});
