import { join } from "path";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	statSync,
	copyFileSync,
	readFileSync,
	writeFileSync,
} from "fs";
import { window } from "vscode";
import {
	generateNextFeatureNumber,
	createFeatureDirectoryName,
	getSpecsPath,
	getMemoryPath,
	getConstitutionPath,
} from "./spec-kit-utilities";
import { ConstitutionManager } from "../features/steering/constitution-manager";

export interface MigrationResult {
	success: boolean;
	migratedSpecs: number;
	backupPath: string | null;
	errors: string[];
}

export class SpecKitMigration {
	private readonly workspaceRoot: string;

	constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot;
	}

	/**
	 * Creates a backup of the OpenSpec structure before migration
	 */
	createBackup(): string | null {
		const openSpecPath = join(this.workspaceRoot, "openspec");
		if (!existsSync(openSpecPath)) {
			return null;
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const backupPath = join(
			this.workspaceRoot,
			`.openspec-backup-${timestamp}`
		);

		try {
			this.copyDirectoryRecursive(openSpecPath, backupPath);
			return backupPath;
		} catch (error) {
			console.error("Failed to create backup:", error);
			return null;
		}
	}

	/**
	 * Recursively copies a directory
	 */
	private copyDirectoryRecursive(source: string, target: string): void {
		if (!existsSync(target)) {
			mkdirSync(target, { recursive: true });
		}

		const entries = readdirSync(source);

		for (const entry of entries) {
			const sourcePath = join(source, entry);
			const targetPath = join(target, entry);
			const stat = statSync(sourcePath);

			if (stat.isDirectory()) {
				this.copyDirectoryRecursive(sourcePath, targetPath);
			} else {
				copyFileSync(sourcePath, targetPath);
			}
		}
	}

	/**
	 * Generates a constitution.md from existing project files
	 * Looks for AGENTS.md, README.md, and other guideline files
	 */
	async generateConstitution(): Promise<boolean> {
		const constitutionManager = new ConstitutionManager(this.workspaceRoot);

		if (constitutionManager.ensureConstitutionExists()) {
			const overwrite = await window.showWarningMessage(
				"Constitution already exists. Overwrite?",
				"Yes",
				"No"
			);
			if (overwrite !== "Yes") {
				return false;
			}
		}

		// Collect content from various sources
		const sources: { name: string; content: string }[] = [];

		// 1. Check for AGENTS.md in openspec
		const agentsPath = join(this.workspaceRoot, "openspec", "AGENTS.md");
		if (existsSync(agentsPath)) {
			sources.push({
				name: "AGENTS.md",
				content: readFileSync(agentsPath, "utf-8"),
			});
		}

		// 2. Check for root AGENTS.md
		const rootAgentsPath = join(this.workspaceRoot, "AGENTS.md");
		if (existsSync(rootAgentsPath)) {
			sources.push({
				name: "Root AGENTS.md",
				content: readFileSync(rootAgentsPath, "utf-8"),
			});
		}

		// 3. Check for CLAUDE.md
		const claudePath = join(this.workspaceRoot, "CLAUDE.md");
		if (existsSync(claudePath)) {
			sources.push({
				name: "CLAUDE.md",
				content: readFileSync(claudePath, "utf-8"),
			});
		}

		// 4. Check for project.md in openspec
		const projectPath = join(this.workspaceRoot, "openspec", "project.md");
		if (existsSync(projectPath)) {
			sources.push({
				name: "project.md",
				content: readFileSync(projectPath, "utf-8"),
			});
		}

		// Build constitution content
		let constitutionContent = "# Project Constitution\n\n";

		if (sources.length === 0) {
			// Create default constitution
			constitutionContent += `## 1. Core Principles
- **Quality First**: Code must be clean, tested, and maintainable.
- **User Centric**: Features must provide value to the user.

## 2. Technical Standards
- Follow the project's linting rules.
- Write tests for all new features.

## 3. Workflow
- All changes must be specified before implementation.
- Use the Spec-Kit workflow: Specify -> Plan -> Implement.
`;
		} else {
			// Merge content from sources
			constitutionContent +=
				"> This constitution was generated from existing project guidelines.\n\n";

			for (const source of sources) {
				constitutionContent += `---\n\n## From ${source.name}\n\n${source.content}\n\n`;
			}
		}

		// Ensure memory directory exists
		const memoryPath = getMemoryPath(this.workspaceRoot);
		if (!existsSync(memoryPath)) {
			mkdirSync(memoryPath, { recursive: true });
		}

		// Write constitution
		const constitutionPath = getConstitutionPath(this.workspaceRoot);
		writeFileSync(constitutionPath, constitutionContent, "utf-8");

		window.showInformationMessage(
			`Constitution generated from ${sources.length} source(s).`
		);
		return true;
	}

	/**
	 * Migrates all OpenSpec specs to Spec-Kit format
	 */
	async migrateAllSpecs(): Promise<MigrationResult> {
		const result: MigrationResult = {
			success: false,
			migratedSpecs: 0,
			backupPath: null,
			errors: [],
		};

		const openSpecPath = join(this.workspaceRoot, "openspec", "specs");
		if (!existsSync(openSpecPath)) {
			window.showInformationMessage("No OpenSpec specs found to migrate.");
			result.success = true;
			return result;
		}

		const specs = readdirSync(openSpecPath).filter((entry) => {
			const fullPath = join(openSpecPath, entry);
			return statSync(fullPath).isDirectory();
		});

		if (specs.length === 0) {
			window.showInformationMessage("No OpenSpec specs found to migrate.");
			result.success = true;
			return result;
		}

		const confirm = await window.showWarningMessage(
			`Found ${specs.length} specs to migrate. This will create new numbered directories in 'specs/'. A backup will be created. Continue?`,
			"Yes",
			"No"
		);

		if (confirm !== "Yes") {
			return result;
		}

		// Create backup first
		result.backupPath = this.createBackup();
		if (result.backupPath) {
			window.showInformationMessage(`Backup created at: ${result.backupPath}`);
		}

		const specsPath = getSpecsPath(this.workspaceRoot);
		if (!existsSync(specsPath)) {
			mkdirSync(specsPath, { recursive: true });
		}

		for (const specName of specs) {
			try {
				this.migrateSingleSpec(specName, openSpecPath, specsPath);
				result.migratedSpecs += 1;
			} catch (error) {
				const errorMsg = `Failed to migrate spec ${specName}: ${error}`;
				console.error(errorMsg);
				result.errors.push(errorMsg);
				window.showErrorMessage(errorMsg);
			}
		}

		// Generate constitution from existing guidelines
		await this.generateConstitution();

		result.success = result.errors.length === 0;
		window.showInformationMessage(
			`Migration complete. Migrated ${result.migratedSpecs} specs.`
		);

		return result;
	}

	private migrateSingleSpec(
		specName: string,
		sourceBasePath: string,
		targetBasePath: string
	): void {
		const sourcePath = join(sourceBasePath, specName);

		// Generate next number
		const nextNumber = generateNextFeatureNumber(targetBasePath);
		const dirName = createFeatureDirectoryName(nextNumber, specName);
		const targetPath = join(targetBasePath, dirName);

		mkdirSync(targetPath, { recursive: true });

		// Map files
		// OpenSpec: spec.md, requirements.md, design.md, tasks.md
		// Spec-Kit: spec.md, plan.md, tasks.md

		// 1. spec.md -> spec.md
		if (existsSync(join(sourcePath, "spec.md"))) {
			copyFileSync(join(sourcePath, "spec.md"), join(targetPath, "spec.md"));
		}

		// 2. requirements.md -> appended to spec.md or separate?
		// Spec-Kit usually puts requirements in spec.md. For now, let's copy it as requirements.md (extra file)
		if (existsSync(join(sourcePath, "requirements.md"))) {
			copyFileSync(
				join(sourcePath, "requirements.md"),
				join(targetPath, "requirements.md")
			);
		}

		// 3. design.md -> plan.md
		if (existsSync(join(sourcePath, "design.md"))) {
			copyFileSync(join(sourcePath, "design.md"), join(targetPath, "plan.md"));
		}

		// 4. tasks.md -> tasks.md
		if (existsSync(join(sourcePath, "tasks.md"))) {
			copyFileSync(join(sourcePath, "tasks.md"), join(targetPath, "tasks.md"));
		}

		// 5. Copy any additional markdown files
		const additionalFiles = readdirSync(sourcePath).filter(
			(f) =>
				f.endsWith(".md") &&
				!["spec.md", "requirements.md", "design.md", "tasks.md"].includes(f)
		);

		for (const file of additionalFiles) {
			copyFileSync(join(sourcePath, file), join(targetPath, file));
		}
	}

	/**
	 * @deprecated Use generateConstitution() instead
	 */
	private async migrateAgentsToConstitution(): Promise<void> {
		await this.generateConstitution();
	}
}
