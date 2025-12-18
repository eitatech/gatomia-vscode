/**
 * Setup Section Component
 * First-time setup guidance and dependency installation
 */

import type { DependencyStatus } from "../types";

interface SetupSectionProps {
	dependencies: DependencyStatus;
	onInstallDependency: (
		dependency: "copilot-chat" | "speckit" | "openspec"
	) => void;
	onRefreshDependencies: () => void;
	onNavigateNext: () => void;
	isRefreshing?: boolean;
}

export const SetupSection = ({
	dependencies,
	onInstallDependency,
	onRefreshDependencies,
	onNavigateNext,
	isRefreshing = false,
}: SetupSectionProps) => {
	// Check if all required dependencies are installed
	const copilotReady = dependencies.copilotChat.installed;
	const speckitReady = dependencies.speckit.installed;
	const openspecReady = dependencies.openspec.installed;

	// At least one spec system must be installed
	const specSystemReady = speckitReady || openspecReady;

	// All requirements met
	const allRequirementsMet = copilotReady && specSystemReady;

	return (
		<div className="welcome-section">
			<div className="welcome-section-header">
				<h2 className="welcome-section-title">Setup & Dependencies</h2>
				<button
					aria-label="Refresh dependency status"
					className="welcome-button welcome-button-secondary"
					disabled={isRefreshing}
					onClick={onRefreshDependencies}
					type="button"
				>
					{isRefreshing ? "Checking..." : "↻ Refresh"}
				</button>
			</div>

			<p className="welcome-section-description">
				GatomIA requires GitHub Copilot Chat and at least one specification
				system (SpecKit or OpenSpec) to work properly. Let's verify your setup.
			</p>

			<div
				className="welcome-section"
				style={{
					marginTop: "0px",
					marginBottom: "0px",
					backgroundColor:
						"color-mix(in srgb, var(--vscode-editor-inactiveSelectionBackground) 30%, transparent)",
				}}
			>
				{/* Dependency Cards Grid */}
				<DependenciesGrid
					dependencies={dependencies}
					onInstallDependency={onInstallDependency}
				/>
			</div>

			{/* Setup Guidance */}
			<div
				className="welcome-section"
				style={{
					marginTop: "0px",
					marginBottom: "0px",
					backgroundColor:
						"color-mix(in srgb, var(--vscode-editor-inactiveSelectionBackground) 30%, transparent)",
				}}
			>
				<h3 className="welcome-section-title">What You Need</h3>
				<br />
				<ul
					style={{
						listStyle: "none",
						padding: 0,
						display: "flex",
						flexDirection: "column",
						gap: "12px",
					}}
				>
					<RequirementItem
						description="Required for AI assistance"
						met={copilotReady}
						title="GitHub Copilot Chat"
					/>
					<RequirementItem
						description="At least one spec system"
						met={specSystemReady}
						title="SpecKit or OpenSpec"
					/>
					<RequirementItem
						description="Configure paths in next section"
						met={true}
						optional={true}
						title="Workspace Setup"
					/>
				</ul>
			</div>

			{/* Spec System Initialization Guidance (T029) */}
			<SpecSystemGuidance
				openspecReady={openspecReady}
				speckitReady={speckitReady}
			/>

			{/* Get Started Button */}
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					marginTop: "32px",
					paddingTop: "24px",
				}}
			>
				{allRequirementsMet ? (
					<button
						className="welcome-button welcome-button-primary"
						onClick={onNavigateNext}
						style={{ padding: "12px 32px", fontSize: "14px" }}
						type="button"
					>
						Get Started →
					</button>
				) : (
					<div style={{ textAlign: "center" }}>
						<p
							className="welcome-section-description"
							style={{ marginBottom: "12px" }}
						>
							Install required dependencies to continue
						</p>
						<button
							className="welcome-button welcome-button-secondary"
							disabled={isRefreshing}
							onClick={onRefreshDependencies}
							type="button"
						>
							{isRefreshing ? "Checking..." : "Check Again"}
						</button>
					</div>
				)}
			</div>
		</div>
	);
};
/**
 * Dependencies Grid Component
 */
