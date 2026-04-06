import { ImagePlus, Upload } from "lucide-react";

interface SpecToolbarProps {
	onImport: () => void;
	onAttach: () => void;
	isImporting: boolean;
	isAttaching: boolean;
	attachCount: number;
}

const IMAGE_MAX_COUNT = 5;

export const SpecToolbar = ({
	onImport,
	onAttach,
	isImporting,
	isAttaching,
	attachCount,
}: SpecToolbarProps) => (
	<div className="flex items-center gap-2">
		<button
			aria-label="Import from file"
			className="rounded border border-[color:var(--vscode-button-border,transparent)] bg-[color:var(--vscode-button-secondaryBackground,#3c3c3c)] px-2 py-1 text-[color:var(--vscode-button-secondaryForeground)] text-sm transition-colors hover:bg-[color:var(--vscode-button-secondaryHoverBackground)] disabled:opacity-50"
			disabled={isImporting}
			onClick={onImport}
			title="Import from file"
			type="button"
		>
			<Upload aria-hidden="true" className="h-4 w-4" />
		</button>
		<button
			aria-label={
				attachCount >= IMAGE_MAX_COUNT
					? "Maximum 5 images reached"
					: "Attach images"
			}
			className="rounded border border-[color:var(--vscode-button-border,transparent)] bg-[color:var(--vscode-button-secondaryBackground,#3c3c3c)] px-2 py-1 text-[color:var(--vscode-button-secondaryForeground)] text-sm transition-colors hover:bg-[color:var(--vscode-button-secondaryHoverBackground)] disabled:opacity-50"
			disabled={isAttaching || attachCount >= IMAGE_MAX_COUNT}
			onClick={onAttach}
			title={
				attachCount >= IMAGE_MAX_COUNT
					? "Maximum 5 images reached"
					: "Attach images"
			}
			type="button"
		>
			<ImagePlus aria-hidden="true" className="h-4 w-4" />
		</button>
	</div>
);
