/**
 * StatusSection Component
 * Displays extension health, versions, diagnostics, and dependency status
 * Based on specs/006-welcome-screen FR-013 tasks T098-T111
 */

import type { DependencyStatus, SystemDiagnostic } from "../types";
import { vscode } from "../../../bridge/vscode";

interface StatusSectionProps {
	extensionVersion: string;
	vscodeVersion: string;
	dependencies: DependencyStatus;
	diagnostics: SystemDiagnostic[];
	onInstallDependency: (dependencyId: string) => void;
	onOpenExternal?: (url: string) => void;
}

/**
 * Dependency item for rendering
 */
interface DependencyItem {
	id: "copilot-chat" | "speckit" | "openspec";
	name: string;
	installed: boolean;
	version: string | null;
	required: boolean;
}

/**
 * Get health status based on dependencies and diagnostics
 */
function getHealthStatus(
	dependencies: DependencyStatus,
	diagnostics: SystemDiagnostic[]
) {
	const hasErrors = diagnostics.some((d) => d.severity === "error");

	// Check if any required dependencies are missing
	const hasMissingDeps = !(
		dependencies.copilotChat.installed &&
		dependencies.speckit.installed &&
		dependencies.openspec.installed
	);

	if (hasErrors || hasMissingDeps) {
		return "error";
	}

	const hasWarnings = diagnostics.some((d) => d.severity === "warning");
	if (hasWarnings) {
		return "warning";
	}

	return "healthy";
}

/**
 * Convert DependencyStatus object to array for rendering
 */
function getDependencyItems(dependencies: DependencyStatus): DependencyItem[] {
	return [
		{
			id: "copilot-chat",
			name: "GitHub Copilot Chat",
			installed: dependencies.copilotChat.installed,
			version: dependencies.copilotChat.version,
			required: true,
		},
		{
			id: "speckit",
			name: "SpecKit CLI",
			installed: dependencies.speckit.installed,
			version: dependencies.speckit.version,
			required: true,
		},
		{
			id: "openspec",
			name: "OpenSpec CLI",
			installed: dependencies.openspec.installed,
			version: dependencies.openspec.version,
			required: false,
		},
	];
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	const minutes = Math.floor(diff / 60_000);
	const hours = Math.floor(diff / 3_600_000);
	const days = Math.floor(diff / 86_400_000);

	if (minutes < 1) {
		return "just now";
	}
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	if (hours < 24) {
		return `${hours}h ago`;
	}
	return `${days}d ago`;
}

/**
 * Get severity icon class
 */
function getSeverityIconClass(severity: "error" | "warning"): string {
	return severity === "error" ? "codicon-error" : "codicon-warning";
}

/**
 * Get health icon class
 */
function getHealthIconClass(status: "healthy" | "warning" | "error"): string {
	switch (status) {
		case "healthy":
			return "codicon-pass-filled";
		case "warning":
			return "codicon-warning";
		case "error":
			return "codicon-error";
		default:
			return "codicon-error";
	}
}

/**
 * Get dependency icon class
 */
function getDependencyIconClass(installed: boolean, required: boolean): string {
	if (!required) {
		return "codicon-info";
	}
	return installed ? "codicon-pass-filled" : "codicon-error";
}