const DependenciesGrid = ({
	dependencies,
	onInstallDependency,
}: {
	dependencies: DependencyStatus;
	onInstallDependency: (dep: "copilot-chat" | "speckit" | "openspec") => void;
}) => {
	const copilotReady = dependencies.copilotChat.installed;
	const speckitReady = dependencies.speckit.installed;
	const openspecReady = dependencies.openspec.installed;

	return (
		<div className="welcome-card-grid">
			<div className="welcome-card">
				<div className="welcome-card-header">
					<i
						aria-hidden="true"
						className="codicon codicon-comment-discussion welcome-card-icon"
					/>
					<h3 className="welcome-card-title">GitHub Copilot Chat</h3>
					<StatusBadge
						active={dependencies.copilotChat.active}
						installed={copilotReady}
						version={dependencies.copilotChat.version}
					/>
				</div>
				<p className="welcome-card-description">
					Required for AI-powered specification assistance and interactive
					prompts.
				</p>
				{!copilotReady && (
					<button
						className="welcome-button welcome-button-primary"
						onClick={() => onInstallDependency("copilot-chat")}
						style={{ marginTop: "12px" }}
						type="button"
					>
						Install from Marketplace
					</button>
				)}
				{copilotReady && !dependencies.copilotChat.active && (
					<div
						className="status-badge warning"
						style={{
							marginTop: "12px",
							fontSize: "11px",
							display: "flex",
							alignItems: "center",
							gap: "4px",
						}}
					>
						<i className="codicon codicon-warning" /> Installed but not active.
						Please activate the extension.
					</div>
				)}
			</div>

			<div className="welcome-card">
				<div className="welcome-card-header">
					<i
						aria-hidden="true"
						className="codicon codicon-file-text welcome-card-icon"
					/>
					<h3 className="welcome-card-title">SpecKit CLI</h3>
					<StatusBadge
						installed={speckitReady}
						version={dependencies.speckit.version}
					/>
				</div>
				<p className="welcome-card-description">
					GitHub's specification framework for structured spec management.
				</p>
				{!speckitReady && (
					<button
						className="welcome-button welcome-button-primary"
						onClick={() => onInstallDependency("speckit")}
						style={{ marginTop: "12px" }}
						type="button"
					>
						Copy Install Command
					</button>
				)}
				{speckitReady && dependencies.speckit.version && (
					<div
						className="welcome-card-description"
						style={{ marginTop: "8px", fontSize: "11px" }}
					>
						Version: {dependencies.speckit.version}
					</div>
				)}
			</div>

			<div className="welcome-card">
				<div className="welcome-card-header">
					<i
						aria-hidden="true"
						className="codicon codicon-tools welcome-card-icon"
					/>
					<h3 className="welcome-card-title">OpenSpec CLI</h3>
					<StatusBadge
						installed={openspecReady}
						version={dependencies.openspec.version}
					/>
				</div>
				<p className="welcome-card-description">
					Open specification standard for flexible spec workflows.
				</p>
				{!openspecReady && (
					<button
						className="welcome-button welcome-button-primary"
						onClick={() => onInstallDependency("openspec")}
						style={{ marginTop: "12px" }}
						type="button"
					>
						Copy Install Command
					</button>
				)}
				{openspecReady && dependencies.openspec.version && (
					<div
						className="welcome-card-description"
						style={{ marginTop: "8px", fontSize: "11px" }}
					>
						Version: {dependencies.openspec.version}
					</div>
				)}
			</div>
		</div>
	);
};

/**
 * Spec System Guidance Component
 */
