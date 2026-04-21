import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkCLI, locateCLIExecutable } from "../../../utils/cli-detector";
import { probeDevinCli } from "./devin-cli-probe";

vi.mock("../../../utils/cli-detector", () => ({
	checkCLI: vi.fn(),
	locateCLIExecutable: vi.fn(),
	getExtendedPath: vi.fn(() => process.env.PATH ?? ""),
}));

const mockedCheckCLI = vi.mocked(checkCLI);
const mockedLocate = vi.mocked(locateCLIExecutable);

describe("probeDevinCli", () => {
	const originalWindsurfKey = process.env.WINDSURF_API_KEY;

	beforeEach(() => {
		vi.clearAllMocks();
		Reflect.deleteProperty(process.env, "WINDSURF_API_KEY");
	});

	afterEach(() => {
		if (originalWindsurfKey === undefined) {
			Reflect.deleteProperty(process.env, "WINDSURF_API_KEY");
		} else {
			process.env.WINDSURF_API_KEY = originalWindsurfKey;
		}
	});

	it("reports not installed when `devin --version` fails", async () => {
		mockedCheckCLI.mockResolvedValueOnce({
			installed: false,
			version: null,
			error: "command not found",
		});

		const probe = await probeDevinCli();

		expect(probe.installed).toBe(false);
		expect(probe.authenticated).toBe(false);
		expect(probe.acpSupported).toBe(false);
		expect(probe.version).toBeNull();
		expect(probe.executablePath).toBeNull();
	});

	it("reports installed + authenticated + acp-capable when all checks pass", async () => {
		mockedCheckCLI
			.mockResolvedValueOnce({ installed: true, version: "1.8.0" }) // --version
			.mockResolvedValueOnce({ installed: true, version: null }) // auth status
			.mockResolvedValueOnce({ installed: true, version: null }); // acp --help
		mockedLocate.mockResolvedValueOnce("/usr/local/bin/devin");

		const probe = await probeDevinCli();

		expect(probe.installed).toBe(true);
		expect(probe.version).toBe("1.8.0");
		expect(probe.authenticated).toBe(true);
		expect(probe.acpSupported).toBe(true);
		expect(probe.executablePath).toBe("/usr/local/bin/devin");
	});

	it("flags authenticated via WINDSURF_API_KEY even if `devin auth status` fails", async () => {
		process.env.WINDSURF_API_KEY = "ws_test_key";
		mockedCheckCLI
			.mockResolvedValueOnce({ installed: true, version: "1.8.0" })
			.mockResolvedValueOnce({
				installed: false,
				version: null,
				error: "not logged in",
			})
			.mockResolvedValueOnce({ installed: true, version: null });
		mockedLocate.mockResolvedValueOnce("/usr/local/bin/devin");

		const probe = await probeDevinCli();

		expect(probe.authenticated).toBe(true);
		expect(probe.authHint).toBeUndefined();
	});

	it("flags not authenticated and provides hint when auth fails and env var missing", async () => {
		mockedCheckCLI
			.mockResolvedValueOnce({ installed: true, version: "1.8.0" })
			.mockResolvedValueOnce({
				installed: false,
				version: null,
				error: "not logged in",
			})
			.mockResolvedValueOnce({ installed: true, version: null });
		mockedLocate.mockResolvedValueOnce("/usr/local/bin/devin");

		const probe = await probeDevinCli();

		expect(probe.installed).toBe(true);
		expect(probe.authenticated).toBe(false);
		expect(probe.authHint).toContain("devin auth login");
	});

	it("flags ACP not supported when `devin acp --help` fails", async () => {
		mockedCheckCLI
			.mockResolvedValueOnce({ installed: true, version: "0.5.0" })
			.mockResolvedValueOnce({ installed: true, version: null })
			.mockResolvedValueOnce({
				installed: false,
				version: null,
				error: "unknown command",
			});
		mockedLocate.mockResolvedValueOnce("/usr/local/bin/devin");

		const probe = await probeDevinCli();

		expect(probe.installed).toBe(true);
		expect(probe.acpSupported).toBe(false);
	});

	it("never throws when checkCLI rejects", async () => {
		mockedCheckCLI.mockRejectedValueOnce(new Error("boom"));

		const probe = await probeDevinCli();

		expect(probe.installed).toBe(false);
		expect(probe.error).toContain("boom");
	});
});
