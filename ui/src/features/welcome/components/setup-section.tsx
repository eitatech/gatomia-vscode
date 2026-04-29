/**
 * Setup Section Component
 * First-time setup guidance and dependency installation
 *
 * IDE-aware rendering driven by `computeRequirementProfile`:
 * - Windsurf: Devin CLI required; Copilot CLI optional;
 *   Copilot Chat + Gemini hidden (Copilot Chat not compatible).
 * - Antigravity: Gemini CLI required; Copilot CLI optional;
 *   Copilot Chat + Devin hidden (Copilot Chat not compatible).
 * - VS Code & others: Copilot Chat/CLI required; Devin/Gemini hidden.
 */

import type {
	DependencyStatus,
	IdeHost,
	InstallableDependency,
	SetupSectionProps,
	SystemPrerequisiteKey,
	SystemPrerequisiteStatus,
} from "../types";
import { computeRequirementProfile, type DepKey } from "../requirements";

const GATOMIA_COPILOT_CONFIG_COMMAND =
	"gatomia config set --llm-provider copilot --main-model gpt-4";
const GATOMIA_CLI_DOCS_URL =
	"https://github.com/eitatech/gatomia-cli#configuration";

export const SetupSection = ({
	dependencies,
	ideHost,
	isInstallingAll = false,
	onInstallDependency,
	onInstallMissing,
	onInstallPrerequisite,
	onRefreshDependencies,
	onNavigateNext,
	isRefreshing = false,
}: SetupSectionProps) => {
	const profile = computeRequirementProfile(ideHost, dependencies);
	const visibleDeps = [...profile.required, ...profile.optional];
	const optionalSet = new Set(profile.optional);
	const speckitReady = dependencies.speckit.installed;
	const openspecReady = dependencies.openspec.installed;
	const gatomiaCliReady = dependencies.gatomiaCli.installed;
	const allRequirementsMet = profile.missing.length === 0;

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
				{getSetupDescription(ideHost)}
			</p>

			{/* System Prerequisites (Node.js, Python, uv) */}
			<PrerequisitesGrid
				onInstallPrerequisite={onInstallPrerequisite}
				prerequisites={dependencies.prerequisites}
			/>

			{/* Dependency Cards Grid */}
			<DependenciesGrid
				dependencies={dependencies}
				gatomiaCliReady={gatomiaCliReady}
				ideHost={ideHost}
				onInstallDependency={onInstallDependency}
				optionalSet={optionalSet}
				visibleDeps={visibleDeps}
			/>

			{/* Setup Guidance */}
			<div className="welcome-subsection welcome-subsection-divider">
				<h3 className="welcome-section-title">What You Need</h3>
				<ul
					style={{
						listStyle: "none",
						padding: 0,
						display: "flex",
						flexDirection: "column",
						gap: "12px",
					}}
				>
					{getRequirementItems(profile, dependencies).map((item) => (
						<RequirementItem
							description={item.description}
							key={item.id}
							met={item.met}
							optional={item.optional}
							title={item.title}
						/>
					))}
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

			{/* Primary action: Install Missing or Get Started */}
			<div
				className="welcome-subsection-divider"
				style={{
					display: "flex",
					justifyContent: "center",
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
					<InstallMissingControls
						isInstallingAll={isInstallingAll}
						isRefreshing={isRefreshing}
						missing={profile.missing}
						onInstallMissing={onInstallMissing}
						onRefreshDependencies={onRefreshDependencies}
					/>
				)}
			</div>
		</div>
	);
};

const getSetupDescription = (ideHost: IdeHost): string => {
	if (ideHost === "windsurf") {
		return "GatomIA routes chat prompts to Devin CLI on Windsurf. Install Devin CLI, at least one specification system (SpecKit or OpenSpec), and GatomIA CLI. GitHub Copilot Chat/CLI are optional.";
	}
	if (ideHost === "antigravity") {
		return "GatomIA routes chat prompts to Gemini CLI on Antigravity. Install Gemini CLI, at least one specification system (SpecKit or OpenSpec), and GatomIA CLI. GitHub Copilot Chat/CLI are optional.";
	}
	return "GatomIA requires GitHub Copilot Chat, Copilot CLI, and at least one specification system (SpecKit or OpenSpec). Install GatomIA CLI after those prerequisites are ready.";
};

interface RequirementItemData {
	id: string;
	title: string;
	description: string;
	met: boolean;
	optional: boolean;
}

