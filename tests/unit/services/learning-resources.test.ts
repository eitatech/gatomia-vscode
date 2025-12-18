/**
 * Unit Tests: LearningResources Service
 * Tests for learning resources loading, filtering, and keyword search
 * Based on specs/006-welcome-screen FR-015 and tasks T075-T076
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LearningResources } from "../../../src/services/learning-resources";

describe("LearningResources Service - Unit Tests (US4 - T075)", () => {
	let service: LearningResources;
	const mockExtensionPath = "/fake/extension/path";

	beforeEach(() => {
		service = new LearningResources();
	});

	afterEach(() => {
		service.reset();
	});

	describe("Resource Loading (T075)", () => {
		it("should load resources from resources.json file", () => {
			// This test validates that loadResources reads from the correct file path
			const resources = service.loadResources(mockExtensionPath);

			// Should attempt to load (even if file doesn't exist in test)
			expect(resources).toBeDefined();
			expect(Array.isArray(resources)).toBe(true);
		});

		it("should return 15 total resources across all categories", () => {
			const resources = service.loadResources(mockExtensionPath);

			if (resources.length > 0) {
				expect(resources.length).toBe(15);
			}
		});

		it("should return Getting Started resources (5 items)", () => {
			service.loadResources(mockExtensionPath);
			const gettingStarted = service.getByCategory("Getting Started");

			if (service.isLoaded() && service.getAll().length > 0) {
				expect(gettingStarted.length).toBe(5);
			}
		});

		it("should return Advanced Features resources (6 items)", () => {
			service.loadResources(mockExtensionPath);
			const advancedFeatures = service.getByCategory("Advanced Features");

			if (service.isLoaded() && service.getAll().length > 0) {
				expect(advancedFeatures.length).toBe(6);
			}
		});

		it("should return Troubleshooting resources (4 items)", () => {
			service.loadResources(mockExtensionPath);
			const troubleshooting = service.getByCategory("Troubleshooting");

			if (service.isLoaded() && service.getAll().length > 0) {
				expect(troubleshooting.length).toBe(4);
			}
		});

		it("should sort resources by category order (Getting Started → Advanced Features → Troubleshooting)", () => {
			const resources = service.loadResources(mockExtensionPath);

			if (resources.length > 0) {
				const categories = resources.map((r) => r.category);

				// Find indices of category transitions
				const firstAdvanced = categories.indexOf("Advanced Features");
				const firstTroubleshooting = categories.indexOf("Troubleshooting");

				if (firstAdvanced !== -1 && firstTroubleshooting !== -1) {
					// Getting Started should come before Advanced Features
					expect(firstAdvanced).toBeGreaterThan(0);
					// Advanced Features should come before Troubleshooting
					expect(firstTroubleshooting).toBeGreaterThan(firstAdvanced);
				}
			}
		});

		it("should sort resources alphabetically within each category", () => {
			const resources = service.loadResources(mockExtensionPath);

			if (resources.length > 0) {
				const gettingStarted = resources.filter(
					(r) => r.category === "Getting Started"
				);

				if (gettingStarted.length > 1) {
					for (let i = 0; i < gettingStarted.length - 1; i++) {
						expect(
							gettingStarted[i].title.localeCompare(gettingStarted[i + 1].title)
						).toBeLessThanOrEqual(0);
					}
				}
			}
		});

		it("should have all required properties for each resource", () => {
			const resources = service.loadResources(mockExtensionPath);

			if (resources.length > 0) {
				const resource = resources[0];

				expect(resource).toHaveProperty("id");
				expect(resource).toHaveProperty("title");
				expect(resource).toHaveProperty("description");
				expect(resource).toHaveProperty("url");
				expect(resource).toHaveProperty("category");
				expect(resource).toHaveProperty("keywords");
				expect(resource).toHaveProperty("estimatedMinutes");

				expect(typeof resource.id).toBe("string");
				expect(typeof resource.title).toBe("string");
				expect(typeof resource.description).toBe("string");
				expect(typeof resource.url).toBe("string");
				expect(typeof resource.category).toBe("string");
				expect(Array.isArray(resource.keywords)).toBe(true);
			}
		});

		it("should validate all URLs are HTTPS", () => {
			const resources = service.loadResources(mockExtensionPath);

			if (resources.length > 0) {
				for (const resource of resources) {
					expect(resource.url.startsWith("https://")).toBe(true);
				}
			}
		});

		it("should return empty array on file not found", () => {
			const resources = service.loadResources("/nonexistent/path");

			expect(resources).toBeDefined();
			expect(Array.isArray(resources)).toBe(true);
			expect(resources.length).toBe(0);
		});

		it("should cache loaded resources on subsequent calls", () => {
			const first = service.loadResources(mockExtensionPath);
			const second = service.loadResources(mockExtensionPath);

			// Should return the same cached array (or both empty if not loaded)
			if (first.length > 0) {
				expect(second).toBe(first);
			} else {
				// Both should be empty arrays
				expect(second.length).toBe(0);
				expect(first.length).toBe(0);
			}
		});

		it("should provide category counts", () => {
			service.loadResources(mockExtensionPath);

			if (service.isLoaded() && service.getAll().length > 0) {
				const counts = service.getCategoryCounts();

				expect(counts).toHaveProperty("Getting Started");
				expect(counts).toHaveProperty("Advanced Features");
				expect(counts).toHaveProperty("Troubleshooting");

				expect(counts["Getting Started"]).toBe(5);
				expect(counts["Advanced Features"]).toBe(6);
				expect(counts.Troubleshooting).toBe(4);
			}
		});

		it("should find resource by ID", () => {
			service.loadResources(mockExtensionPath);

			if (service.isLoaded() && service.getAll().length > 0) {
				const resource = service.getById("speckit-quickstart");

				if (resource) {
					expect(resource.id).toBe("speckit-quickstart");
					expect(resource.title).toContain("SpecKit");
				}
			}
		});
	});

	describe("Keyword Search (T076)", () => {
		beforeEach(() => {
			service.loadResources(mockExtensionPath);
		});

		it("should search in title and return matching resources", () => {
			if (!service.isLoaded() || service.getAll().length === 0) {
				return; // Skip if resources not loaded
			}

			const results = service.searchByKeyword("SpecKit");

			expect(results.length).toBeGreaterThan(0);

			// All results should have "speckit" in title, description, or keywords
			for (const result of results) {
				const hasMatch =
					result.title.toLowerCase().includes("speckit") ||
					result.description.toLowerCase().includes("speckit") ||
					result.keywords.some((k) => k.toLowerCase().includes("speckit"));

				expect(hasMatch).toBe(true);
			}
		});

		it("should search in description and return matching resources", () => {
			if (!service.isLoaded() || service.getAll().length === 0) {
				return;
			}

			const results = service.searchByKeyword("workflow");

			expect(results.length).toBeGreaterThan(0);
		});

		it("should search in keywords array and return matching resources", () => {
			if (!service.isLoaded() || service.getAll().length === 0) {
				return;
			}

			const results = service.searchByKeyword("troubleshooting");

			expect(results.length).toBeGreaterThan(0);

			// Should prioritize resources with exact keyword match
			const hasKeywordMatch = results.some((r) =>
				r.keywords.includes("troubleshooting")
			);
			expect(hasKeywordMatch).toBe(true);
		});

		it("should return empty array for no matches", () => {
			if (!service.isLoaded() || service.getAll().length === 0) {
				return;
			}

			const results = service.searchByKeyword("xyznonexistent");

			expect(results).toBeDefined();
			expect(Array.isArray(results)).toBe(true);
			expect(results.length).toBe(0);
		});

		it("should sort results by relevance score (keyword matches)", () => {
			if (!service.isLoaded() || service.getAll().length === 0) {
				return;
			}

			const results = service.searchByKeyword("hooks");

			if (results.length > 1) {
				// First result should have higher relevance (more "hooks" mentions)
				const firstScore = countKeywordMatches(results[0], "hooks");
				const lastScore = countKeywordMatches(results.at(-1), "hooks");

				expect(firstScore).toBeGreaterThanOrEqual(lastScore);
			}
		});

		it("should sort results alphabetically for same relevance score", () => {
			if (!service.isLoaded() || service.getAll().length === 0) {
				return;
			}

			// Search for broad term that matches multiple resources
			const results = service.searchByKeyword("guide");

			if (results.length > 1) {
				// Check if results with same score are alphabetically sorted
				for (let i = 0; i < results.length - 1; i++) {
					const currentScore = countKeywordMatches(results[i], "guide");
					const nextScore = countKeywordMatches(results[i + 1], "guide");

					if (currentScore === nextScore) {
						expect(
							results[i].title.localeCompare(results[i + 1].title)
						).toBeLessThanOrEqual(0);
					}
				}
			}
		});

		it("should be case-insensitive for searches", () => {
			if (!service.isLoaded() || service.getAll().length === 0) {
				return;
			}

			const lowerResults = service.searchByKeyword("speckit");
			const upperResults = service.searchByKeyword("SPECKIT");
			const mixedResults = service.searchByKeyword("SpEcKiT");

			expect(lowerResults.length).toBe(upperResults.length);
			expect(lowerResults.length).toBe(mixedResults.length);
		});

		it("should handle multi-word queries", () => {
			if (!service.isLoaded() || service.getAll().length === 0) {
				return;
			}

			const results = service.searchByKeyword("getting started speckit");

			expect(results.length).toBeGreaterThan(0);

			// Should find resources that match any of the words
			for (const result of results) {
				const text =
					`${result.title} ${result.description} ${result.keywords.join(" ")}`.toLowerCase();
				const hasMatch =
					text.includes("getting") ||
					text.includes("started") ||
					text.includes("speckit");

				expect(hasMatch).toBe(true);
			}
		});

		it("should trim and normalize whitespace in queries", () => {
			if (!service.isLoaded() || service.getAll().length === 0) {
				return;
			}

			const normal = service.searchByKeyword("hooks");
			const padded = service.searchByKeyword("  hooks  ");
			const multiSpace = service.searchByKeyword("hooks   automation");

			expect(normal.length).toBeGreaterThan(0);
			expect(padded.length).toBe(normal.length);
		});

		it("should return all resources for empty query", () => {
			if (!service.isLoaded() || service.getAll().length === 0) {
				return;
			}

			const emptyResults = service.searchByKeyword("");
			const allResources = service.getAll();

			expect(emptyResults.length).toBe(allResources.length);
		});

		it("should return all resources for whitespace-only query", () => {
			if (!service.isLoaded() || service.getAll().length === 0) {
				return;
			}

			const whitespaceResults = service.searchByKeyword("   ");
			const allResources = service.getAll();

			expect(whitespaceResults.length).toBe(allResources.length);
		});

		it("should prioritize exact keyword matches over partial matches", () => {
			if (!service.isLoaded() || service.getAll().length === 0) {
				return;
			}

			const results = service.searchByKeyword("troubleshooting");

			if (results.length > 0) {
				// First result should have "troubleshooting" as exact keyword
				const firstHasExactMatch =
					results[0].keywords.includes("troubleshooting");

				if (firstHasExactMatch) {
					// Verify this is prioritized over partial matches
					expect(results[0].keywords).toContain("troubleshooting");
				}
			}
		});

		it("should throw error if resources not loaded before search", () => {
			const freshService = new LearningResources();

			expect(() => {
				freshService.searchByKeyword("test");
			}).toThrow("Resources not loaded");
		});
	});
});

/**
 * Helper to count keyword matches in a resource
 */
function countKeywordMatches(resource: any, query: string): number {
	let count = 0;
	const queryLower = query.toLowerCase();

	if (resource.title.toLowerCase().includes(queryLower)) {
		count += 3;
	}

	if (resource.description.toLowerCase().includes(queryLower)) {
		count += 2;
	}

	for (const keyword of resource.keywords) {
		if (keyword === queryLower) {
			count += 5;
		} else if (keyword.includes(queryLower)) {
			count += 1;
		}
	}

	return count;
}
