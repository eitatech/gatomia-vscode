/**
 * Features Section Component
 *
 * Renders the "Features & Quick Actions" tab of the Welcome Screen as a set
 * of grouped cards. Groups are rendered in a stable order defined by
 * {@link FEATURE_AREA_ORDER} and only areas that actually contain actions are
 * shown, so IDE-specific groups (e.g. `Chat Provider` on Windsurf /
 * Antigravity) appear automatically when the extension host populates them.
 *
 * @see `src/providers/welcome-screen-provider.ts#getFeatureActions` for the
 *      authoritative action catalogue.
 */

import type { FeatureArea, FeatureAction } from "../types";

interface FeaturesSectionProps {
	featureActions: FeatureAction[];
	onExecuteCommand: (commandId: string, args?: unknown[]) => void;
}

/**
 * Ordered presentation of feature areas. This list covers every known
 * `FeatureArea` variant — unknown areas are appended at the end alphabetically
 * so the UI degrades gracefully if the extension introduces a new group
 * without updating the webview bundle.
 */
const FEATURE_AREA_ORDER: readonly FeatureArea[] = [
	"Specs",
	"SpecKit Workflow",
	"Actions",
	"Hooks",
	"Steering",
	"Cloud Agents",
	"Chat Provider",
	"Documentation",
	"Configuration",
] as const;

/**
 * Short human-readable tagline rendered under each area heading. Helps users
 * scan the Features tab without having to read every card description.
 */
const FEATURE_AREA_SUBTITLES: Record<FeatureArea, string> = {
	Specs: "Spec lifecycle entrypoints.",
	"SpecKit Workflow":
		"Canonical Spec-Driven Development pipeline, from constitution to tests.",
	Actions: "Manage custom prompts, agents, and skills.",
	Hooks: "Automate workflows with triggers and actions.",
	Steering: "Project and user rules that guide agents.",
	"Cloud Agents": "Dispatch work to remote execution providers.",
	"Chat Provider":
		"Route prompts through the Agent Client Protocol (Windsurf / Antigravity).",
	Documentation: "Repository wiki and in-editor help.",
	Configuration: "Settings, dependencies, and environment.",
};

export const FeaturesSection = ({
	featureActions,
	onExecuteCommand,
}: FeaturesSectionProps) => {
	const actionsByArea = featureActions.reduce(
		(acc, action) => {
			if (!acc[action.featureArea]) {
				acc[action.featureArea] = [];
			}
			acc[action.featureArea].push(action);
			return acc;
		},
		{} as Record<string, FeatureAction[]>
	);

	const knownAreas = FEATURE_AREA_ORDER.filter(
		(area) => (actionsByArea[area] || []).length > 0
	);
	const unknownAreas = Object.keys(actionsByArea)
		.filter((area) => !(FEATURE_AREA_ORDER as readonly string[]).includes(area))
		.sort();
	const areasToRender: string[] = [...knownAreas, ...unknownAreas];

	return (
		<div className="welcome-section">
			<div className="welcome-section-header">
				<h2 className="welcome-section-title">Features & Quick Actions</h2>
			</div>

			<p className="welcome-section-description">
				Quickly access every GatomIA feature. Cards are grouped by capability
				area and mirror the commands contributed by the extension; some groups
				only appear on compatible IDE hosts.
			</p>

			{areasToRender.map((area) => {
				const actions = actionsByArea[area] || [];
				const subtitle =
					FEATURE_AREA_SUBTITLES[area as FeatureArea] ?? undefined;

				return (
					<div
						key={area}
						style={{
							marginBottom: "32px",
						}}
					>
						<h3
							className="welcome-section-title"
							style={{
								fontSize: "16px",
								marginBottom: subtitle ? "4px" : "16px",
							}}
						>
							<i className={`codicon ${getAreaIconClass(area)}`} /> {area}
						</h3>
						{subtitle && (
							<p
								style={{
									fontSize: "12px",
									color: "var(--vscode-descriptionForeground)",
									margin: "0 0 12px 0",
								}}
							>
								{subtitle}
							</p>
						)}

						<div className="welcome-card-grid">
							{actions.map((action) => (
								<FeatureActionCard
									action={action}
									key={action.id}
									onExecute={() =>
										onExecuteCommand(action.commandId, undefined)
									}
								/>
							))}
						</div>
					</div>
				);
			})}

			{featureActions.length === 0 && (
				<div className="welcome-empty">
					<div className="welcome-empty-title">No Actions Available</div>
					<div className="welcome-empty-description">
						Feature actions will appear here once the extension is fully
						initialized.
					</div>
				</div>
			)}
		</div>
	);
};

/**
 * Feature Action Card Component
 */
interface FeatureActionCardProps {
	action: FeatureAction;
	onExecute: () => void;
}

const FeatureActionCard = ({ action, onExecute }: FeatureActionCardProps) => {
	let iconElement: JSX.Element;
	if (action.icon?.startsWith("codicon-")) {
		iconElement = (
			<i
				aria-hidden="true"
				className={`codicon ${action.icon} welcome-card-icon`}
			/>
		);
	} else if (action.icon) {
		iconElement = (
			<div aria-hidden="true" className="welcome-card-icon">
				{action.icon}
			</div>
		);
	} else {
		iconElement = (
			<i aria-hidden="true" className="codicon codicon-zap welcome-card-icon" />
		);
	}

	return (
		<button
			aria-label={`${action.label} - ${action.description}`}
			className="welcome-card"
			disabled={!action.enabled}
			onClick={onExecute}
			style={{
				textAlign: "left",
				opacity: action.enabled ? 1 : 0.5,
				cursor: action.enabled ? "pointer" : "not-allowed",
			}}
			type="button"
		>
			<div className="welcome-card-header">
				{iconElement}
				<h3 className="welcome-card-title">{action.label}</h3>
			</div>
			<p className="welcome-card-description">{action.description}</p>
			{!action.enabled && (
				<div
					style={{
						marginTop: "8px",
						fontSize: "11px",
						color: "var(--vscode-editorWarning-foreground)",
						display: "flex",
						alignItems: "center",
						gap: "4px",
					}}
				>
					<i className="codicon codicon-warning" /> Action currently unavailable
				</div>
			)}
		</button>
	);
};

/**
 * Get codicon class name for a feature area heading. Falls back to a generic
 * lightning-bolt icon for unknown areas emitted by future extension versions.
 */
function getAreaIconClass(area: string): string {
	switch (area) {
		case "Specs":
			return "codicon-file-text";
		case "SpecKit Workflow":
			return "codicon-run-all";
		case "Actions":
			return "codicon-comment-discussion";
		case "Hooks":
			return "codicon-plug";
		case "Steering":
			return "codicon-target";
		case "Cloud Agents":
			return "codicon-cloud";
		case "Chat Provider":
			return "codicon-hubot";
		case "Documentation":
			return "codicon-book";
		case "Configuration":
			return "codicon-settings-gear";
		default:
			return "codicon-zap";
	}
}
