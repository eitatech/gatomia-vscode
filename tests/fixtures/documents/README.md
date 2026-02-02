# Test Fixtures for Document Version Tracking

This directory contains test fixtures for the document version tracking feature (012-spec-version-tracking).

## Fixture Files

### Valid Frontmatter
- **spec-valid-frontmatter.md**: Complete spec with valid version and owner fields
- **plan-with-version.md**: Plan document with version 2.3 (demonstrates version progression)
- **tasks-initial.md**: Tasks document at version 1.0 (initial state)

### Edge Cases
- **spec-missing-frontmatter.md**: Document without any YAML frontmatter (tests auto-initialization)
- **spec-malformed-version.md**: Document with version "1.10" (tests normalization to "2.0")
- **spec-with-unicode.md**: Document with Unicode characters in title and content (tests encoding)

## Usage in Tests

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(__dirname, '../fixtures/documents');

// Load fixture
const validSpec = readFileSync(
  join(fixturesDir, 'spec-valid-frontmatter.md'),
  'utf-8'
);

// Use in test
test('should extract version from valid frontmatter', async () => {
  const metadata = await processor.extract(validSpec);
  expect(metadata.version).toBe('1.5');
  expect(metadata.owner).toBe('Italo <182202+italoag@users.noreply.github.com>');
});
```

## Adding New Fixtures

When adding new fixtures:
1. Create descriptive filenames indicating the test scenario
2. Include realistic content (not just minimal examples)
3. Document the fixture purpose in this README
4. Use consistent formatting (YAML frontmatter + Markdown body)
