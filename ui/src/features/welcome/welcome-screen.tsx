/**
 * Welcome Screen App
 * Main entry point for welcome screen webview
 */

import {
	Component,
	type ErrorInfo,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import { useWelcomeStore } from "./stores/welcome-store";
import { SetupSection } from "./components/setup-section";
import { FeaturesSection } from "./components/features-section";
import { ConfigSection } from "./components/config-section";
import { LearningSection } from "./components/learning-section";
import { StatusSection } from "./components/status-section";
import { vscode } from "../../bridge/vscode";
import "./welcome.css";

// T125: Error Boundary for graceful error handling
class ErrorBoundary extends Component<
	{ children: ReactNode },
	{ hasError: boolean; error: Error | null }
> {
	constructor(props: { children: ReactNode }) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("[WelcomeScreen] Error boundary caught:", error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div aria-live="assertive" className="welcome-screen" role="alert">
					<div className="welcome-error">
						<h2>
							<i className="codicon codicon-error" /> Something went wrong
						</h2>
						<p>The welcome screen encountered an unexpected error.</p>
						<details style={{ marginTop: "1rem" }}>
							<summary>Error details</summary>
							<pre style={{ marginTop: "0.5rem", fontSize: "0.85em" }}>
								{this.state.error?.message || "Unknown error"}
							</pre>
						</details>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Pending component split to reduce complexity; non-functional UI logic aggregation.
export const WelcomeScreen = () => {
	const {
		state,
		initialize,
		loading,
		error,
		setCurrentView,
		updateConfig,
		setState,
	} = useWelcomeStore();
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [dontShowOnStartup, setDontShowOnStartup] = useState(false);
	const [loadingTimeout, setLoadingTimeout] = useState(false);
	const contentRef = useRef<HTMLElement>(null);
	const initializedRef = useRef(false);

	// T124: Loading timeout indicator
	useEffect(() => {
		const timer = setTimeout(() => {
			if (loading) {
				setLoadingTimeout(true);
			}
		}, 2000);
		return () => clearTimeout(timer);
	}, [loading]);

	useEffect(() => {
		if (initializedRef.current) {
			return;
		}
		initializedRef.current = true;

		console.log("[WelcomeScreen] Component mounted, vscode API:", !!vscode);

		if (!vscode) {
			return;
		}

		console.log("[WelcomeScreen] Initializing store...");
		initialize({
			extensionVersion: "0.25.6", // Will be set from extension
			vscodeVersion: "1.84.0", // Will be set from extension
		});
		console.log("[WelcomeScreen] Store initialized, sending ready message...");

		// Send ready message to extension ONCE
		vscode.postMessage({ type: "welcome/ready" });
		console.log("[WelcomeScreen] Ready message sent");

		// Listen for messages from the extension
		const messageHandler = (event: MessageEvent) => {
			const message = event.data;
			console.log("[WelcomeScreen] Received message:", message.type, message);

			switch (message.type) {
				case "welcome/state": {
					// Full state update from extension
					setState(message);
					// T120: Initialize dontShowOnStartup state (inverted for UI)
					if (typeof message.dontShowOnStartup === "boolean") {
						setDontShowOnStartup(!message.dontShowOnStartup); // Inverted for UI
					}
					break;
				}
				case "welcome/dependency-status":
					// Dependency status update handled in store
					break;
				case "welcome/diagnostic-added":
					if (message.diagnostic) {
						setState((prev) => ({
							...(prev || {}),
							diagnostics: [
								message.diagnostic,
								...((prev?.diagnostics as unknown[]) || []),
							].slice(0, 5),
						}));
					}
					break;
				case "welcome/error":
					console.error(
						`[Welcome] Error from extension: ${message.code} - ${message.message}`
					);
					break;
				default:
					console.warn("[WelcomeScreen] Unhandled message:", message.type);
			}
		};

		window.addEventListener("message", messageHandler);
		return () => window.removeEventListener("message", messageHandler);
	}, [initialize, setState]);

	// Message handlers for SetupSection
	const handleInstallDependency = (
		dependency: "copilot-chat" | "speckit" | "openspec"
	) => {
		if (vscode) {
			vscode.postMessage({
				type: "welcome/install-dependency",
				dependency,
			});
		}
	};

	const handleRefreshDependencies = () => {
		if (vscode) {
			setIsRefreshing(true);
			vscode.postMessage({
				type: "welcome/refresh-dependencies",
			});
			// Reset refreshing state after a short delay
			setTimeout(() => setIsRefreshing(false), 2000);
		}
	};

	const handleNavigateToFeatures = () => {
		setCurrentView("features");
	};

	// Message handler for FeaturesSection
	const handleExecuteCommand = (commandId: string, args?: unknown[]) => {
		if (vscode) {
			vscode.postMessage({
				type: "welcome/execute-command",
				commandId,
				args,
			});
		}
	};

	// Message handlers for ConfigSection
	const handleUpdateConfig = (key: string, value: string) => {
		if (vscode) {
			vscode.postMessage({
				type: "welcome/update-config",
				key,
				value,
			});
		}
	};

	const handleOpenSettings = () => {
		if (vscode) {
			vscode.postMessage({
				type: "welcome/execute-command",
				commandId: "workbench.action.openSettings",
				args: ["@ext:gatomia"],
			});
		}
	};

	// Message handlers for LearningSection
	const handleOpenExternal = (url: string) => {
		if (vscode) {
			vscode.postMessage({
				type: "welcome/open-external",
				url,
			});
		}
	};

	const handleSearchResources = (query: string) => {
		if (vscode) {
			vscode.postMessage({
				type: "welcome/search-resources",
				query,
			});
		}
	};

	// T121: Handler for dontShowOnStartup preference
	const handlePreferenceChange = (checked: boolean) => {
		setDontShowOnStartup(checked);
		if (vscode) {
			vscode.postMessage({
				type: "welcome/update-preference",
				preference: "dontShowOnStartup",
				value: !checked, // Inverted: checked means SHOW, so dontShow = !checked
			});
		}
	};

	// T117: Smooth scroll to section
	const scrollToSection = (view: string) => {
		setCurrentView(
			view as "setup" | "features" | "configuration" | "status" | "learning"
		);
		// T129: Track navigation for telemetry
		if (vscode) {
			vscode.postMessage({
				type: "welcome/navigate-section",
				section: view,
			});
		}
		if (contentRef.current) {
			contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
		}
	};

	// T124: Improved loading UI with spinner and timeout indicator
	if (loading) {
		return (
			<output aria-live="polite" className="welcome-screen">
				<div className="welcome-loading">
					<div aria-hidden="true" className="spinner" />
					<p>Loading welcome screen...</p>
					{loadingTimeout && (
						<p className="loading-slow">
							This is taking longer than expected...
						</p>
					)}
				</div>
			</output>
		);
	}

	if (error) {
		return (
			<div aria-live="assertive" className="welcome-screen" role="alert">
				<div className="welcome-error">
					<strong>Error:</strong> {error.message}
				</div>
			</div>
		);
	}

	const currentView = state?.currentView || "setup";

	return (
		<div className="welcome-screen">
			<header className="welcome-header">
				<div className="header-content">
					<h1>Welcome to GatomIA</h1>
					{state?.extensionVersion && (
						<span className="version-badge">v{state.extensionVersion}</span>
					)}
				</div>
				<p>An Agentic Spec-Driven Development Toolkit</p>
				{/* <div className="header-actions">
					<input
						aria-label="Show welcome screen on startup"
						checked={dontShowOnStartup}
						className={`getting-started-checkbox ${dontShowOnStartup ? "checked" : ""}`}
						id="showOnStartup"
						onChange={(e) => handlePreferenceChange(e.currentTarget.checked)}
						type="checkbox"
					/>
					<label className="checkbox-label" htmlFor="showOnStartup">
						<span>Show on startup</span>
					</label>
				</div> */}
			</header>

			<nav aria-label="Welcome screen sections" className="welcome-nav">
				<button
					aria-current={currentView === "setup" ? "page" : undefined}
					aria-label="Setup section"
					className={currentView === "setup" ? "active" : ""}
					onClick={() => scrollToSection("setup")}
					type="button"
				>
					Setup
				</button>
				<button
					aria-current={currentView === "features" ? "page" : undefined}
					aria-label="Features section"
					className={currentView === "features" ? "active" : ""}
					onClick={() => scrollToSection("features")}
					type="button"
				>
					Features
				</button>
				<button
					aria-current={currentView === "configuration" ? "page" : undefined}
					aria-label="Configuration section"
					className={currentView === "configuration" ? "active" : ""}
					onClick={() => scrollToSection("configuration")}
					type="button"
				>
					Configuration
				</button>
				<button
					aria-current={currentView === "status" ? "page" : undefined}
					aria-label="Status section"
					className={currentView === "status" ? "active" : ""}
					onClick={() => scrollToSection("status")}
					type="button"
				>
					Status
				</button>
				<button
					aria-current={currentView === "learning" ? "page" : undefined}
					aria-label="Learning section"
					className={currentView === "learning" ? "active" : ""}
					onClick={() => scrollToSection("learning")}
					type="button"
				>
					Learn
				</button>
			</nav>

			<main
				aria-label="Welcome screen content"
				className="welcome-content"
				ref={contentRef}
			>
				{currentView === "setup" && state && (
					<SetupSection
						dependencies={state.dependencies}
						isRefreshing={isRefreshing}
						onInstallDependency={handleInstallDependency}
						onNavigateNext={handleNavigateToFeatures}
						onRefreshDependencies={handleRefreshDependencies}
					/>
				)}
				{currentView === "features" && state && (
					<FeaturesSection
						featureActions={state.featureActions}
						onExecuteCommand={handleExecuteCommand}
					/>
				)}
				{currentView === "configuration" && state && (
					<ConfigSection
						configuration={state.configuration}
						onOpenSettings={handleOpenSettings}
						onUpdateConfig={handleUpdateConfig}
					/>
				)}
				{currentView === "status" && state && (
					<StatusSection
						dependencies={state.dependencies}
						diagnostics={state.diagnostics || []}
						extensionVersion={state.extensionVersion || "0.25.6"}
						onInstallDependency={handleInstallDependency}
						onOpenExternal={handleOpenExternal}
						vscodeVersion={state.vscodeVersion || "1.0.0"}
					/>
				)}
				{currentView === "learning" && state && (
					<LearningSection
						onOpenExternal={handleOpenExternal}
						onSearch={handleSearchResources}
						resources={state.learningResources}
					/>
				)}
			</main>
		</div>
	);
};

// Export ErrorBoundary for use in page registry
export { ErrorBoundary };
