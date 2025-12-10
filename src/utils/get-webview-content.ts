import { Uri, type Webview } from "vscode";

export const getWebviewContent = (
	webview: Webview,
	extensionUri: Uri,
	page: string
): string => {
	const scriptUri = webview.asWebviewUri(
		Uri.joinPath(extensionUri, "dist", "webview", "app", "index.js")
	);
	const styleUri = webview.asWebviewUri(
		Uri.joinPath(extensionUri, "dist", "webview", "app", "assets", "index.css")
	);

	const nonce = getNonce();

	return `<!DOCTYPE html>
        <html lang="en" style="height: 100%;">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: https:; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} data:; script-src 'nonce-${nonce}';">
            <link href="${styleUri}" rel="stylesheet" />
            <title>GatomIA</title>
        </head>
        <body style="height: 100%; margin: 0;">
            <div id="root" data-page="${page}" style="height: 100%;"></div>
            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
};

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
