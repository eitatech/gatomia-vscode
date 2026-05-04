import { Uri, type Webview } from "vscode";

/**
 * Optional extra attributes serialized onto the `#root` element so pages can
 * read contextual data (e.g. an agent-chat session id) synchronously before
 * their first postMessage round-trip.
 *
 * Keys become `data-<kebab-case-key>` attributes. Values are HTML-escaped.
 */
export interface WebviewDataAttributes {
	readonly [attribute: string]: string | undefined;
}

export const getWebviewContent = (
	webview: Webview,
	extensionUri: Uri,
	page: string,
	extraDataAttributes?: WebviewDataAttributes
): string => {
	const scriptUri = webview.asWebviewUri(
		Uri.joinPath(extensionUri, "dist", "webview", "app", "index.js")
	);
	const styleUri = webview.asWebviewUri(
		Uri.joinPath(extensionUri, "dist", "webview", "app", "assets", "index.css")
	);

	const nonce = getNonce();
	const dataAttrs = serializeDataAttrs(extraDataAttributes ?? {});

	return `<!DOCTYPE html>
        <html lang="en" style="height: 100%;">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta property="csp-nonce" nonce="${nonce}" />
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: https:; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} data:; script-src 'nonce-${nonce}';">
            <link href="${styleUri}" rel="stylesheet" />
            <title>GatomIA</title>
        </head>
        <body style="height: 100%; margin: 0;">
            <div id="root" data-page="${page}"${dataAttrs} style="height: 100%;"></div>
            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
};

function serializeDataAttrs(attrs: WebviewDataAttributes): string {
	const parts: string[] = [];
	for (const [key, value] of Object.entries(attrs)) {
		if (value === undefined) {
			continue;
		}
		parts.push(` data-${key}="${escapeHtml(value)}"`);
	}
	return parts.join("");
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function getNonce() {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const NonceLength = 32;
	for (let i = 0; i < NonceLength; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
