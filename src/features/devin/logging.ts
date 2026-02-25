/**
 * Devin Output Channel Logging
 *
 * Provides a dedicated VS Code output channel for Devin integration logs.
 * Supports verbose mode controlled by user settings.
 *
 * @see specs/001-devin-integration/quickstart.md:L113-L123
 */

import { window, type OutputChannel } from "vscode";
import { OUTPUT_CHANNEL_NAME } from "./config";

// ============================================================================
// Logger
// ============================================================================

let outputChannel: OutputChannel | undefined;

/**
 * Get or create the Devin output channel.
 */
export function getDevinOutputChannel(): OutputChannel {
	if (!outputChannel) {
		outputChannel = window.createOutputChannel(OUTPUT_CHANNEL_NAME);
	}
	return outputChannel;
}

/**
 * Log an info message to the Devin output channel.
 */
export function logInfo(message: string): void {
	const channel = getDevinOutputChannel();
	channel.appendLine(`[INFO] ${new Date().toISOString()} ${message}`);
}

/**
 * Log a warning message to the Devin output channel.
 */
export function logWarn(message: string): void {
	const channel = getDevinOutputChannel();
	channel.appendLine(`[WARN] ${new Date().toISOString()} ${message}`);
}

/**
 * Log an error message to the Devin output channel.
 */
export function logError(message: string, error?: unknown): void {
	const channel = getDevinOutputChannel();
	let errorDetail = "";
	if (error instanceof Error) {
		errorDetail = `: ${error.message}`;
	} else if (error) {
		errorDetail = `: ${String(error)}`;
	}
	channel.appendLine(
		`[ERROR] ${new Date().toISOString()} ${message}${errorDetail}`
	);
}

/**
 * Log a debug message (only shown when verbose logging is enabled).
 */
export function logDebug(message: string): void {
	const channel = getDevinOutputChannel();
	channel.appendLine(`[DEBUG] ${new Date().toISOString()} ${message}`);
}

/**
 * Dispose the output channel.
 */
export function disposeDevinOutputChannel(): void {
	outputChannel?.dispose();
	outputChannel = undefined;
}
