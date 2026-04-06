import type { ImageAttachmentMeta } from "../types";

interface ImageAttachmentStripProps {
	attachments: ImageAttachmentMeta[];
	onRemove: (id: string) => void;
}

export const ImageAttachmentStrip = ({
	attachments,
	onRemove,
}: ImageAttachmentStripProps) => {
	if (attachments.length === 0) {
		return null;
	}

	return (
		<ul
			aria-label="Image attachments"
			className="m-0 flex list-none flex-wrap gap-2 p-0"
		>
			{attachments.map((attachment) => (
				<li
					className="relative flex flex-col items-center gap-1 rounded border border-[color:color-mix(in_srgb,var(--vscode-foreground)_20%,transparent)] p-1"
					key={attachment.id}
				>
					<img
						alt={attachment.name}
						className="h-16 max-h-16 w-16 max-w-[4rem] rounded object-cover"
						height={64}
						src={attachment.dataUrl}
						width={64}
					/>
					<span className="max-w-[4rem] truncate text-[color:var(--vscode-descriptionForeground)] text-xs">
						{attachment.name}
					</span>
					<button
						aria-label={`Remove ${attachment.name}`}
						className="-right-1 -top-1 absolute flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--vscode-button-background)] text-[color:var(--vscode-button-foreground)] text-xs hover:bg-[color:var(--vscode-button-hoverBackground)]"
						onClick={() => onRemove(attachment.id)}
						type="button"
					>
						x
					</button>
				</li>
			))}
		</ul>
	);
};
