import { access } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkCLI, locateCLIExecutable } from "../../../utils/cli-detector";
import { probeGeminiCli } from "./gemini-cli-probe";

vi.mock("../../../utils/cli-detector", () => ({
	checkCLI: vi.fn(),
	locateCLIExecutable: vi.fn(),
	getExtendedPath: vi.fn(() => process.env.PATH ?? ""),
}));

vi.mock("node:fs/promises", () => {
	const accessMock = vi.fn();
	return {
		access: accessMock,
		default: { access: accessMock },
	};
});

const mockedCheckCLI = vi.mocked(checkCLI);
const mockedLocate = vi.mocked(locateCLIExecutable);
const mockedAccess = vi.mocked(access);

describe("probeGeminiCli", () => {
	const originalKey = process.env.GEMINI_API_KEY;

	beforeEach(() => {
		vi.clearAllMocks();
		Reflect.deleteProperty(process.env, "GEMINI_API_KEY");
	});

	afterEach(() => {
		if (originalKey === undefined) {
			Reflect.deleteProperty(process.env, "GEMINI_API_KEY");
		} else {
			process.env.GEMINI_API_KEY = originalKey;
		}
	});

	it("reports not installed when `gemini --version` fails", async () => {
		mockedCheckCLI.mockResolvedValueOnce({
			installed: false,
			version: null,
			error: "not found",
		});

		const probe = await probeGeminiCli();

		expect(probe.installed).toBe(false);
		expect(probe.authenticated).toBe(false);
		expect(probe.acpSupported).toBe(false);
	});

	it("flags authenticated when GEMINI_API_KEY is set", async () => {
		process.env.GEMINI_API_KEY = "gk_test";
		mockedCheckCLI
			.mockResolvedValueOnce({ installed: true, version: "0.3.5" })
			.mockResolvedValueOnce({
				installed: true,
				version: null,
				output: "--experimental-acp  Run Gemini CLI in ACP server mode",
			});
		mockedLocate.mockResolvedValueOnce("/usr/local/bin/gemini");
		mockedAccess.mockRejectedValueOnce(new Error("no oauth creds"));

		const probe = await probeGeminiCli();

		expect(probe.installed).toBe(true);
		expect(probe.authenticated).toBe(true);
		expect(probe.acpSupported).toBe(true);
		expect(probe.version).toBe("0.3.5");
	});

	it("flags authenticated when ~/.gemini/oauth_creds.json exists", async () => {
		mockedCheckCLI
			.mockResolvedValueOnce({ installed: true, version: "0.3.5" })
			.mockResolvedValueOnce({
				installed: true,
				version: null,
				output: "--experimental-acp",
			});
		mockedLocate.mockResolvedValueOnce("/usr/local/bin/gemini");
		mockedAccess.mockResolvedValueOnce(undefined);

		const probe = await probeGeminiCli();

		expect(probe.authenticated).toBe(true);
		expect(probe.authHint).toBeUndefined();
	});

	it("produces an auth hint when neither key nor creds are present", async () => {
		mockedCheckCLI
			.mockResolvedValueOnce({ installed: true, version: "0.3.5" })
			.mockResolvedValueOnce({
				installed: true,
				version: null,
				output: "--experimental-acp",
			});
		mockedLocate.mockResolvedValueOnce("/usr/local/bin/gemini");
		mockedAccess.mockRejectedValueOnce(new Error("ENOENT"));

		const probe = await probeGeminiCli();

		expect(probe.authenticated).toBe(false);
		expect(probe.authHint).toContain("GEMINI_API_KEY");
	});

	it("flags ACP unsupported when help output lacks ACP flag", async () => {
		process.env.GEMINI_API_KEY = "gk_test";
		mockedCheckCLI
			.mockResolvedValueOnce({ installed: true, version: "0.1.0" })
			.mockResolvedValueOnce({
				installed: true,
				version: null,
				output: "gemini - a CLI for Gemini\n--help Show help",
			});
		mockedLocate.mockResolvedValueOnce("/usr/local/bin/gemini");
		mockedAccess.mockRejectedValueOnce(new Error("no creds"));

		const probe = await probeGeminiCli();

		expect(probe.installed).toBe(true);
		expect(probe.acpSupported).toBe(false);
	});

	it("never throws when checkCLI rejects", async () => {
		mockedCheckCLI.mockRejectedValueOnce(new Error("spawn EACCES"));

		const probe = await probeGeminiCli();

		expect(probe.installed).toBe(false);
		expect(probe.error).toContain("spawn EACCES");
	});
});
