/**
 * Features Section Component
 * Quick access to GatomIA feature commands and actions
 */

import type { FeatureAction } from "../types";

interface FeaturesSectionProps {
	featureActions: FeatureAction[];
	onExecuteCommand: (commandId: string, args?: unknown[]) => void;
}

export const FeaturesSection = ({
	featureActions,
	onExecuteCommand,
}: FeaturesSectionProps) => {
	// Group actions by feature area
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

	const featureAreas = ["Specs", "Prompts", "Hooks", "Steering"] as const;

	return (
		<div className="welcome-section">
			<div className="welcome-section-header">
				<h2 className="welcome-section-title">Features & Quick Actions</h2>
			</div>

			<p className="welcome-section-description">
				Quickly access GatomIA features and execute common tasks. Each card
				represents a key action you can perform.
			</p>

			{featureAreas.map((area) => {
				const actions = actionsByArea[area] || [];
				if (actions.length === 0) {
					return null;
				}

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
								marginBottom: "16px",
							}}
						>
							<i className={`codicon ${getAreaIconClass(area)}`} /> {area}
						</h3>

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
 * Get icon class for feature area
 */
function getAreaIconClass(area: string): string {
	switch (area) {
		case "Specs":
			return "codicon-file-text";
		case "Prompts":
			return "codicon-comment-discussion";
		case "Hooks":
			return "codicon-extensions";
		case "Steering":
			return "codicon-target";
		default:
			return "codicon-zap";
	}
}
