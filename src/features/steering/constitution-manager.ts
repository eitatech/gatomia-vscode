import { join } from "path";
import { existsSync } from "fs";
import { workspace, Uri, window, ViewColumn } from "vscode";
import { getConstitutionPath } from "../../utils/spec-kit-utilities";

export class ConstitutionManager {
	private readonly workspaceRoot: string;

	constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot;
	}

	getConstitutionPath(): string {
		return getConstitutionPath(this.workspaceRoot);
	}

	ensureConstitutionExists(): boolean {
		const filePath = this.getConstitutionPath();
		return existsSync(filePath);
	}

	async openConstitution(): Promise<void> {
		const filePath = this.getConstitutionPath();
		if (!existsSync(filePath)) {
			const create = await window.showInformationMessage(
				"Constitution file not found. Create one?",
				"Yes",
				"No"
			);
			if (create === "Yes") {
				await this.createDefaultConstitution();
			} else {
				return;
			}
		}

		const document = await workspace.openTextDocument(filePath);
		await window.showTextDocument(document, {
			preview: false,
			viewColumn: ViewColumn.Active,
		});
	}

	async createDefaultConstitution(): Promise<void> {
		const filePath = this.getConstitutionPath();
		const defaultContent = `# Project Constitution

## 1. Core Principles
- **Quality First**: Code must be clean, tested, and maintainable.
- **User Centric**: Features must provide value to the user.

## 2. Technical Standards
- Use TypeScript for all new code.
- Follow the project's linting rules.

## 3. Workflow
- All changes must be specified before implementation.
- Use the Spec Kit workflow: Specify -> Plan -> Implement.
`;

		const uri = Uri.file(filePath);
		// Ensure directory exists
		const dirPath = Uri.file(join(filePath, ".."));
		try {
			await workspace.fs.createDirectory(dirPath);
		} catch (e) {
			// Ignore if exists
		}

		await workspace.fs.writeFile(uri, Buffer.from(defaultContent));
	}

	// Future: Add validation logic here
	validateConstitution(): boolean {
		// Placeholder for validation logic
		return true;
	}
}
