import { vscode } from "@/bridge/vscode";
import { useCallback, useEffect, useState } from "react";
import type {
	DependencyStatus,
	InstallationStep,
	DependenciesExtensionMessage,
	DependenciesWebviewMessage,
} from "./types";

export const DependenciesView = () => {
	const [dependencies, setDependencies] = useState<DependencyStatus[]>([]);
	const [steps, setSteps] = useState<InstallationStep[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [checkingName, setCheckingName] = useState<string | undefined>();
	const [error, setError] = useState<string | undefined>();
	const [actionMessage, setActionMessage] = useState<string | undefined>();

	const sendMessage = useCallback((message: DependenciesWebviewMessage) => {
		vscode.postMessage(message);
	}, []);

	// Handle incoming messages from extension
	useEffect(() => {
		type StatusMessage = Extract<
			DependenciesExtensionMessage,
			{ type: "dependencies/status" }
		>;
		type UpdatedMessage = Extract<
			DependenciesExtensionMessage,
			{ type: "dependencies/updated" }
		>;
		type CheckingMessage = Extract<
			DependenciesExtensionMessage,
			{ type: "dependencies/checking" }
		>;
		type ErrorMessage = Extract<
			DependenciesExtensionMessage,
			{ type: "dependencies/error" }
		>;
		type ActionMessage = Extract<
			DependenciesExtensionMessage,
			{ type: "dependencies/action-result" }
		>;

		const handleStatusMessage = (message: StatusMessage) => {
			setDependencies(message.payload.dependencies);
			setSteps(message.payload.steps);
			setIsLoading(false);
			setCheckingName(undefined);
			setError(undefined);
		};

		const handleUpdatedMessage = (message: UpdatedMessage) => {
			const updated = message.payload;
			setDependencies((prev) =>
				prev.map((dep) => (dep.name === updated.name ? updated : dep))
			);
			setCheckingName(undefined);
		};

		const handleCheckingMessage = (message: CheckingMessage) => {
			setCheckingName(message.payload.name);
			if (!message.payload.name) {
				setIsLoading(true);
			}
		};

		const handleErrorMessage = (message: ErrorMessage) => {
			setError(message.payload.message);
			setIsLoading(false);
			setCheckingName(undefined);
		};

		const handleActionResult = (message: ActionMessage) => {
			if (message.payload.success && message.payload.message) {
				setActionMessage(message.payload.message);
				setTimeout(() => setActionMessage(undefined), 3000);
			}
		};

		const handleMessage = (
			event: MessageEvent<DependenciesExtensionMessage>
		) => {
			const payload = event.data;
			if (!payload || typeof payload !== "object") {
				return;
			}

			switch (payload.type) {
				case "dependencies/status":
					handleStatusMessage(payload);
					return;
				case "dependencies/updated":
					handleUpdatedMessage(payload);
					return;
				case "dependencies/checking":
					handleCheckingMessage(payload);
					return;
				case "dependencies/error":
					handleErrorMessage(payload);
					return;
				case "dependencies/action-result":
					handleActionResult(payload);
					return;
				default:
					return;
			}
		};

		window.addEventListener("message", handleMessage);
		return () => {
			window.removeEventListener("message", handleMessage);
		};
	}, []);

	// Request initial check on mount
	useEffect(() => {
		sendMessage({ type: "dependencies/ready" });
	}, [sendMessage]);

	const handleRefreshAll = useCallback(() => {
		sendMessage({ type: "dependencies/check" });
	}, [sendMessage]);

	const handleRefreshOne = useCallback(
		(name: string) => {
			sendMessage({ type: "dependencies/check-one", payload: { name } });
		},
		[sendMessage]
	);

	const handleCopy = useCallback(
		(command: string) => {
			sendMessage({ type: "dependencies/copy", payload: { command } });
		},
		[sendMessage]
	);

	const handlePaste = useCallback(
		(command: string) => {
			sendMessage({ type: "dependencies/paste", payload: { command } });
		},
		[sendMessage]
	);

	const handleExecute = useCallback(
		(command: string) => {
			sendMessage({ type: "dependencies/execute", payload: { command } });
		},
		[sendMessage]
	);

	const allInstalled = dependencies.every((dep) => dep.installed);

	return (
		<div className="flex h-full w-full flex-col gap-6 px-4 py-4">
			<header className="flex flex-col gap-1">
				<h1 className="font-semibold text-[color:var(--vscode-foreground)] text-xl">
					Install Dependencies
				</h1>
				<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm">
					Check and install required dependencies for SpecKit and OpenSpec
					workflows.
				</p>
			</header>

			{error && (
				<div
					className="rounded border border-[color:var(--vscode-inputValidation-errorBorder)] bg-[color:var(--vscode-inputValidation-errorBackground)] px-3 py-2 text-[color:var(--vscode-inputValidation-errorForeground)] text-sm"
					role="alert"
				>
					{error}
				</div>
			)}

			{actionMessage && (
				<output className="block rounded border border-[color:var(--vscode-inputValidation-infoBorder)] bg-[color:var(--vscode-inputValidation-infoBackground)] px-3 py-2 text-[color:var(--vscode-inputValidation-infoForeground)] text-sm">
					{actionMessage}
				</output>
			)}

			{/* Dependencies Status Section */}
			<section className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h2 className="font-medium text-[color:var(--vscode-foreground)] text-base">
						Status
					</h2>
					<button
						className="flex items-center gap-1.5 rounded border border-transparent bg-[color:var(--vscode-button-secondaryBackground)] px-2.5 py-1 text-[color:var(--vscode-button-secondaryForeground)] text-xs transition-colors hover:bg-[color:var(--vscode-button-secondaryHoverBackground)] disabled:opacity-50"
						disabled={isLoading}
						onClick={handleRefreshAll}
						type="button"
					>
						<i
							className={`codicon codicon-refresh ${isLoading ? "animate-spin" : ""}`}
						/>
						Refresh All
					</button>
				</div>

				{isLoading && dependencies.length === 0 ? (
					<div className="flex items-center gap-2 rounded border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_90%,#000000_10%)] px-4 py-3">
						<i className="codicon codicon-loading animate-spin text-[color:var(--vscode-descriptionForeground)]" />
						<span className="text-[color:var(--vscode-descriptionForeground)] text-sm">
							Checking dependencies...
						</span>
					</div>
				) : (
					<div className="flex flex-col gap-2 rounded border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_90%,#000000_10%)] p-3">
						{dependencies.map((dep) => (
							<DependencyRow
								checkingName={checkingName}
								dependency={dep}
								key={dep.name}
								onRefresh={handleRefreshOne}
							/>
						))}
					</div>
				)}

				{!isLoading && allInstalled && (
					<div className="flex items-center gap-2 rounded border border-[color:var(--vscode-terminal-ansiGreen)] bg-[color:color-mix(in_srgb,var(--vscode-terminal-ansiGreen)_10%,transparent)] px-3 py-2">
						<i className="codicon codicon-pass-filled text-[color:var(--vscode-terminal-ansiGreen)]" />
						<span className="text-[color:var(--vscode-foreground)] text-sm">
							All dependencies are installed!
						</span>
					</div>
				)}
			</section>

			{/* Installation Steps Section */}
			<section className="flex flex-col gap-3">
				<h2 className="font-medium text-[color:var(--vscode-foreground)] text-base">
					Installation Steps
				</h2>
				<div className="flex flex-col gap-4">
					{steps.map((step, index) => (
						<InstallationStepCard
							index={index + 1}
							key={step.id}
							onCopy={handleCopy}
							onExecute={handleExecute}
							onPaste={handlePaste}
							step={step}
						/>
					))}
				</div>
			</section>
		</div>
	);
};

interface DependencyRowProps {
	dependency: DependencyStatus;
	checkingName?: string;
	onRefresh: (name: string) => void;
}

const DependencyRow = ({
	dependency,
	checkingName,
	onRefresh,
}: DependencyRowProps) => {
	const isChecking = checkingName === dependency.name;

	const StatusIcon = () => {
		if (isChecking) {
			return (
				<i className="codicon codicon-loading animate-spin text-[color:var(--vscode-descriptionForeground)]" />
			);
		}
		if (dependency.installed) {
			return (
				<i className="codicon codicon-pass-filled text-[color:var(--vscode-terminal-ansiGreen)]" />
			);
		}
		return (
			<i className="codicon codicon-error text-[color:var(--vscode-errorForeground)]" />
		);
	};

	return (
		<div className="flex items-center justify-between gap-3 py-1">
			<div className="flex items-center gap-2">
				<StatusIcon />
				<span className="font-medium text-[color:var(--vscode-foreground)] text-sm">
					{dependency.name}
				</span>
			</div>
			<div className="flex items-center gap-2">
				{dependency.installed ? (
					<span className="text-[color:var(--vscode-descriptionForeground)] text-xs">
						v{dependency.version}
					</span>
				) : (
					<span className="text-[color:var(--vscode-errorForeground)] text-xs">
						{dependency.error || "Not installed"}
					</span>
				)}
				<button
					className="flex items-center justify-center rounded p-1 text-[color:var(--vscode-descriptionForeground)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] hover:text-[color:var(--vscode-foreground)] disabled:opacity-50"
					disabled={isChecking}
					onClick={() => onRefresh(dependency.name)}
					title="Refresh"
					type="button"
				>
					<i
						className={`codicon codicon-refresh ${isChecking ? "animate-spin" : ""}`}
					/>
				</button>
			</div>
		</div>
	);
};

interface InstallationStepCardProps {
	step: InstallationStep;
	index: number;
	onCopy: (command: string) => void;
	onPaste: (command: string) => void;
	onExecute: (command: string) => void;
}

const InstallationStepCard = ({
	step,
	index,
	onCopy,
	onPaste,
	onExecute,
}: InstallationStepCardProps) => {
	return (
		<div className="flex flex-col gap-2 rounded border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_90%,#000000_10%)] p-3">
			<div className="flex items-start gap-2">
				<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--vscode-button-background)] font-medium text-[color:var(--vscode-button-foreground)] text-xs">
					{index}
				</span>
				<div className="flex flex-col gap-0.5">
					<h3 className="font-medium text-[color:var(--vscode-foreground)] text-sm">
						{step.title}
					</h3>
					<p className="text-[color:var(--vscode-descriptionForeground)] text-xs">
						{step.description}
					</p>
				</div>
			</div>

			{/* Command block - clean, just the command */}
			<div className="mt-1 overflow-x-auto rounded border border-[color:color-mix(in_srgb,var(--vscode-foreground)_20%,transparent)] bg-[color:var(--vscode-textCodeBlock-background)] px-3 py-2 font-mono text-sm">
				<code className="text-[color:var(--vscode-foreground)]">
					{step.command}
				</code>
			</div>

			{/* Action buttons - outside the code block */}
			<div className="flex items-center gap-2">
				<button
					className="flex items-center gap-1.5 rounded border border-transparent bg-[color:var(--vscode-button-secondaryBackground)] px-2 py-1 text-[color:var(--vscode-button-secondaryForeground)] text-xs transition-colors hover:bg-[color:var(--vscode-button-secondaryHoverBackground)]"
					onClick={() => onCopy(step.command)}
					title="Copy to clipboard"
					type="button"
				>
					<i className="codicon codicon-copy" />
					Copy
				</button>
				<button
					className="flex items-center gap-1.5 rounded border border-transparent bg-[color:var(--vscode-button-secondaryBackground)] px-2 py-1 text-[color:var(--vscode-button-secondaryForeground)] text-xs transition-colors hover:bg-[color:var(--vscode-button-secondaryHoverBackground)]"
					onClick={() => onPaste(step.command)}
					title="Paste to terminal"
					type="button"
				>
					<i className="codicon codicon-terminal" />
					Paste
				</button>
				<button
					className="flex items-center gap-1.5 rounded border border-transparent bg-[color:var(--vscode-button-background)] px-2 py-1 text-[color:var(--vscode-button-foreground)] text-xs transition-colors hover:bg-[color:var(--vscode-button-hoverBackground)]"
					onClick={() => onExecute(step.command)}
					title="Execute in terminal"
					type="button"
				>
					<i className="codicon codicon-play" />
					Run
				</button>
			</div>
		</div>
	);
};

export default DependenciesView;
