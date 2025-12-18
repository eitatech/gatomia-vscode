import { CreateSpecView } from "./features/create-spec-view";
import { CreateSteeringView } from "./features/create-steering-view";
import { InteractiveView } from "./features/interactive-view";
import { SimpleView } from "./features/simple-view";
import { HooksView } from "./features/hooks-view";
import { DependenciesView } from "./features/dependencies-view";
import { PreviewApp } from "./features/preview/preview-app";
import {
	WelcomeScreen,
	ErrorBoundary as WelcomeErrorBoundary,
} from "./features/welcome/welcome-screen";

export type SupportedPage =
	| "simple"
	| "interactive"
	| "create-spec"
	| "create-steering"
	| "hooks"
	| "dependencies"
	| "document-preview"
	| "welcome-screen";

const pageRenderers = {
	simple: () => <SimpleView />,
	interactive: () => <InteractiveView />,
	"create-spec": () => <CreateSpecView />,
	"create-steering": () => <CreateSteeringView />,
	hooks: () => <HooksView />,
	dependencies: () => <DependenciesView />,
	"document-preview": () => <PreviewApp />,
	"welcome-screen": () => (
		<WelcomeErrorBoundary>
			<WelcomeScreen />
		</WelcomeErrorBoundary>
	),
} satisfies Record<SupportedPage, () => JSX.Element>;

export const getPageRenderer = (pageName: string) => {
	if (pageName in pageRenderers) {
		return pageRenderers[pageName as SupportedPage];
	}

	return;
};
