import type { IVersionIncrementer } from "./types";

/**
 * Pure version increment logic (no I/O, easily testable).
 * Implements {major}.{minor} versioning with overflow rules.
 *
 * Version format: /^\d+\.\d$/ (e.g., "1.0", "2.5", "10.9")
 * Increment rules:
 * - 1.0 → 1.1 (increment minor)
 * - 1.9 → 2.0 (minor overflow, increment major, reset minor to 0)
 * - 2.5 → 2.6 (continue in major version 2)
 */
export class VersionIncrementer implements IVersionIncrementer {
	/**
	 * Valid version regex: {major}.{minor} where minor is single digit (0-9)
	 */
	private readonly VERSION_PATTERN = /^(\d+)\.(\d)$/;

	/**
	 * Maximum minor version before overflow
	 */
	private readonly MAX_MINOR = 9;

	/**
	 * Increment version according to {major}.{minor} rules.
	 *
	 * @param currentVersion Version to increment
	 * @returns Next version string
	 * @throws Error if version is invalid and cannot be normalized
	 */
	increment(currentVersion: string): string {
		// Normalize and validate input
		const normalizedVersion = this.normalize(currentVersion);

		if (!this.isValid(normalizedVersion)) {
			throw new Error(
				`Invalid version format: "${currentVersion}". Expected format: {major}.{minor} (e.g., "1.0", "2.5")`
			);
		}

		// Parse components
		const match = normalizedVersion.match(this.VERSION_PATTERN);
		if (!match) {
			throw new Error(`Failed to parse version: "${normalizedVersion}"`);
		}

		const major = Number.parseInt(match[1], 10);
		const minor = Number.parseInt(match[2], 10);

		// Apply increment rules
		if (minor < this.MAX_MINOR) {
			// Normal increment: 1.0 → 1.1, 2.5 → 2.6
			return `${major}.${minor + 1}`;
		}

		// Overflow: 1.9 → 2.0, 2.9 → 3.0
		return `${major + 1}.0`;
	}

	/**
	 * Validate version format: /^\d+\.\d$/ (e.g., "1.0", "2.5")
	 *
	 * @param version Version string to validate
	 * @returns true if valid, false otherwise
	 */
	isValid(version: string): boolean {
		if (!version || typeof version !== "string") {
			return false;
		}

		return this.VERSION_PATTERN.test(version);
	}

	/**
	 * Normalize malformed version to valid format.
	 *
	 * Normalization rules:
	 * 1. Remove 'v' or 'V' prefix: "v1.0" → "1.0"
	 * 2. Handle overflow: "1.10" → "2.0" (10 = 1*10 + 0 → major+1, minor 0)
	 * 3. Truncate three-part versions: "1.2.3" → "1.2"
	 * 4. Default invalid versions to "1.0"
	 *
	 * @param version Potentially malformed version
	 * @returns Normalized valid version
	 */
	normalize(version: string): string {
		if (!version || typeof version !== "string") {
			return "1.0";
		}

		// Remove 'v' or 'V' prefix
		const normalized = version.replace(/^[vV]/, "");

		// Try to extract numeric parts
		const parts = normalized.split(".");

		if (parts.length === 0) {
			return "1.0";
		}

		// Extract major version
		const majorStr = parts[0];
		const major = Number.parseInt(majorStr, 10);

		if (Number.isNaN(major) || major < 0) {
			return "1.0";
		}

		// Extract minor version
		if (parts.length === 1) {
			// No minor version provided
			return `${major}.0`;
		}

		const minorStr = parts[1];
		const minor = Number.parseInt(minorStr, 10);

		if (Number.isNaN(minor) || minor < 0) {
			return `${major}.0`;
		}

		// Handle overflow: minor >= 10 means we need to convert
		// Example: 1.10 → 1 + (10 div 10) = 2, minor = 10 mod 10 = 0 → "2.0"
		// Example: 1.15 → 1 + (15 div 10) = 2, minor = 15 mod 10 = 5 → "2.5"
		// Example: 2.20 → 2 + (20 div 10) = 4, minor = 20 mod 10 = 0 → "4.0"
		if (minor >= 10) {
			const majorIncrement = Math.floor(minor / 10);
			const normalizedMinor = minor % 10;
			return `${major + majorIncrement}.${normalizedMinor}`;
		}

		// Minor is valid (0-9), return normalized version
		return `${major}.${minor}`;
	}
}
