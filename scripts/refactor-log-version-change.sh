#!/bin/bash
# Temporary script to refactor logVersionChange calls to use options object
# This script is for one-time use and will be deleted after refactoring

FILE="src/features/documents/version-tracking/document-version-service.ts"

# This is a complex refactoring - we'll use node to do it properly
node << 'NODEJS'
const fs = require('fs');
const filePath = 'src/features/documents/version-tracking/document-version-service.ts';

let content = fs.readFileSync(filePath, 'utf8');

// Pattern: this.logVersionChange(arg1, arg2, arg3, arg4, arg5, arg6?, arg7?)
// We need to convert this to: this.logVersionChange({ level: arg1, event: arg2, documentPath: arg3, newVersion: arg4, author: arg5, previousVersion: arg6, message: arg7 })

// This regex matches the method calls (multi-line)
const regex = /this\.logVersionChange\(\s*([^,\n]+),\s*([^,\n]+),\s*([^,\n]+),\s*([^,\n]+),\s*([^,\n]+)(?:,\s*([^,\n]+))?(?:,\s*([^\)]+))?\s*\);/gs;

content = content.replace(regex, (match, level, event, documentPath, newVersion, author, previousVersion = 'undefined', message = 'undefined') => {
	// Clean up the arguments
	level = level.trim();
	event = event.trim();
	documentPath = documentPath.trim();
	newVersion = newVersion.trim();
	author = author.trim();
	previousVersion = previousVersion.trim();
	message = message?.trim() || 'undefined';
	
	// Build the options object
	let result = `this.logVersionChange({\n`;
	result += `\t\t\t\tlevel: ${level},\n`;
	result += `\t\t\t\tevent: ${event},\n`;
	result += `\t\t\t\tdocumentPath: ${documentPath},\n`;
	result += `\t\t\t\tnewVersion: ${newVersion},\n`;
	result += `\t\t\t\tauthor: ${author}`;
	
	if (previousVersion !== 'undefined') {
		result += `,\n\t\t\t\tpreviousVersion: ${previousVersion}`;
	}
	if (message !== 'undefined') {
		result += `,\n\t\t\t\tmessage: ${message}`;
	}
	
	result += `\n\t\t\t});`;
	return result;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Refactored logVersionChange calls');
NODEJS

echo "Refactoring complete"
