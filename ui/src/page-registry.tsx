import { lazy, Suspense, type ComponentType } from "react";
import { ErrorBoundary as WelcomeErrorBoundary } from "./features/welcome/welcome-screen";

// Lazy-loaded page components for code-splitting
const CreateSpecView = lazy(() =>
	import("./features/create-spec-view").then((m) => ({
		default: m.CreateSpecView,
	}))
);
const CreateSteeringView = lazy(() =>
	import("./features/create-steering-view").then((m) => ({
		default: m.CreateSteeringView,
	}))
);
const InteractiveView = lazy(() =>
	import("./features/interactive-view").then((m) => ({
		default: m.InteractiveView,
	}))
);
const SimpleView = lazy(() =>
	import("./features/simple-view").then((m) => ({ default: m.SimpleView }))
);
const HooksView = lazy(() =>
	import("./features/hooks-view").then((m) => ({ default: m.HooksView }))
);
const DependenciesView = lazy(() =>
	import("./features/dependencies-view").then((m) => ({
		default: m.DependenciesView,
	}))
);
const PreviewApp = lazy(() =>
	import("./features/preview/preview-app").then((m) => ({
		default: m.PreviewApp,
	}))
);
const WelcomeScreen = lazy(() =>
	import("./features/welcome/welcome-screen").then((m) => ({
		default: m.WelcomeScreen,
	}))
);

export type SupportedPage =
	| "simple"
	| "interactive"
	| "create-spec"
	| "create-steering"
	| "hooks"
	| "dependencies"
	| "document-preview"
	| "welcome-screen";

function LoadingFallback() {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				height: "100%",
				color: "var(--vscode-foreground)",
			}}
		>
			Loading...
		</div>
	);
}

function withSuspense(Component: ComponentType) {
	return (
		<Suspense fallback={<LoadingFallback />}>
			<Component />
		</Suspense>
	);
}

const pageRenderers = {
	simple: () => withSuspense(SimpleView),
	interactive: () => withSuspense(InteractiveView),
	"create-spec": () => withSuspense(CreateSpecView),
	"create-steering": () => withSuspense(CreateSteeringView),
	hooks: () => withSuspense(HooksView),
	dependencies: () => withSuspense(DependenciesView),
	"document-preview": () => withSuspense(PreviewApp),
	"welcome-screen": () => (
		<Suspense fallback={<LoadingFallback />}>
			<WelcomeErrorBoundary>
				<WelcomeScreen />
			</WelcomeErrorBoundary>
		</Suspense>
	),
} satisfies Record<SupportedPage, () => JSX.Element>;

export const getPageRenderer = (pageName: string) => {
	if (pageName in pageRenderers) {
		return pageRenderers[pageName as SupportedPage];
	}

	return;
};
