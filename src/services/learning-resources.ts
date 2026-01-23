/**
 * LearningResources Service
 * Manages and filters learning resources for the welcome screen
 * Based on specs/006-welcome-screen/resources.json and spec.md FR-015
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LearningResource } from "../types/welcome";

type ResourceCategory =
	| "Getting Started"
	| "Advanced Features"
	| "Troubleshooting";

// Regex for splitting query words (moved to top level for performance)
const WHITESPACE_REGEX = /\s+/;

export class LearningResources {
	private resources: LearningResource[] = [];
	private loaded = false;

	/**
	 * Load resources from resources.json
	 * @param extensionPath - Path to extension root directory
	 */
	loadResources(extensionPath: string): LearningResource[] {
		if (this.loaded) {
			return this.resources;
		}

		try {
			const resourcesPath = join(
				extensionPath,
				"specs",
				"006-welcome-screen",
				"resources.json"
			);

			const fileContent = readFileSync(resourcesPath, "utf8");
			const rawResources = JSON.parse(fileContent) as LearningResource[];

			// Sort resources according to FR-015:
			// 1. Category (Getting Started → Advanced Features → Troubleshooting)
			// 2. Within category: alphabetical by title
			this.resources = this.sortResources(rawResources);
			this.loaded = true;

			return this.resources;
		} catch (error) {
			// Only log in non-test environment
			if (process.env.NODE_ENV !== "test" && typeof process !== "undefined") {
				console.error("[LearningResources] Failed to load resources:", error);
			}
			// Return empty array on error
			this.resources = [];
			this.loaded = true;
			return [];
		}
	}

	/**
	 * Get all resources sorted by category and title
	 */
	getAll(): LearningResource[] {
		if (!this.loaded) {
			throw new Error("Resources not loaded. Call loadResources() first.");
		}
		return [...this.resources];
	}

	/**
	 * Filter resources by category
	 */
	getByCategory(category: ResourceCategory): LearningResource[] {
		if (!this.loaded) {
			throw new Error("Resources not loaded. Call loadResources() first.");
		}
		return this.resources.filter((r) => r.category === category);
	}

	/**
	 * Search resources by keyword matching title, description, or keywords array
	 * Results sorted by relevance (keyword match count) then alphabetically
	 */
	searchByKeyword(query: string): LearningResource[] {
		if (!this.loaded) {
			throw new Error("Resources not loaded. Call loadResources() first.");
		}

		if (!query || query.trim() === "") {
			return this.getAll();
		}

		const normalizedQuery = query.toLowerCase().trim();
		const queryWords = normalizedQuery.split(WHITESPACE_REGEX);

		// Score each resource by keyword matches
		const scored = this.resources
			.map((resource) => ({
				resource,
				score: this.calculateResourceScore(resource, queryWords),
			}))
			.filter((item) => item.score > 0);

		// Sort by score (descending) then alphabetically
		scored.sort((a, b) => {
			if (b.score !== a.score) {
				return b.score - a.score;
			}
			return a.resource.title.localeCompare(b.resource.title);
		});

		return scored.map((item) => item.resource);
	}

	/**
	 * Get resources count by category
	 */
	getCategoryCounts(): Record<ResourceCategory, number> {
		if (!this.loaded) {
			throw new Error("Resources not loaded. Call loadResources() first.");
		}

		return {
			"Getting Started": this.resources.filter(
				(r) => r.category === "Getting Started"
			).length,
			"Advanced Features": this.resources.filter(
				(r) => r.category === "Advanced Features"
			).length,
			Troubleshooting: this.resources.filter(
				(r) => r.category === "Troubleshooting"
			).length,
		};
	}

	/**
	 * Get resource by ID
	 */
	getById(id: string): LearningResource | undefined {
		if (!this.loaded) {
			throw new Error("Resources not loaded. Call loadResources() first.");
		}
		return this.resources.find((r) => r.id === id);
	}

	/**
	 * Sort resources by category order then alphabetically
	 * Per FR-015 specification
	 */
	private sortResources(resources: LearningResource[]): LearningResource[] {
		const categoryOrder: Record<ResourceCategory, number> = {
			"Getting Started": 1,
			"Advanced Features": 2,
			Troubleshooting: 3,
		};

		return resources.sort((a, b) => {
			// First by category
			const catA = categoryOrder[a.category];
			const catB = categoryOrder[b.category];

			if (catA !== catB) {
				return catA - catB;
			}

			// Then alphabetically by title
			return a.title.localeCompare(b.title);
		});
	}

	/**
	 * Check if resources are loaded
	 */
	isLoaded(): boolean {
		return this.loaded;
	}

	/**
	 * Calculate relevance score for a resource based on query words
	 * @private
	 */
	private calculateResourceScore(
		resource: LearningResource,
		queryWords: string[]
	): number {
		let score = 0;

		// Search in title (highest weight)
		const titleLower = resource.title.toLowerCase();
		for (const word of queryWords) {
			if (titleLower.includes(word)) {
				score += 3;
			}
		}

		// Search in description (medium weight)
		const descLower = resource.description.toLowerCase();
		for (const word of queryWords) {
			if (descLower.includes(word)) {
				score += 2;
			}
		}

		// Search in keywords (exact match weight)
		for (const keyword of resource.keywords) {
			for (const word of queryWords) {
				if (keyword === word) {
					score += 5; // Exact keyword match highest priority
				} else if (keyword.includes(word)) {
					score += 1;
				}
			}
		}

		return score;
	}

	/**
	 * Reset service (for testing)
	 */
	reset(): void {
		this.resources = [];
		this.loaded = false;
	}
}
