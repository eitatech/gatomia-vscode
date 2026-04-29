/**
 * StatusSection Component
 * Displays extension health, versions, diagnostics, and dependency status
 * Based on specs/006-welcome-screen FR-013 tasks T098-T111
 */

import type {
	DependencyStatus,
	IdeHost,
	InstallableDependency,
	SystemDiagnostic,
	SystemPrerequisiteKey,
	SystemPrerequisiteStatus,
} from "../types";
import { computeRequirementProfile } from "../requirements";
import { vscode } from "../../../bridge/vscode";
import { formatRelativeTime } from "../../../utils/relative-time";

interface StatusSectionProps {
	extensionVersion: string;
	vscodeVersion: string;
	ideHost: IdeHost;
	dependencies: DependencyStatus;
	diagnostics: SystemDiagnostic[];
	onInstallDependency: (dependencyId: InstallableDependency) => void;
	onInstallPrerequisite?: (prerequisite: SystemPrerequisiteKey) => void;
	onOpenExternal?: (url: string) => void;
}

/**
 * Prerequisite item for rendering in the Status view.
 */
interface PrerequisiteItem {
	id: SystemPrerequisiteKey;
	name: string;
	installed: boolean;
	version: string | null;
}

const PREREQ_NAMES: Record<SystemPrerequisiteKey, string> = {
	node: "Node.js",
	python: "Python 3.11+",
	uv: "uv (package manager)",
};

const PREREQ_KEYS: readonly SystemPrerequisiteKey[] = ["node", "python", "uv"];

const UNKNOWN_PREREQ_STATUS: SystemPrerequisiteStatus = {
	installed: false,
	version: null,
};

/**
 * Build prereq items from the populated `dependencies.prerequisites`
 * field (when present). When absent, each entry falls back to
 * "not installed" so the UI still surfaces the requirement.
 */
function getPrerequisiteItems(
	dependencies: DependencyStatus
): PrerequisiteItem[] {
	const prereqs = dependencies.prerequisites;
	return PREREQ_KEYS.map((key) => {
		const status = prereqs?.[key] ?? UNKNOWN_PREREQ_STATUS;
		return {
			id: key,
			name: PREREQ_NAMES[key],
			installed: status.installed,
			version: status.version,
		};
	});
}

/**
 * Dependency item for rendering
 */
interface DependencyItem {
	id: InstallableDependency;
	name: string;
	installed: boolean;
	version: string | null;
	required: boolean;
}

/**
 * Get health status based on dependencies and diagnostics using the
 * IDE-aware requirement profile as source of truth.
 *
 * Missing system prerequisites (Node.js, Python, uv) are also treated
 * as errors because they block every tool install — but only when the
 * prerequisites block has been populated by the extension, so older
 * fixtures that omit the field do not incorrectly flip to "error".
 */
function getHealthStatus(
	ideHost: IdeHost,
	dependencies: DependencyStatus,
	diagnostics: SystemDiagnostic[]
) {
	const hasErrors = diagnostics.some((d) => d.severity === "error");
	const profile = computeRequirementProfile(ideHost, dependencies);
	const hasMissingDeps = profile.missing.length > 0;
	const prereqs = dependencies.prerequisites;
	const hasMissingPrereqs =
		prereqs !== undefined && PREREQ_KEYS.some((key) => !prereqs[key].installed);

	if (hasErrors || hasMissingDeps || hasMissingPrereqs) {
		return "error";
	}

	const hasWarnings = diagnostics.some((d) => d.severity === "warning");
	if (hasWarnings) {
		return "warning";
	}

	return "healthy";
}

const DEP_NAMES: Record<InstallableDependency, string> = {
	"copilot-chat": "GitHub Copilot Chat",
	"copilot-cli": "GitHub Copilot CLI",
	"devin-cli": "Devin CLI",
	"gemini-cli": "Gemini CLI",
	speckit: "SpecKit CLI",
	openspec: "OpenSpec CLI",
	"gatomia-cli": "GatomIA CLI",
};

