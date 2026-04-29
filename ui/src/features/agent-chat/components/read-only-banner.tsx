/**
 * ReadOnlyBanner (T065).
 *
 * Renders the "cloud monitor" notice for cloud-backed sessions. Cloud sessions
 * are read-only in v1 (FR-003) — this banner makes that explicit and exposes
 * an "Open in provider" link when an external URL is available.
 */

interface ReadOnlyBannerProps {
	readonly providerId: string;
	readonly providerDisplayName: string;
	readonly externalUrl: string | undefined;
	readonly onOpenExternal: () => void;
}

export function ReadOnlyBanner({
	providerId,
	providerDisplayName,
	externalUrl,
	onOpenExternal,
}: ReadOnlyBannerProps): JSX.Element {
	return (
		<div className="agent-chat-read-only-banner" data-provider-id={providerId}>
			<span className="agent-chat-read-only-banner__label">
				Read-only cloud session
			</span>
			<span className="agent-chat-read-only-banner__provider">
				{providerDisplayName}
			</span>
			{externalUrl !== undefined && (
				<button
					className="agent-chat-read-only-banner__open"
					onClick={onOpenExternal}
					type="button"
				>
					Open in provider
				</button>
			)}
		</div>
	);
}
