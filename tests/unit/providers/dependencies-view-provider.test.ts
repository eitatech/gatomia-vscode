import { describe, expect, it } from "vitest";
import {
	areGatomiaCliPrerequisitesMet,
	getInstallationStepsForPlatform,
	type DependencyStatus,
} from "../../../src/providers/dependencies-view-provider";

const makeDependency = (
	name: string,
	installed: boolean
): DependencyStatus => ({
	name,
	installed,
	command: `${name.toLowerCase()} --version`,
});

describe("DependenciesViewProvider helpers", () => {
	it("hides gatomia-cli step until all prerequisites are installed", () => {
		const dependencies: DependencyStatus[] = [
			makeDependency("Node.js", true),
			makeDependency("Python", true),
			makeDependency("UV", true),
			makeDependency("SpecKit", true),
			makeDependency("OpenSpec", false),
			makeDependency("Copilot CLI", false),
		];

		expect(areGatomiaCliPrerequisitesMet(dependencies)).toBe(false);

		const steps = getInstallationStepsForPlatform("darwin", dependencies);
		expect(steps.some((step) => step.id === "gatomia-cli")).toBe(false);
	});

	it("includes steps when SpecKit satisfies spec system requirement", () => {
		const dependencies: DependencyStatus[] = [
			makeDependency("Node.js", true),
			makeDependency("Python", true),
			makeDependency("UV", true),
			makeDependency("SpecKit", true),
			makeDependency("OpenSpec", false),
			makeDependency("Copilot CLI", true),
		];

		expect(areGatomiaCliPrerequisitesMet(dependencies)).toBe(true);

		const steps = getInstallationStepsForPlatform("darwin", dependencies);
		expect(steps.some((step) => step.id === "copilot-cli")).toBe(true);
		expect(steps.some((step) => step.id === "gatomia-cli")).toBe(true);
	});

	it("includes steps when OpenSpec satisfies spec system requirement", () => {
		const dependencies: DependencyStatus[] = [
			makeDependency("Node.js", true),
			makeDependency("Python", true),
			makeDependency("UV", true),
			makeDependency("SpecKit", false),
			makeDependency("OpenSpec", true),
			makeDependency("Copilot CLI", true),
		];

		expect(areGatomiaCliPrerequisitesMet(dependencies)).toBe(true);

		const steps = getInstallationStepsForPlatform("darwin", dependencies);
		expect(steps.some((step) => step.id === "copilot-cli")).toBe(true);
		expect(steps.some((step) => step.id === "gatomia-cli")).toBe(true);
	});
});
