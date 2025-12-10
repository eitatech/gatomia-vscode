import { join } from "path";
import { Uri, workspace } from "vscode";
import {
	createFeatureDirectoryName,
	generateNextFeatureNumber,
} from "../../utils/spec-kit-utilities";
import { getSpecSystemAdapter } from "../../utils/spec-kit-adapter";

export class SpecKitManager {
	private static instance: SpecKitManager;

	private constructor() {}

	static getInstance(): SpecKitManager {
		if (!SpecKitManager.instance) {
			SpecKitManager.instance = new SpecKitManager();
		}
		return SpecKitManager.instance;
	}

	/**
	 * Creates a new SpecKit feature with the necessary files
	 */
	async createFeature(
		name: string,
		context?: {
			productContext?: string;
			keyScenarios?: string;
			technicalConstraints?: string;
		}
	): Promise<string> {
		const adapter = getSpecSystemAdapter();
		const specsPath = adapter.getSpecsBasePath();

		// 1. Create directory
		const nextNumber = generateNextFeatureNumber(specsPath);
		const dirName = createFeatureDirectoryName(nextNumber, name);
		const featurePath = join(specsPath, dirName);

		await workspace.fs.createDirectory(Uri.file(featurePath));

		// 2. Create files
		await this.createFeatureFiles(featurePath, name, context);

		return featurePath;
	}

	private async createFeatureFiles(
		featurePath: string,
		name: string,
		context?: {
			productContext?: string;
			keyScenarios?: string;
			technicalConstraints?: string;
		}
	): Promise<void> {
		const files = ["spec.md", "plan.md", "tasks.md"];

		for (const file of files) {
			const filePath = Uri.file(join(featurePath, file));
			const content = this.getFileTemplate(file, name, context);
			await workspace.fs.writeFile(filePath, Buffer.from(content));
		}
	}

	private getFileTemplate(
		fileName: string,
		featureName: string,
		context?: {
			productContext?: string;
			keyScenarios?: string;
			technicalConstraints?: string;
		}
	): string {
		const baseContext = context?.productContext
			? `\n\n## Context\n${context.productContext}`
			: "";

		switch (fileName) {
			case "spec.md":
				return `# Specification: ${featureName}

## Status
- [ ] Draft
- [ ] Approved

## Overview
${baseContext}

## Scenarios
${context?.keyScenarios || "- Add scenarios here"}

## Constraints
${context?.technicalConstraints || "- Add constraints here"}
`;
			case "plan.md":
				return `# Implementation Plan: ${featureName}

## Status
- [ ] Draft
- [ ] Approved

## Proposed Changes
- [ ] ...

## Verification Plan
- [ ] ...
`;
			case "tasks.md":
				return `# Tasks: ${featureName}

## Status
- [ ] Todo
- [ ] In Progress
- [ ] Done

## Task List
- [ ] Initial setup
`;
			default:
				return "";
		}
	}
}
