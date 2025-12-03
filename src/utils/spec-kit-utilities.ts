import { readdirSync, existsSync, statSync } from "fs";
import { join } from "path";
import {
	SPECKIT_CONFIG,
	SPEC_SYSTEM_MODE,
	type SpecSystemMode,
} from "../constants";

const SPEC_KIT_DIR_REGEX = /^(\d{3,})-(.+)$/;
const SLUG_WHITESPACE_REGEX = /\s+/g;
const SLUG_INVALID_CHARS_REGEX = /[^\w-]/g;
const SPEC_KIT_FEATURE_DIR_VALIDATION_REGEX = /^\d{3,}-[a-z0-9][-a-z0-9]*$/i;
const PATH_SEPARATOR_REGEX = /[\\/]/;
const BACKSLASH_REGEX = /\\/g;
const LEADING_SLASH_REGEX = /^\//;

/**
 * Spec-Kit Utilities
 * Provides helper functions for working with Spec-Kit file structure and conventions
 */

/**
 * Feature structure for Spec-Kit numbered directories
 */
export interface SpecKitFeature {
	number: number;
	name: string;
	slug: string;
	path: string;
}

/**
 * Detects which spec systems are available in the workspace
 */
export function detectAvailableSpecSystems(
	workspacePath: string
): SpecSystemMode[] {
	const systems: SpecSystemMode[] = [];
	const openspecPath = join(workspacePath, "openspec");
	const specsPath = join(workspacePath, "specs");
	const specifyPath = join(workspacePath, ".specify");

	// Check for Spec-Kit indicators
	if (existsSync(specifyPath) && existsSync(specsPath)) {
		systems.push(SPEC_SYSTEM_MODE.SPECKIT);
	}

	// Check for OpenSpec indicators
	if (existsSync(openspecPath)) {
		systems.push(SPEC_SYSTEM_MODE.OPENSPEC);
	}

	return systems;
}

/**
 * Detects which spec system is active in the workspace
 * Checks for presence of key directories/files
 */
export function detectActiveSpecSystem(workspacePath: string): SpecSystemMode {
	const available = detectAvailableSpecSystems(workspacePath);

	if (available.length === 1) {
		return available[0];
	}

	if (available.includes(SPEC_SYSTEM_MODE.SPECKIT)) {
		return SPEC_SYSTEM_MODE.SPECKIT; // Default preference if both exist, but SpecManager should handle user choice
	}

	// Default to auto-detect (could be new project)
	return SPEC_SYSTEM_MODE.AUTO;
}

/**
 * Parses a Spec-Kit numbered directory name
 * Examples: "001-user-auth", "002-payment-integration"
 * Returns: { number: 1, name: "user-auth", slug: "001-user-auth" }
 */
export function parseSpecKitDirectoryName(
	dirName: string
): SpecKitFeature | null {
	const match = dirName.match(SPEC_KIT_DIR_REGEX);
	if (!match) {
		return null;
	}

	const number = Number.parseInt(match[1], 10);
	const slug = match[2];

	return {
		number,
		name: convertSlugToName(slug),
		slug: dirName,
		path: dirName,
	};
}

/**
 * Converts a slug to a human-readable name
 * Examples: "user-auth" → "User Auth", "payment-integration" → "Payment Integration"
 */
export function convertSlugToName(slug: string): string {
	return slug
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/**
 * Converts a human-readable name to a slug
 * Examples: "User Auth" → "user-auth", "Payment Integration" → "payment-integration"
 */
export function convertNameToSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(SLUG_WHITESPACE_REGEX, "-")
		.replace(SLUG_INVALID_CHARS_REGEX, "");
}

/**
 * Discovers all feature directories in the specs folder
 */
export function discoverSpecKitFeatures(specsPath: string): SpecKitFeature[] {
	if (!existsSync(specsPath)) {
		return [];
	}

	const features: SpecKitFeature[] = [];

	try {
		const entries = readdirSync(specsPath);

		for (const entry of entries) {
			const fullPath = join(specsPath, entry);
			const stat = statSync(fullPath);

			if (stat.isDirectory()) {
				const feature = parseSpecKitDirectoryName(entry);
				if (feature) {
					feature.path = fullPath;
					features.push(feature);
				}
			}
		}
	} catch (error) {
		console.error(
			`Error discovering Spec-Kit features in ${specsPath}:`,
			error
		);
	}

	// Sort by number
	return features.sort((a, b) => a.number - b.number);
}

/**
 * Generates the next feature number for a new spec
 * Examines existing directories to determine sequence
 */
export function generateNextFeatureNumber(specsPath: string): number {
	const features = discoverSpecKitFeatures(specsPath);

	if (features.length === 0) {
		return 1;
	}

	const maxNumber = Math.max(...features.map((f) => f.number));
	return maxNumber + 1;
}

/**
 * Formats a number with leading zeros (e.g., 1 → "001", 42 → "042")
 */
export function formatFeatureNumber(num: number, padding = 3): string {
	return String(num).padStart(padding, "0");
}

