interface SpecCommandArg {
	specName?: unknown;
	id?: unknown;
}

export function resolveSpecIdFromCommandArg(arg: unknown): string | null {
	if (typeof arg === "string") {
		return arg;
	}

	if (!arg || typeof arg !== "object") {
		return null;
	}

	const record = arg as SpecCommandArg;

	const specName = record.specName;
	if (typeof specName === "string" && specName.length > 0) {
		return specName;
	}

	const id = record.id;
	if (typeof id === "string" && id.length > 0) {
		return id;
	}

	return null;
}
