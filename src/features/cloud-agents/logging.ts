/**
 * Cloud Agents Output Channel Logging
 *
 * Provides a dedicated VS Code output channel for cloud agent logs.
 * Shared across all providers and services.
 *
 * @see specs/016-multi-provider-agents/plan.md
 */

import { window, type OutputChannel } from "vscode";

// ============================================================================
// Constants
// ============================================================================

const CLOUD_AGENTS_CHANNEL_NAME = "GatomIA - Cloud Agents";

// ============================================================================
// Logger
// ============================================================================

let outputChannel: OutputChannel | undefined;
let disposed = false;

/**
 * Get or create the Cloud Agents output channel.
 */
export function getCloudAgentsOutputChannel(): OutputChannel {
	if (disposed) {
		return outputChannel as unknown as OutputChannel;
	}
	if (!outputChannel) {
		outputChannel = window.createOutputChannel(CLOUD_AGENTS_CHANNEL_NAME);
	}
	return outputChannel;
}

/**
 * Log an info message to the Cloud Agents output channel.
 */
export function logInfo(message: string): void {
	const channel = getCloudAgentsOutputChannel();
	channel.appendLine(`[INFO] ${new Date().toISOString()} ${message}`);
}

/**
 * Log a warning message to the Cloud Agents output channel.
 */
export function logWarn(message: string): void {
	const channel = getCloudAgentsOutputChannel();
	channel.appendLine(`[WARN] ${new Date().toISOString()} ${message}`);
}

/**
 * Log an error message to the Cloud Agents output channel.
 */
export function logError(message: string, error?: unknown): void {
	const channel = getCloudAgentsOutputChannel();
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
 * Log a debug message to the Cloud Agents output channel.
 */
export function logDebug(message: string): void {
	const channel = getCloudAgentsOutputChannel();
	channel.appendLine(`[DEBUG] ${new Date().toISOString()} ${message}`);
}

/**
 * Dispose the Cloud Agents output channel.
 */
export function disposeCloudAgentsOutputChannel(): void {
	outputChannel?.dispose();
	outputChannel = undefined;
	disposed = true;
}
