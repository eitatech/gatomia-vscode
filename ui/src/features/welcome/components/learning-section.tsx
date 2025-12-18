/**
 * Learning Section Component
 * Categorized learning resources with search functionality
 */

import { useState } from "react";
import type { LearningResource, ResourceCategory } from "../types";

interface LearningSectionProps {
	resources: LearningResource[];
	onOpenExternal: (url: string) => void;
	onSearch: (query: string) => void;
}

export const LearningSection = ({
	resources,
	onOpenExternal,
	onSearch,
}: LearningSectionProps) => {
	const [activeCategory, setActiveCategory] = useState<
		ResourceCategory | "all"
	>("all");
	const [searchQuery, setSearchQuery] = useState("");

	// Filter resources by category
	const filteredByCategory =
		activeCategory === "all"
			? resources
			: resources.filter((r) => r.category === activeCategory);

	// Further filter by search query (client-side for immediate feedback)
	const displayedResources = searchQuery.trim()
		? filteredByCategory.filter((r) => {
				const query = searchQuery.toLowerCase();
				return (
					r.title.toLowerCase().includes(query) ||
					r.description.toLowerCase().includes(query) ||
					r.keywords.some((k) => k.toLowerCase().includes(query))
				);
			})
		: filteredByCategory;

	const categories: Array<{
		id: ResourceCategory | "all";
		label: string;
		count: number;
	}> = [
		{
			id: "all",
			label: "All Resources",
			count: resources.length,
		},
		{
			id: "Getting Started",
			label: "Getting Started",
			count: resources.filter((r) => r.category === "Getting Started").length,
		},
		{
			id: "Advanced Features",
			label: "Advanced Features",
			count: resources.filter((r) => r.category === "Advanced Features").length,
		},
		{
			id: "Troubleshooting",
			label: "Troubleshooting",
			count: resources.filter((r) => r.category === "Troubleshooting").length,
		},
	];

	const handleSearchChange = (query: string) => {
		setSearchQuery(query);
		// Also notify parent for any server-side search handling
		if (query.trim()) {
			onSearch(query.trim());
		}
	};

	return (
		<div className="welcome-section">
			<div className="welcome-section-header">
				<h2 className="welcome-section-title">
					<i className="codicon codicon-book" />
					Learning Resources & Documentation
				</h2>
			</div>

			<p className="welcome-section-description">
				Explore guides, tutorials, and documentation to master GatomIA features.
				Filter by category or search for specific topics.
			</p>

			{/* Search Input */}
			<div className="learning-search" style={{ marginBottom: "20px" }}>
				<input
					aria-label="Search learning resources"
					className="learning-search-input"
					onChange={(e) => handleSearchChange(e.target.value)}
					placeholder="Search resources by title, description, or keywords..."
					type="text"
					value={searchQuery}
				/>
			</div>

			{/* Category Filters */}
			<div className="learning-filters">
				{categories.map((category) => (
					<button
						aria-pressed={activeCategory === category.id}
						className={`learning-filter-button ${activeCategory === category.id ? "active" : ""}`}
						key={category.id}
						onClick={() => setActiveCategory(category.id)}
						type="button"
					>
						{category.label} ({category.count})
					</button>
				))}
			</div>

			{/* Resource Cards */}
			{displayedResources.length > 0 ? (
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "12px",
						marginTop: "20px",
					}}
				>
					{displayedResources.map((resource) => (
						<ResourceCard
							key={resource.id}
							onOpen={() => onOpenExternal(resource.url)}
							resource={resource}
						/>
					))}
				</div>
			) : (
				<div className="welcome-empty" style={{ marginTop: "32px" }}>
					<div className="welcome-empty-title">No Resources Found</div>
					<div className="welcome-empty-description">
						{searchQuery
							? `No resources match "${searchQuery}". Try a different search term.`
							: "No resources available in this category."}
					</div>
				</div>
			)}

			{/* Quick Tips */}
			{resources.length > 0 && (
				<div
					style={{
						marginTop: "32px",
						padding: "16px",
						backgroundColor:
							"color-mix(in srgb, var(--vscode-textBlockQuote-background) 50%, transparent)",
						borderRadius: "4px",
						borderLeft: "3px solid var(--vscode-textLink-foreground)",
					}}
				>
					<h4
						style={{
							fontSize: "13px",
							fontWeight: 600,
							marginBottom: "8px",
							color: "var(--vscode-foreground)",
						}}
					>
						Quick Tips
					</h4>
					<ul
						style={{
							marginLeft: "20px",
							fontSize: "12px",
							color: "var(--vscode-descriptionForeground)",
							lineHeight: "1.8",
						}}
					>
						<li>
							<strong>New to GatomIA?</strong> Start with "Getting Started"
							resources for quick tutorials.
						</li>
						<li>
							<strong>Need help?</strong> Check "Troubleshooting" for common
							issues and solutions.
						</li>
						<li>
							<strong>Search</strong> by keywords like "hooks", "speckit", or
							"copilot" to find specific topics.
						</li>
						<li>
							<strong>External links</strong> open in your default browser for
							detailed documentation.
						</li>
					</ul>
				</div>
			)}
		</div>
	);
};

/**
 * Resource Card Component
 */
interface ResourceCardProps {
	resource: LearningResource;
	onOpen: () => void;
}

const ResourceCard = ({ resource, onOpen }: ResourceCardProps) => (
	<button
		aria-label={`Open ${resource.title} - ${resource.description}`}
		className="resource-card"
		onClick={onOpen}
		type="button"
	>
		<div className="resource-card-header">
			<h3 className="resource-card-title">{resource.title}</h3>
			<div className="resource-card-meta">
				<span
					className="resource-card-category"
					title={`Category: ${resource.category}`}
				>
					<i className={`codicon ${getCategoryIconClass(resource.category)}`} />{" "}
					{resource.category}
				</span>
				{resource.estimatedMinutes && (
					<span title={`Estimated time: ${resource.estimatedMinutes} minutes`}>
						<i className="codicon codicon-watch" /> {resource.estimatedMinutes}{" "}
						min
					</span>
				)}
				<span title="External link">
					<i className="codicon codicon-link-external" />
				</span>
			</div>
		</div>
		<p className="resource-card-description">{resource.description}</p>
		{resource.keywords.length > 0 && (
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					gap: "6px",
					marginTop: "8px",
				}}
			>
				{resource.keywords.slice(0, 5).map((keyword) => (
					<span
						key={keyword}
						style={{
							padding: "2px 8px",
							borderRadius: "8px",
							backgroundColor: "var(--vscode-badge-background)",
							color: "var(--vscode-badge-foreground)",
							fontSize: "10px",
							fontWeight: 500,
						}}
					>
						{keyword}
					</span>
				))}
			</div>
		)}
	</button>
);

/**
 * Get icon class for category
 */
function getCategoryIconClass(category: ResourceCategory): string {
	switch (category) {
		case "Getting Started":
			return "codicon-rocket";
		case "Advanced Features":
			return "codicon-settings-gear";
		case "Troubleshooting":
			return "codicon-tools";
		default:
			return "codicon-file";
	}
}