const getDepInstalled = (
	dep: InstallableDependency,
	dependencies: DependencyStatus
): boolean => {
	switch (dep) {
		case "copilot-chat":
			return dependencies.copilotChat.installed;
		case "copilot-cli":
			return dependencies.copilotCli.installed;
		case "speckit":
			return dependencies.speckit.installed;
		case "openspec":
			return dependencies.openspec.installed;
		case "gatomia-cli":
			return dependencies.gatomiaCli.installed;
		case "devin-cli":
			return dependencies.devinCli?.installed ?? false;
		case "gemini-cli":
			return dependencies.geminiCli?.installed ?? false;
		default: {
			const _exhaustive: never = dep;
			return _exhaustive;
		}
	}
};

const getDepVersion = (
	dep: InstallableDependency,
	dependencies: DependencyStatus
): string | null => {
	switch (dep) {
		case "copilot-chat":
			return dependencies.copilotChat.version;
		case "copilot-cli":
			return dependencies.copilotCli.version;
		case "speckit":
			return dependencies.speckit.version;
		case "openspec":
			return dependencies.openspec.version;
		case "gatomia-cli":
			return dependencies.gatomiaCli.version;
		case "devin-cli":
			return dependencies.devinCli?.version ?? null;
		case "gemini-cli":
			return dependencies.geminiCli?.version ?? null;
		default: {
			const _exhaustive: never = dep;
			return _exhaustive;
		}
	}
};

/**
 * Convert DependencyStatus object to array for rendering, filtered and
 * categorised by the IDE-aware requirement profile. Hidden deps are not
 * listed; optional deps keep `required: false`.
 */
function getDependencyItems(
	ideHost: IdeHost,
	dependencies: DependencyStatus
): DependencyItem[] {
	const profile = computeRequirementProfile(ideHost, dependencies);
	const requiredSet = new Set(profile.required);
	const optionalSet = new Set(profile.optional);
	const visible = [...profile.required, ...profile.optional];

	return visible.map((dep) => ({
		id: dep,
		name: DEP_NAMES[dep],
		installed: getDepInstalled(dep, dependencies),
		version: getDepVersion(dep, dependencies),
		// "Required" in the UI sense: a missing required dep drives the
		// red banner. Spec systems appear as required cards but the actual
		// requirement is "at least one" — reflect that by marking them as
		// required only when neither is installed.
		required:
			requiredSet.has(dep) &&
			!(
				(dep === "speckit" || dep === "openspec") &&
				(dependencies.speckit.installed || dependencies.openspec.installed)
			) &&
			!optionalSet.has(dep),
	}));
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
	ideHost,
	dependencies,
	diagnostics,
	onInstallDependency,
	onInstallPrerequisite,
	onOpenExternal,
}: StatusSectionProps) {
	const healthStatus = getHealthStatus(ideHost, dependencies, diagnostics);
	const allHealthy = healthStatus === "healthy";
	const dependencyItems = getDependencyItems(ideHost, dependencies);
	const prerequisiteItems = getPrerequisiteItems(dependencies);

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
							"https://github.com/gatomia/gatomia-vscode/blob/main/CHANGELOG.md";
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

			{/* System Prerequisites */}
			<div className="dependency-status">
				<h3>System Prerequisites</h3>
				<div className="dependency-list">
					{prerequisiteItems.map((prereq) => (
						<div
							className={`dependency-item ${prereq.installed ? "" : "dependency-item--missing"}`}
							key={prereq.id}
						>
							<div className="dependency-info">
								<i
									className={`codicon ${prereq.installed ? "codicon-pass-filled" : "codicon-error"} dependency-icon`}
								/>
								<div className="dependency-details">
									<div className="dependency-name">
										{prereq.name}
										<span className="dependency-badge">Required</span>
									</div>
									{prereq.installed && prereq.version && (
										<div className="dependency-version">v{prereq.version}</div>
									)}
									{!prereq.installed && (
										<div className="dependency-status-text">Not installed</div>
									)}
								</div>
							</div>
							{!prereq.installed && onInstallPrerequisite && (
								<button
									className="install-button"
									onClick={() => onInstallPrerequisite(prereq.id)}
									type="button"
								>
									Install
								</button>
							)}
						</div>
					))}
				</div>
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