const REQUIREMENT_META: Record<DepKey, { title: string; description: string }> =
	{
		"copilot-chat": {
			title: "GitHub Copilot Chat",
			description: "GitHub Copilot Chat extension for AI assistance",
		},
		"copilot-cli": {
			title: "GitHub Copilot CLI",
			description: "Required for Copilot provider integration",
		},
		"devin-cli": {
			title: "Devin CLI",
			description: "Chat provider for Windsurf (ACP)",
		},
		"gemini-cli": {
			title: "Gemini CLI",
			description: "Chat provider for Antigravity (ACP)",
		},
		speckit: {
			title: "SpecKit CLI",
			description: "GitHub's specification framework",
		},
		openspec: {
			title: "OpenSpec CLI",
			description: "Open specification standard",
		},
		"gatomia-cli": {
			title: "GatomIA CLI",
			description: "Install after prerequisites are ready",
		},
	};

const isDepInstalled = (dep: DepKey, deps: DependencyStatus): boolean => {
	switch (dep) {
		case "copilot-chat":
			return deps.copilotChat.installed;
		case "copilot-cli":
			return deps.copilotCli.installed;
		case "speckit":
			return deps.speckit.installed;
		case "openspec":
			return deps.openspec.installed;
		case "gatomia-cli":
			return deps.gatomiaCli.installed;
		case "devin-cli":
			return deps.devinCli?.installed ?? false;
		case "gemini-cli":
			return deps.geminiCli?.installed ?? false;
		default: {
			const _exhaustive: never = dep;
			return _exhaustive;
		}
	}
};

const getRequirementItems = (
	profile: ReturnType<typeof computeRequirementProfile>,
	deps: DependencyStatus
): RequirementItemData[] => {
	const items: RequirementItemData[] = [];
	const speckitReady = deps.speckit.installed;
	const openspecReady = deps.openspec.installed;

	for (const dep of profile.required) {
		if (dep === "speckit" || dep === "openspec") {
			continue;
		}
		const meta = REQUIREMENT_META[dep];
		items.push({
			id: dep,
			title: meta.title,
			description: meta.description,
			met: isDepInstalled(dep, deps),
			optional: false,
		});
	}

	// Collapse speckit/openspec into a single "SpecKit or OpenSpec" requirement
	items.push({
		id: "spec-system",
		title: "SpecKit or OpenSpec",
		description: "At least one spec system",
		met: speckitReady || openspecReady,
		optional: false,
	});

	for (const dep of profile.optional) {
		const meta = REQUIREMENT_META[dep];
		items.push({
			id: `optional-${dep}`,
			title: meta.title,
			description: meta.description,
			met: isDepInstalled(dep, deps),
			optional: true,
		});
	}

	// Re-order so gatomia-cli is last for readability
	items.sort((a, b) => {
		if (a.id === "gatomia-cli") {
			return 1;
		}
		if (b.id === "gatomia-cli") {
			return -1;
		}
		return 0;
	});

	return items;
};

interface InstallMissingControlsProps {
	missing: InstallableDependency[];
	isInstallingAll: boolean;
	isRefreshing: boolean;
	onInstallMissing: (deps: InstallableDependency[]) => void;
	onRefreshDependencies: () => void;
}

const InstallMissingControls = ({
	missing,
	isInstallingAll,
	isRefreshing,
	onInstallMissing,
	onRefreshDependencies,
}: InstallMissingControlsProps) => {
	const label = getInstallMissingLabel(missing.length, isInstallingAll);
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: "12px",
			}}
		>
			<button
				aria-label={label}
				className="welcome-button welcome-button-primary"
				disabled={isInstallingAll || missing.length === 0}
				onClick={() => onInstallMissing(missing)}
				style={{ padding: "12px 32px", fontSize: "14px" }}
				type="button"
			>
				{label}
			</button>
			<button
				className="welcome-button welcome-button-secondary"
				disabled={isRefreshing || isInstallingAll}
				onClick={onRefreshDependencies}
				type="button"
			>
				{isRefreshing ? "Checking..." : "Check Again"}
			</button>
		</div>
	);
};

const getInstallMissingLabel = (
	count: number,
	isInstallingAll: boolean
): string => {
	if (isInstallingAll) {
		return "Installing…";
	}
	if (count === 1) {
		return "Install Missing Dependency";
	}
	return `Install Missing Dependencies (${count})`;
};
/**
 * System Prerequisites Grid
 *
 * Shows installation status of the three system-level prerequisites
 * (Node.js, Python, uv) that underpin every tool install. When a prereq
 * is missing, the card surfaces an "Install" button that triggers the
 * shared install terminal.
 *
 * The grid renders unconditionally — even when the extension hasn't yet
 * populated `dependencies.prerequisites` (e.g. old fixtures) — so users
 * always know that Node/Python/uv are required.
 */
interface PrerequisitesGridProps {
	prerequisites:
		| Record<SystemPrerequisiteKey, SystemPrerequisiteStatus>
		| undefined;
	onInstallPrerequisite: (prerequisite: SystemPrerequisiteKey) => void;
}