/**
 * Generates a Spec-Kit feature directory name
 * Examples: createFeatureDirectoryName(1, "User Auth") → "001-user-auth"
 */
export function createFeatureDirectoryName(
	number: number,
	name: string
): string {
	const slug = convertNameToSlug(name);
	return `${formatFeatureNumber(number)}-${slug}`;
}

/**
 * Checks if a directory follows Spec-Kit naming conventions
 */
export function isSpecKitFeatureDirectory(dirName: string): boolean {
	return SPEC_KIT_FEATURE_DIR_VALIDATION_REGEX.test(dirName);
}

/**
 * Gets all Spec-Kit spec template files in a feature directory
 * Returns paths to spec.md, plan.md, tasks.md, etc.
 */
export function getSpecKitFeatureFiles(
	featurePath: string
): Record<string, string> {
	const files: Record<string, string> = {};
	const requiredFiles = ["spec", "plan", "tasks"];

	for (const fileType of requiredFiles) {
		const filePath = join(featurePath, `${fileType}.md`);
		files[fileType] = filePath;
	}

	// Add optional files
	const optionalFiles = [
		"research",
		"data-model",
		"quickstart",
		"constitution",
	];
	for (const fileType of optionalFiles) {
		const filePath = join(featurePath, `${fileType}.md`);
		if (existsSync(filePath)) {
			files[fileType] = filePath;
		}
	}

	return files;
}

/**
 * Validates Spec-Kit project structure
 * Checks for required directories and files
 */
export interface SpecKitValidationResult {
	isValid: boolean;
	missingDirectories: string[];
	missingFiles: string[];
	warnings: string[];
}

export function validateSpecKitStructure(
	workspacePath: string
): SpecKitValidationResult {
	const result: SpecKitValidationResult = {
		isValid: true,
		missingDirectories: [],
		missingFiles: [],
		warnings: [],
	};

	// Check required directories
	const requiredDirs = [
		"specs",
		".specify",
		".specify/memory",
		".specify/templates",
	];

	for (const dir of requiredDirs) {
		const dirPath = join(workspacePath, dir);
		if (!existsSync(dirPath)) {
			result.missingDirectories.push(dir);
			result.isValid = false;
		}
	}

	// Check for constitution.md
	const constitutionPath = join(
		workspacePath,
		".specify/memory/constitution.md"
	);
	if (!existsSync(constitutionPath)) {
		result.missingFiles.push(".specify/memory/constitution.md");
		result.warnings.push(
			"constitution.md not found - run /speckit.constitution"
		);
	}

	return result;
}

/**
 * Gets the path to the constitution file
 */
export function getConstitutionPath(workspacePath: string): string {
	return join(workspacePath, SPECKIT_CONFIG.paths.memory, "constitution.md");
}

/**
 * Gets the path to the memory directory
 */
export function getMemoryPath(workspacePath: string): string {
	return join(workspacePath, SPECKIT_CONFIG.paths.memory);
}

/**
 * Gets the path to the templates directory
 */
export function getTemplatesPath(workspacePath: string): string {
	return join(workspacePath, SPECKIT_CONFIG.paths.templates);
}

/**
 * Gets the path to the scripts directory
 */
export function getScriptsPath(workspacePath: string): string {
	return join(workspacePath, SPECKIT_CONFIG.paths.scripts);
}

/**
 * Gets the path to the specs directory
 */
export function getSpecsPath(workspacePath: string): string {
	return join(workspacePath, SPECKIT_CONFIG.paths.specs);
}

/**
 * Extracts feature name from a Spec-Kit directory path
 * Example: "/workspace/specs/001-user-auth" → "User Auth"
 */
export function extractFeatureNameFromPath(featurePath: string): string {
	const dirName = featurePath.split(PATH_SEPARATOR_REGEX).pop() || "";
	const feature = parseSpecKitDirectoryName(dirName);
	return feature ? feature.name : dirName;
}

/**
 * Extracts feature number from a Spec-Kit directory path
 * Example: "/workspace/specs/001-user-auth" → 1
 */
export function extractFeatureNumberFromPath(
	featurePath: string
): number | null {
	const dirName = featurePath.split(PATH_SEPARATOR_REGEX).pop() || "";
	const feature = parseSpecKitDirectoryName(dirName);
	return feature ? feature.number : null;
}

/**
 * Checks if a file path belongs to a Spec-Kit feature directory
 */
export function isInSpecKitFeatureDirectory(
	filePath: string,
	specsPath: string
): boolean {
	const normalized = filePath.replace(BACKSLASH_REGEX, "/");
	const normalizedSpecs = specsPath.replace(BACKSLASH_REGEX, "/");

	if (!normalized.includes(normalizedSpecs)) {
		return false;
	}

	// Check if path contains a feature directory
	const relativePath = normalized
		.substring(normalizedSpecs.length)
		.replace(LEADING_SLASH_REGEX, "");
	const parts = relativePath.split("/");

	return parts.length > 0 && isSpecKitFeatureDirectory(parts[0]);
}
