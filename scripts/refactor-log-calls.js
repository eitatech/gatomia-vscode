/*
 * Script to refactor logVersionChange calls from positional parameters to options object
 * Run with: node scripts/refactor-log-calls.js
 * This is a one-time migration script for feature 012-spec-version-tracking
 */

const fs = require("fs");
const path = require("path");

const filePath = path.join(
	__dirname,
	"../src/features/documents/version-tracking/document-version-service.ts"
);

console.log("Reading file:", filePath);
let content = fs.readFileSync(filePath, "utf8");

// Count calls before
const callsBefore = (content.match(/this\.logVersionChange\(/g) || []).length;
console.log(`Found ${callsBefore} logVersionChange calls`);

// Simple regex to find and replace calls
// Pattern: this.logVersionChange(level, event, path, newVer, author, prevVer?, msg?)
const callRegex =
	/this\.logVersionChange\(\s*"([^"]+)",\s*"([^"]+)",\s*([^,\n]+),\s*"([^"]+)",\s*([^,\n]+),\s*([^,\n]+),\s*([^)]*)\);/g;

let replacements = 0;
content = content.replace(
	callRegex,
	// biome-ignore lint/nursery/useMaxParams: regex callback requires all capture groups
	(
		match,
		level,
		event,
		documentPath,
		newVersion,
		author,
		previousVersion,
		message
	) => {
		replacements += 1;
		let options = `{\n\t\t\t\tlevel: "${level}",\n\t\t\t\tevent: "${event}",\n\t\t\t\tdocumentPath: ${documentPath.trim()},\n\t\t\t\tnewVersion: "${newVersion}",\n\t\t\t\tauthor: ${author.trim()}`;

		const prevVer = previousVersion.trim();
		if (prevVer && prevVer !== "undefined") {
			options += `,\n\t\t\t\tpreviousVersion: ${prevVer}`;
		}

		const msg = message.trim();
		if (msg && msg !== "undefined" && msg !== "") {
			options += `,\n\t\t\t\tmessage: ${msg}`;
		}

		options += "\n\t\t\t}";

		return `this.logVersionChange(${options});`;
	}
);

console.log(`Replaced ${replacements} calls`);

// Write back
fs.writeFileSync(filePath, content, "utf8");

// Verify
const callsAfter = (content.match(/this\.logVersionChange\(/g) || []).length;
console.log(`Calls after: ${callsAfter}`);
console.log("Refactoring complete!");