const PREREQUISITE_META: Record<
	SystemPrerequisiteKey,
	{ icon: string; title: string; description: string }
> = {
	node: {
		icon: "codicon-symbol-event",
		title: "Node.js",
		description:
			"Required by Copilot CLI, OpenSpec, Gemini CLI, and other npm-based tools.",
	},
	python: {
		icon: "codicon-symbol-method",
		title: "Python 3.11+",
		description:
			"Required by uv to install SpecKit and GatomIA CLI via `uv tool install`.",
	},
	uv: {
		icon: "codicon-package",
		title: "uv package manager",
		description:
			"Ultra-fast Python package installer used to install SpecKit and GatomIA CLI.",
	},
};

const UNKNOWN_PREREQ_STATUS: SystemPrerequisiteStatus = {
	installed: false,
	version: null,
};

const PrerequisitesGrid = ({
	prerequisites,
	onInstallPrerequisite,
}: PrerequisitesGridProps) => {
	const keys: SystemPrerequisiteKey[] = ["node", "python", "uv"];
	return (
		<div className="welcome-subsection">
			<h3 className="welcome-section-title">System Prerequisites</h3>
			<p
				className="welcome-section-description"
				style={{ marginBottom: "12px" }}
			>
				These tools are required before installing the dependencies below.
			</p>
			<div className="welcome-card-grid">
				{keys.map((key) => (
					<PrerequisiteCard
						key={key}
						onInstallPrerequisite={onInstallPrerequisite}
						prereqKey={key}
						status={prerequisites?.[key] ?? UNKNOWN_PREREQ_STATUS}
					/>
				))}
			</div>
		</div>
	);
};

interface PrerequisiteCardProps {
	prereqKey: SystemPrerequisiteKey;
	status: SystemPrerequisiteStatus;
	onInstallPrerequisite: (prerequisite: SystemPrerequisiteKey) => void;
}

const PrerequisiteCard = ({
	prereqKey,
	status,
	onInstallPrerequisite,
}: PrerequisiteCardProps) => {
	const meta = PREREQUISITE_META[prereqKey];
	return (
		<div className="welcome-card">
			<div className="welcome-card-header">
				<i
					aria-hidden="true"
					className={`codicon ${meta.icon} welcome-card-icon`}
				/>
				<h3 className="welcome-card-title">{meta.title}</h3>
				<StatusBadge installed={status.installed} version={status.version} />
			</div>
			<p className="welcome-card-description">{meta.description}</p>
			{!status.installed && (
				<button
					className="welcome-button welcome-button-primary"
					onClick={() => onInstallPrerequisite(prereqKey)}
					style={{ marginTop: "12px" }}
					type="button"
				>
					Install {meta.title}
				</button>
			)}
			{status.installed && status.version && (
				<div
					className="welcome-card-description"
					style={{ marginTop: "8px", fontSize: "11px" }}
				>
					Version: {status.version}
				</div>
			)}
		</div>
	);
};

/**
 * Dependencies Grid Component
 *
 * Data-driven: renders one card per visible dependency (computed by the
 * caller via `computeRequirementProfile`). Cards in the `optionalSet` are
 * tagged with an "(Optional)" badge in their title.
 */
interface DependenciesGridProps {
	dependencies: DependencyStatus;
	visibleDeps: DepKey[];
	optionalSet: Set<DepKey>;
	ideHost: IdeHost;
	gatomiaCliReady: boolean;
	onInstallDependency: (dep: InstallableDependency) => void;
}

const DependenciesGrid = ({
	dependencies,
	visibleDeps,
	optionalSet,
	ideHost,
	gatomiaCliReady,
	onInstallDependency,
}: DependenciesGridProps) => (
	<div className="welcome-card-grid">
		{visibleDeps.map((dep) => (
			<DependencyCard
				dep={dep}
				dependencies={dependencies}
				gatomiaCliReady={gatomiaCliReady}
				ideHost={ideHost}
				key={dep}
				onInstallDependency={onInstallDependency}
				optional={optionalSet.has(dep)}
			/>
		))}
	</div>
);

interface DependencyCardProps {
	dep: DepKey;
	dependencies: DependencyStatus;
	optional: boolean;
	ideHost: IdeHost;
	gatomiaCliReady: boolean;
	onInstallDependency: (dep: InstallableDependency) => void;
}

interface CardMeta {
	icon: string;
	title: string;
	description: string;
	installLabel: string;
}

