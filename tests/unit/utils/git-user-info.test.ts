import { describe, it, expect, beforeEach, vi } from "vitest";
import { GitUserInfoProvider } from "../../../src/utils/git-user-info";

describe("GitUserInfoProvider", () => {
	let provider: GitUserInfoProvider;
	let execSyncMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		// Create mock execSync function
		execSyncMock = vi.fn();
		// Inject mock into provider via constructor
		provider = new GitUserInfoProvider(execSyncMock as never);
	});

	describe("getUserInfo()", () => {
		it("should return Git user name and email when configured", () => {
			// Mock successful Git config reads
			execSyncMock
				.mockReturnValueOnce("John Doe\n") // user.name
				.mockReturnValueOnce("john@example.com\n"); // user.email

			const result = provider.getUserInfo();

			expect(result).toEqual({
				name: "John Doe",
				email: "john@example.com",
			});

			expect(execSyncMock).toHaveBeenCalledTimes(2);
			expect(execSyncMock).toHaveBeenNthCalledWith(
				1,
				"git config user.name",
				expect.objectContaining({ encoding: "utf8" })
			);
			expect(execSyncMock).toHaveBeenNthCalledWith(
				2,
				"git config user.email",
				expect.objectContaining({ encoding: "utf8" })
			);
		});

		it("should trim whitespace from Git output", () => {
			execSyncMock
				.mockReturnValueOnce("  John Doe  \n")
				.mockReturnValueOnce("  john@example.com  \n");

			const result = provider.getUserInfo();

			expect(result.name).toBe("John Doe");
			expect(result.email).toBe("john@example.com");
		});

		it("should fall back to system username when Git not available", () => {
			// Mock Git command failing
			execSyncMock.mockImplementation(() => {
				throw new Error("git: command not found");
			});

			const result = provider.getUserInfo();

			// Should return system username and placeholder email
			expect(result.name).toBeTruthy(); // System username
			expect(result.email).toContain("@"); // Should have some placeholder email
		});

		it("should fall back when Git user.name not configured", () => {
			execSyncMock
				.mockReturnValueOnce("") // Empty user.name
				.mockReturnValueOnce("john@example.com\n");

			const result = provider.getUserInfo();

			expect(result.name).toBeTruthy(); // System username fallback
			expect(result.email).toBe("john@example.com");
		});

		it("should fall back when Git user.email not configured", () => {
			execSyncMock.mockReturnValueOnce("John Doe\n").mockReturnValueOnce(""); // Empty user.email

			const result = provider.getUserInfo();

			expect(result.name).toBe("John Doe");
			expect(result.email).toContain("@"); // Placeholder email
		});

		it("should handle Git errors gracefully", () => {
			execSyncMock.mockImplementation(() => {
				throw new Error("fatal: not a git repository");
			});

			const result = provider.getUserInfo();

			expect(result).toBeDefined();
			expect(result.name).toBeTruthy();
			expect(result.email).toBeTruthy();
		});
	});

	describe("formatOwner()", () => {
		it("should format owner string as '[Name] <[email]>'", () => {
			const info = {
				name: "John Doe",
				email: "john@example.com",
			};

			const result = provider.formatOwner(info);

			expect(result).toBe("John Doe <john@example.com>");
		});

		it("should handle names with special characters", () => {
			const info = {
				name: "José María García-López",
				email: "jose@example.com",
			};

			const result = provider.formatOwner(info);

			expect(result).toBe("José María García-López <jose@example.com>");
		});

		it("should handle GitHub noreply email format", () => {
			const info = {
				name: "Italo",
				email: "182202+italoag@users.noreply.github.com",
			};

			const result = provider.formatOwner(info);

			expect(result).toBe("Italo <182202+italoag@users.noreply.github.com>");
		});
	});

	describe("isGitConfigured()", () => {
		it("should return true when user.name and user.email are set", () => {
			execSyncMock
				.mockReturnValueOnce("John Doe\n")
				.mockReturnValueOnce("john@example.com\n");

			const result = provider.isGitConfigured();

			expect(result).toBe(true);
		});

		it("should return false when user.name is not set", () => {
			execSyncMock
				.mockReturnValueOnce("") // Empty user.name
				.mockReturnValueOnce("john@example.com\n");

			const result = provider.isGitConfigured();

			expect(result).toBe(false);
		});

		it("should return false when user.email is not set", () => {
			execSyncMock.mockReturnValueOnce("John Doe\n").mockReturnValueOnce(""); // Empty user.email

			const result = provider.isGitConfigured();

			expect(result).toBe(false);
		});

		it("should return false when Git is not available", () => {
			execSyncMock.mockImplementation(() => {
				throw new Error("git: command not found");
			});

			const result = provider.isGitConfigured();

			expect(result).toBe(false);
		});
	});
});
