import type { AcpProviderDescriptor } from "../types";
import { probeDevinCli } from "./devin-cli-probe";
import { probeGeminiCli } from "./gemini-cli-probe";

export const DEVIN_PROVIDER_ID = "devin";
export const GEMINI_PROVIDER_ID = "gemini";

export const devinDescriptor: AcpProviderDescriptor = {
	id: DEVIN_PROVIDER_ID,
	displayName: "Devin CLI",
	preferredHosts: ["windsurf"],
	spawnCommand: "devin",
	spawnArgs: ["acp"],
	envAuthVars: ["WINDSURF_API_KEY"],
	installUrl: "https://cli.devin.ai/docs/installation",
	authCommand: "devin auth login",
	probe: probeDevinCli,
};

export const geminiDescriptor: AcpProviderDescriptor = {
	id: GEMINI_PROVIDER_ID,
	displayName: "Gemini CLI",
	preferredHosts: ["antigravity"],
	spawnCommand: "gemini",
	spawnArgs: ["--acp"],
	envAuthVars: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
	installUrl: "https://github.com/google-gemini/gemini-cli#installation",
	authCommand: "gemini auth login",
	probe: probeGeminiCli,
};

export const BUILT_IN_PROVIDERS: readonly AcpProviderDescriptor[] = [
	devinDescriptor,
	geminiDescriptor,
] as const;