const CARD_META: Record<DepKey, CardMeta> = {
	"copilot-chat": {
		icon: "codicon-comment-discussion",
		title: "GitHub Copilot Chat",
		description: "AI-powered specification assistance and interactive prompts.",
		installLabel: "Install from Marketplace",
	},
	"copilot-cli": {
		icon: "codicon-terminal-bash",
		title: "GitHub Copilot CLI",
		description:
			"Required to configure GatomIA CLI with Copilot as the default provider.",
		installLabel: "Copy Install Command",
	},
	"devin-cli": {
		icon: "codicon-rocket",
		title: "Devin CLI",
		description:
			"Chat provider used by GatomIA when running inside Windsurf (ACP).",
		installLabel: "Copy Install Command",
	},
	"gemini-cli": {
		icon: "codicon-sparkle",
		title: "Gemini CLI",
		description:
			"Chat provider used by GatomIA when running inside Antigravity (ACP).",
		installLabel: "Copy Install Command",
	},
	speckit: {
		icon: "codicon-file-text",
		title: "SpecKit CLI",
		description:
			"GitHub's specification framework for structured spec management.",
		installLabel: "Copy Install Command",
	},
	openspec: {
		icon: "codicon-tools",
		title: "OpenSpec CLI",
		description: "Open specification standard for flexible spec workflows.",
		installLabel: "Copy Install Command",
	},
	"gatomia-cli": {
		icon: "codicon-package",
		title: "GatomIA CLI",
		description: "Install with uv after all prerequisites are ready.",
		installLabel: "Copy Install Command",
	},
};

const getDepVersion = (
	dep: DepKey,
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

const installDepLabel = (dep: DepKey): InstallableDependency => dep;

const DependencyCard = ({
	dep,
	dependencies,
	optional,
	ideHost,
	gatomiaCliReady,
	onInstallDependency,
}: DependencyCardProps) => {
	const meta = CARD_META[dep];
	const installed = isDepInstalled(dep, dependencies);
	const version = getDepVersion(dep, dependencies);
	const active =
		dep === "copilot-chat" ? dependencies.copilotChat.active : undefined;

	return (
		<div className="welcome-card">
			<div className="welcome-card-header">
				<i
					aria-hidden="true"
					className={`codicon ${meta.icon} welcome-card-icon`}
				/>
				<h3 className="welcome-card-title">
					{meta.title}
					{optional && (
						<span
							style={{
								marginLeft: "8px",
								fontSize: "11px",
								fontWeight: 400,
								color: "var(--vscode-descriptionForeground)",
							}}
						>
							(Optional)
						</span>
					)}
				</h3>
				<StatusBadge active={active} installed={installed} version={version} />
			</div>
			<p className="welcome-card-description">{meta.description}</p>
			{!installed && (
				<button
					className="welcome-button welcome-button-primary"
					onClick={() => onInstallDependency(installDepLabel(dep))}
					style={{ marginTop: "12px" }}
					type="button"
				>
					{meta.installLabel}
				</button>
			)}
			{installed && version && (
				<div
					className="welcome-card-description"
					style={{ marginTop: "8px", fontSize: "11px" }}
				>
					Version: {version}
				</div>
			)}
			{dep === "copilot-chat" && installed && active === false && (
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
			{dep === "gatomia-cli" && gatomiaCliReady && (
				<GatomiaCliConfigHint ideHost={ideHost} />
			)}
		</div>
	);
};

const GatomiaCliConfigHint = ({ ideHost }: { ideHost: IdeHost }) => {
	const isAcpHost = ideHost === "windsurf" || ideHost === "antigravity";
	if (isAcpHost) {
		return (
			<div style={{ marginTop: "8px" }}>
				<div
					className="welcome-card-description"
					style={{ fontSize: "11px", marginBottom: "6px" }}
				>
					Configure the GatomIA CLI provider via{" "}
					<a href={GATOMIA_CLI_DOCS_URL} rel="noreferrer" target="_blank">
						project docs
					</a>
					.
				</div>
			</div>
		);
	}
	return (
		<div style={{ marginTop: "8px" }}>
			<div
				className="welcome-card-description"
				style={{ fontSize: "11px", marginBottom: "6px" }}
			>
				Configure Copilot provider:
			</div>
			<code
				style={{
					display: "block",
					fontSize: "11px",
					padding: "8px",
					borderRadius: "4px",
					backgroundColor: "var(--vscode-textCodeBlock-background)",
				}}
			>
				{GATOMIA_COPILOT_CONFIG_COMMAND}
			</code>
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
			className="welcome-subsection welcome-subsection-divider"
			style={{
				backgroundColor:
					"color-mix(in srgb, var(--vscode-editor-inactiveSelectionBackground) 30%, transparent)",
				padding: "20px",
				borderRadius: "6px",
			}}
		>
			<h3 className="welcome-section-title">
				Next Steps: Initialize Your Spec System
			</h3>

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
