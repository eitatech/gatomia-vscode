# Document Versioning and Ownership

## Overview

This document describes the automatic versioning and ownership system for specification documents (spec.md, plan.md, tasks.md).

## Version Format

Versions follow the format `{major}.{minor}`:

- **Initial version**: 1.0
- **Minor increments**: 1.0 → 1.1 → 1.2 → ... → 1.9
- **Major increments**: When minor reaches 9, next version becomes {major+1}.0
  - Example: 1.9 → 2.0 → 2.1 → ... → 2.9 → 3.0

## Owner Information

Owner is automatically obtained from Git configuration:

- **Primary source**: `git config user.name` and `git config user.email`
- **Format**: "Name <email>" or "Name" if email is not configured
- **Fallback**: "Unknown" if Git is not configured

## How It Works

### 1. Automatic Processing on Creation

When a new spec, plan, or tasks document is created in the `specs/` directory:

1. A FileSystemWatcher detects the new file
2. The document is automatically processed to:
   - Replace `[AUTHOR]` placeholders with actual Git user info
   - Set initial version to "1.0"
   - Add/update frontmatter with version and owner

### 2. Templates

All templates now include version and owner in frontmatter:

```yaml
---
version: "1.0"
owner: "[AUTHOR]"
---
```

The `[AUTHOR]` placeholder is automatically replaced with actual user information.

### 3. Manual Commands

Three commands are available for manual control:

#### Process New Document

**Command**: `GatomIA: Process New Document`  
**Command ID**: `gatomia.processNewDocument`

Processes a newly created document from template:

- Replaces `[AUTHOR]` placeholders
- Sets version to "1.0"
- Updates frontmatter

#### Update Document Version

**Command**: `GatomIA: Update Document Version`  
**Command ID**: `gatomia.updateDocumentVersion`

Increments the version of an existing document:

- Reads current version from frontmatter
- Increments according to version rules (minor: 0-9, then major++)
- Updates frontmatter with new version
- Preserves owner information

#### Show Document Metadata

**Command**: `GatomIA: Show Document Metadata`  
**Command ID**: `gatomia.showDocumentMetadata`

Displays current version and owner information for a document.

## Usage Examples

### Creating a New Spec

When using `/speckit.specify`:

1. The script creates the spec from template
2. Document is automatically processed
3. Frontmatter is updated with:
   - `version: "1.0"`
   - `owner: "Your Name <your.email@example.com>"`

### Updating an Existing Document

When making significant changes to a document:

1. Open the document in VS Code
2. Run command: `GatomIA: Update Document Version`
3. Version is automatically incremented (e.g., 1.5 → 1.6)

### Checking Document Information

To see current version and owner:

1. Open the document in VS Code
2. Run command: `GatomIA: Show Document Metadata`
3. Information is displayed in a notification

## Technical Implementation

### Key Services

#### `git-user-info.ts`

Utilities for retrieving Git user information:

- `getGitUserInfo()`: Returns `{ name, email }` from git config
- `formatGitUser()`: Formats as "Name <email>"

#### `document-version-service.ts`

Manages document versioning:

- `getCurrentVersion()`: Reads version from frontmatter
- `getNextVersion()`: Calculates next version
- `incrementVersion()`: Applies version increment rules
- `updateFrontmatter()`: Updates markdown frontmatter

#### `document-template-processor.ts`

Processes document templates:

- `processNewDocument()`: Handles newly created documents
- `processDocumentUpdate()`: Handles version updates
- `getDocumentMetadata()`: Retrieves version and owner

### Integration Points

1. **extension.ts**: Registers commands and file watcher
2. **Templates**: Include version/owner frontmatter
3. **FileSystemWatcher**: Auto-processes new docs at `specs/**/spec.md`, `specs/**/plan.md`, `specs/**/tasks.md`
4. **Review Flow**: Reads owner from frontmatter instead of hardcoding "unknown"

## Future Enhancements

Potential improvements for future iterations:

- Visual indicators in tree views showing version
- Version history tracking
- Automatic version bump on significant edits
- Conflict resolution for concurrent edits
- Integration with Git commits (bump version on commit)