export function StatusSection({
	extensionVersion,
	vscodeVersion,
	dependencies,
	diagnostics,
	onInstallDependency,
	onOpenExternal,
}: StatusSectionProps) {
	const healthStatus = getHealthStatus(dependencies, diagnostics);
	const allHealthy = healthStatus === "healthy";
	const dependencyItems = getDependencyItems(dependencies);

	return (
		<div className="status-section">
			{/* Health Status Banner */}
			<div className={`health-banner health-banner--${healthStatus}`}>
				<i
					className={`codicon ${getHealthIconClass(healthStatus)} health-icon`}
				/>
				<div className="health-content">
					{allHealthy ? (
						<>
							<h3>All Systems Healthy</h3>
							<p>
								Extension is working correctly with all dependencies installed
							</p>
						</>
					) : (
						<>
							<h3>
								{healthStatus === "error"
									? "Issues Detected"
									: "Warnings Present"}
							</h3>
							<p>
								{healthStatus === "error"
									? "Some features may not work correctly"
									: "Extension is working but has minor issues"}
							</p>
						</>
					)}
				</div>
			</div>

			{/* Version Information */}
			<div className="version-info">
				<h3>Version Information</h3>
				<div className="version-grid">
					<div className="version-item">
						<span className="version-label">Gatomia Extension</span>
						<span className="version-value">v{extensionVersion}</span>
					</div>
					<div className="version-item">
						<span className="version-label">VS Code</span>
						<span className="version-value">v{vscodeVersion}</span>
					</div>
				</div>
				<button
					className="changelog-link"
					onClick={(e) => {
						e.preventDefault();
						const url =
							"https://github.com/eitatech/gatomia-vscode/blob/main/CHANGELOG.md";
						if (onOpenExternal) {
							onOpenExternal(url);
						} else if (vscode) {
							vscode.postMessage({
								type: "welcome/open-external",
								url,
							});
						}
					}}
					type="button"
				>
					<i className="codicon codicon-book" /> View Changelog
				</button>
			</div>

			{/* Dependency Status */}
			<div className="dependency-status">
				<h3>Dependencies</h3>
				<div className="dependency-list">
					{dependencyItems.map((dep) => (
						<div
							className={`dependency-item ${!dep.installed && dep.required ? "dependency-item--missing" : ""}`}
							key={dep.id}
						>
							<div className="dependency-info">
								<i
									className={`codicon ${getDependencyIconClass(dep.installed, dep.required)} dependency-icon`}
								/>
								<div className="dependency-details">
									<div className="dependency-name">
										{dep.name}
										{dep.required && (
											<span className="dependency-badge">Required</span>
										)}
									</div>
									{dep.installed && dep.version && (
										<div className="dependency-version">v{dep.version}</div>
									)}
									{!dep.installed && (
										<div className="dependency-status-text">Not installed</div>
									)}
								</div>
							</div>
							{!dep.installed && dep.required && (
								<button
									className="install-button"
									onClick={() => onInstallDependency(dep.id)}
									type="button"
								>
									Install
								</button>
							)}
						</div>
					))}
				</div>
			</div>

			{/* Recent Diagnostics */}
			{diagnostics.length > 0 && (
				<div className="diagnostics-section">
					<h3>Recent Diagnostics</h3>
					<p className="diagnostics-description">
						Last 5 issues from the past 24 hours
					</p>
					<div className="diagnostic-list">
						{diagnostics.map((diag) => (
							<div
								className={`diagnostic-item diagnostic-item--${diag.severity}`}
								key={diag.id}
							>
								<div className="diagnostic-header">
									<i
										className={`codicon ${getSeverityIconClass(diag.severity)} diagnostic-icon`}
									/>
									<div className="diagnostic-info">
										<div className="diagnostic-message">{diag.message}</div>
										<div className="diagnostic-meta">
											<span className="diagnostic-source">{diag.source}</span>
											<span className="diagnostic-separator">•</span>
											<span className="diagnostic-time">
												{formatRelativeTime(diag.timestamp)}
											</span>
										</div>
									</div>
								</div>
								{diag.suggestedAction && (
									<div className="diagnostic-action">
										<strong>Suggested action:</strong> {diag.suggestedAction}
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			{/* Quick Tips */}
			<div className="status-tips">
				<h4>
					<i className="codicon codicon-lightbulb" /> Quick Tips
				</h4>
				<ul>
					<li>Diagnostics are automatically cleaned up after 24 hours</li>
					<li>Only the 5 most recent issues are shown</li>
					<li>
						Missing required dependencies may prevent some features from working
					</li>
					<li>Check the Output panel (View → Output) for detailed logs</li>
				</ul>
			</div>

			<style>{`
				.status-section {
					display: flex;
					flex-direction: column;
					gap: 24px;
					padding: 16px;
				}

				/* Health Banner */
				.health-banner {
					display: flex;
					align-items: flex-start;
					gap: 12px;
					padding: 16px;
					border-radius: 8px;
					border: 1px solid;
				}

				.health-banner--healthy {
					background: color-mix(in srgb, var(--vscode-testing-iconPassed) 10%, transparent);
					border-color: var(--vscode-testing-iconPassed);
				}

				.health-banner--warning {
					background: color-mix(in srgb, var(--vscode-editorWarning-foreground) 10%, transparent);
					border-color: var(--vscode-editorWarning-foreground);
				}

				.health-banner--error {
					background: color-mix(in srgb, var(--vscode-editorError-foreground) 10%, transparent);
					border-color: var(--vscode-editorError-foreground);
				}

				.health-icon {
					font-size: 20px;
					line-height: 1;
					margin-top: 2px;
				}

				.health-content h3 {
					margin: 0 0 4px 0;
					font-size: 16px;
					font-weight: 600;
				}

				.health-content p {
					margin: 0;
					font-size: 14px;
					opacity: 0.8;
				}

				/* Version Information */
				.version-info h3 {
					margin: 0 0 12px 0;
					font-size: 14px;
					font-weight: 600;
					text-transform: uppercase;
					opacity: 0.7;
				}

				.version-grid {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
					gap: 12px;
					margin-bottom: 12px;
				}

				.version-item {
					display: flex;
					flex-direction: column;
					gap: 4px;
					padding: 12px;
					background: var(--vscode-textBlockQuote-background);
					border-radius: 6px;
				}

				.version-label {
					font-size: 12px;
					opacity: 0.7;
				}

				.version-value {
					font-size: 14px;
					font-weight: 600;
					font-family: var(--vscode-editor-font-family);
				}

				.changelog-link {
					display: inline-flex;
					align-items: center;
					gap: 6px;
					font-size: 14px;
					color: var(--vscode-textLink-foreground);
					text-decoration: none;
					padding: 6px 12px;
					border-radius: 4px;
					transition: background 0.2s;
				}

				.changelog-link:hover {
					background: var(--vscode-list-hoverBackground);
					text-decoration: underline;
				}

				/* Dependency Status */
				.dependency-status h3 {
					margin: 0 0 12px 0;
					font-size: 14px;
					font-weight: 600;
					text-transform: uppercase;
					opacity: 0.7;
				}

				.dependency-list {
					display: flex;
					flex-direction: column;
					gap: 8px;
				}

				.dependency-item {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 12px;
					background: var(--vscode-textBlockQuote-background);
					border-radius: 6px;
					border: 1px solid transparent;
				}

				.dependency-item--missing {
					border-color: var(--vscode-editorError-foreground);
				}

				.dependency-info {
					display: flex;
					align-items: center;
					gap: 12px;
					flex: 1;
				}

				.dependency-icon {
					font-size: 16px;
					line-height: 1;
				}

				.dependency-details {
					display: flex;
					flex-direction: column;
					gap: 2px;
				}

				.dependency-name {
					display: flex;
					align-items: center;
					gap: 8px;
					font-size: 14px;
					font-weight: 500;
				}

				.dependency-badge {
					font-size: 10px;
					padding: 2px 6px;
					background: color-mix(in srgb, var(--vscode-editorWarning-foreground) 20%, transparent);
					border-radius: 3px;
					text-transform: uppercase;
					font-weight: 600;
				}

				.dependency-version,
				.dependency-status-text {
					font-size: 12px;
					opacity: 0.7;
					font-family: var(--vscode-editor-font-family);
				}

				.install-button {
					padding: 6px 16px;
					font-size: 12px;
					border: 1px solid var(--vscode-button-border);
					background: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
					border-radius: 4px;
					cursor: pointer;
					transition: background 0.2s;
				}

				.install-button:hover {
					background: var(--vscode-button-hoverBackground);
				}

				/* Diagnostics */
				.diagnostics-section h3 {
					margin: 0 0 8px 0;
					font-size: 14px;
					font-weight: 600;
					text-transform: uppercase;
					opacity: 0.7;
				}

				.diagnostics-description {
					margin: 0 0 12px 0;
					font-size: 12px;
					opacity: 0.6;
				}

				.diagnostic-list {
					display: flex;
					flex-direction: column;
					gap: 12px;
				}

				.diagnostic-item {
					padding: 12px;
					border-radius: 6px;
					border: 1px solid;
				}

				.diagnostic-item--error {
					background: color-mix(in srgb, var(--vscode-editorError-background) 20%, transparent);
					border-color: var(--vscode-editorError-foreground);
				}

				.diagnostic-item--warning {
					background: color-mix(in srgb, var(--vscode-editorWarning-background) 20%, transparent);
					border-color: var(--vscode-editorWarning-foreground);
				}

				.diagnostic-header {
					display: flex;
					align-items: flex-start;
					gap: 12px;
				}

				.diagnostic-icon {
					font-size: 16px;
					line-height: 1;
					margin-top: 2px;
				}

				.diagnostic-info {
					flex: 1;
					display: flex;
					flex-direction: column;
					gap: 4px;
				}

				.diagnostic-message {
					font-size: 14px;
					font-weight: 500;
					line-height: 1.4;
				}

				.diagnostic-meta {
					display: flex;
					align-items: center;
					gap: 6px;
					font-size: 12px;
					opacity: 0.7;
				}

				.diagnostic-source {
					font-family: var(--vscode-editor-font-family);
				}

				.diagnostic-separator {
					opacity: 0.5;
				}

				.diagnostic-time {
					font-style: italic;
				}

				.diagnostic-action {
					margin-top: 8px;
					padding: 8px 12px;
					background: var(--vscode-textBlockQuote-background);
					border-radius: 4px;
					font-size: 13px;
					line-height: 1.5;
				}

				.diagnostic-action strong {
					font-weight: 600;
					opacity: 0.8;
				}

				/* Quick Tips */
				.status-tips {
					padding: 16px;
					background: var(--vscode-textBlockQuote-background);
					border-radius: 6px;
					border: 1px solid var(--vscode-panel-border);
				}

				.status-tips h4 {
					margin: 0 0 12px 0;
					font-size: 14px;
					font-weight: 600;
				}

				.status-tips ul {
					margin: 0;
					padding-left: 20px;
					display: flex;
					flex-direction: column;
					gap: 8px;
				}

				.status-tips li {
					font-size: 13px;
					line-height: 1.5;
					opacity: 0.8;
				}
			`}</style>
		</div>
	);
}