const SpecSystemGuidance = ({
	speckitReady,
	openspecReady,
}: {
	speckitReady: boolean;
	openspecReady: boolean;
}) => {
	const specSystemReady = speckitReady || openspecReady;
	if (!specSystemReady) {
		return (
			<div
				style={{
					padding: "16px",
					borderLeft: "3px solid var(--vscode-editorWarning-foreground)",
					backgroundColor: "var(--vscode-editor-background)",
					borderRadius: "4px",
				}}
			>
				<p
					className="welcome-section-description"
					style={{ marginBottom: "12px" }}
				>
					Install at least one spec system (SpecKit or OpenSpec) to get started
					with specification management.
				</p>
			</div>
		);
	}

	return (
		<div
			className="welcome-section"
			style={{
				marginTop: "0px",
				marginBottom: "0px",
				backgroundColor:
					"color-mix(in srgb, var(--vscode-editor-inactiveSelectionBackground) 30%, transparent)",
			}}
		>
			<h3 className="welcome-section-title">
				Next Steps: Initialize Your Spec System
			</h3>
			<br />

			{speckitReady && (
				<div
					style={{
						marginBottom: "20px",
						padding: "16px",
						borderLeft: "3px solid var(--vscode-testing-iconPassed)",
						backgroundColor: "var(--vscode-editor-background)",
						borderRadius: "4px",
					}}
				>
					<h4
						style={{
							fontSize: "14px",
							fontWeight: 600,
							marginBottom: "12px",
							color: "var(--vscode-foreground)",
						}}
					>
						SpecKit Initialized
					</h4>
					<p
						className="welcome-section-description"
						style={{ marginBottom: "12px" }}
					>
						SpecKit is ready! You can now:
					</p>
					<ul
						style={{
							marginLeft: "20px",
							fontSize: "13px",
							color: "var(--vscode-descriptionForeground)",
							lineHeight: "1.8",
						}}
					>
						<li>
							Create your first spec: Open Command Palette (Cmd/Ctrl+Shift+P) →
							"SpecKit: Create New Spec"
						</li>
						<li>
							Organize specs in the <code>specs/</code> directory (default)
						</li>
						<li>
							Use SpecKit templates from <code>.specify/templates/</code>
						</li>
						<li>
							Run <code>specify plan</code> or <code>specify tasks</code> from
							terminal
						</li>
					</ul>
				</div>
			)}

			{openspecReady && (
				<div
					style={{
						marginBottom: "20px",
						padding: "16px",
						borderLeft: "3px solid var(--vscode-testing-iconPassed)",
						backgroundColor: "var(--vscode-editor-background)",
						borderRadius: "4px",
					}}
				>
					<h4
						style={{
							fontSize: "14px",
							fontWeight: 600,
							marginBottom: "12px",
							color: "var(--vscode-foreground)",
						}}
					>
						OpenSpec Initialized
					</h4>
					<p
						className="welcome-section-description"
						style={{ marginBottom: "12px" }}
					>
						OpenSpec is ready! You can now:
					</p>
					<ul
						style={{
							marginLeft: "20px",
							fontSize: "13px",
							color: "var(--vscode-descriptionForeground)",
							lineHeight: "1.8",
						}}
					>
						<li>
							Initialize OpenSpec: Run <code>openspec init</code> in your
							workspace
						</li>
						<li>
							Create specifications using{" "}
							<code>openspec create [spec-name]</code>
						</li>
						<li>
							Validate specs: <code>openspec validate</code>
						</li>
						<li>
							Configure settings in <code>.openspec/</code> directory (default)
						</li>
					</ul>
				</div>
			)}

			<div
				style={{
					marginTop: "16px",
					padding: "12px",
					backgroundColor:
						"color-mix(in srgb, var(--vscode-textBlockQuote-background) 50%, transparent)",
					borderRadius: "4px",
					fontSize: "12px",
					color: "var(--vscode-descriptionForeground)",
				}}
			>
				<strong>Tip:</strong> You can switch between SpecKit and OpenSpec
				anytime in the Configuration section. Both systems can coexist in the
				same workspace.
			</div>
		</div>
	);
};

/**
 * Status Badge Component
 * Shows installed/missing status with version
 */
interface StatusBadgeProps {
	installed: boolean;
	active?: boolean;
	version?: string | null;
}

const StatusBadge = ({ installed, active, version }: StatusBadgeProps) => {
	if (!installed) {
		return <span className="status-badge inactive">Missing</span>;
	}

	if (active === false) {
		return <span className="status-badge warning">Inactive</span>;
	}

	return (
		<span className="status-badge success">
			<i className="codicon codicon-pass-filled" /> Installed
		</span>
	);
};

/**
 * Requirement Item Component
 * Shows individual requirement with checkmark
 */
interface RequirementItemProps {
	title: string;
	description: string;
	met: boolean;
	optional?: boolean;
}

const RequirementItem = ({
	title,
	description,
	met,
	optional = false,
}: RequirementItemProps) => (
	<li
		style={{
			display: "flex",
			gap: "12px",
			alignItems: "flex-start",
			padding: "12px",
			borderRadius: "4px",
			backgroundColor: met
				? "color-mix(in srgb, var(--vscode-testing-iconPassed) 10%, transparent)"
				: "color-mix(in srgb, var(--vscode-editorWarning-foreground) 10%, transparent)",
		}}
	>
		<i
			aria-hidden="true"
			className={`codicon ${
				met ? "codicon-pass-filled" : "codicon-circle-large-outline"
			}`}
			style={{
				fontSize: "16px",
				color: met
					? "var(--vscode-testing-iconPassed)"
					: "var(--vscode-descriptionForeground)",
			}}
		/>
		<div style={{ flex: 1 }}>
			<div
				style={{
					fontWeight: 600,
					fontSize: "13px",
					marginBottom: "4px",
					color: "var(--vscode-foreground)",
				}}
			>
				{title}
				{optional && (
					<span
						style={{
							marginLeft: "8px",
							fontSize: "11px",
							color: "var(--vscode-descriptionForeground)",
						}}
					>
						(optional)
					</span>
				)}
			</div>
			<div
				style={{
					fontSize: "12px",
					color: "var(--vscode-descriptionForeground)",
				}}
			>
				{description}
			</div>
		</div>
	</li>
);
