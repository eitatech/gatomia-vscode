# Devin Integration Quickstart

**Feature**: Devin Remote Implementation Integration  
**Setup Time**: ~5 minutes

## Prerequisites

1. **VS Code** 1.84.0 or later
2. **Devin Account** with API access
3. **Git repository** hosted on GitHub or GitLab

## Configuration

### Step 1: Get Devin API Credentials

#### For v3 API (Recommended)

1. Go to [Devin Settings](https://app.devin.ai/settings) → Service Users
2. Create a new Service User with permissions:
   - `ManageOrgSessions` - Create and manage sessions
   - `ViewOrgSessions` - View session details
3. Copy the API key (starts with `cog_`)
4. Note your Organization ID from the URL or settings

#### For Legacy v1/v2 API

1. Go to [Devin Settings](https://app.devin.ai/settings) → API Keys
2. Generate a new Personal API Key (starts with `apk_user_`) or Service API Key (starts with `apk_`)

### Step 2: Configure Extension

1. Open VS Code Command Palette (`Cmd/Ctrl + Shift + P`)
2. Run: `GatomIA: Configure Devin Credentials`
3. Enter your API key
4. For v3: Enter your Organization ID when prompted

The extension automatically detects your API version from the key prefix.

## Usage

### Start a Single Task

1. Open a spec file in VS Code
2. Right-click on a task in the Spec Explorer
3. Select **"Implement with Devin"**
4. Confirm the branch and task details
5. Devin session starts - watch progress in the Devin panel

### Start All Tasks

1. Open a spec file
2. Click the **"Implement All with Devin"** button in the Spec Explorer
3. Or run command: `GatomIA: Implement All Tasks with Devin`
4. All uncompleted tasks are queued for Devin

### Monitor Progress

1. Open the **Devin Progress** panel from the sidebar
2. View real-time status:
   - Session status (initializing, running, completed, failed)
   - Current activity and logs
   - Pull requests created
3. Click **"Open in Devin"** to view full session in browser

### Review Pull Requests

When Devin completes:

1. Notification appears in VS Code
2. Click **"Review PR"** to open the diff
3. Review changes directly in VS Code
4. Approve, request changes, or merge

## Troubleshooting

### "Invalid API Key" Error

- Verify your key starts with `cog_` (v3) or `apk_` (v1/v2)
- For v3: Ensure you've entered the correct Organization ID
- Check that your Service User has required permissions

### Session Stuck in "Initializing"

- Devin may be at capacity - wait a few minutes
- Check [Devin Status](https://status.devin.ai)
- Cancel and retry the session

### "Repository Not Found" Error

- Ensure your repo is hosted on GitHub or GitLab
- Verify the branch exists and is pushed to remote
- Check that Devin has access to your repository

### Progress Not Updating

- Polling occurs every 5-10 seconds (normal)
- Click **"Refresh"** in the Devin panel to force update
- Check your internet connection

## Advanced Configuration

### Custom Polling Interval

Add to VS Code settings (`settings.json`):

```json
{
  "gatomia.devin.pollingInterval": 10,
  "gatomia.devin.maxRetries": 5
}
```

### Verbose Logging

Enable debug logging:

```json
{
  "gatomia.devin.verboseLogging": true
}
```

View logs in Output panel → "GatomIA Devin".

## Best Practices

1. **Clean Working Directory**: Commit or stash changes before starting Devin
2. **Clear Task Descriptions**: Devin works best with detailed acceptance criteria
3. **Monitor Early**: Watch the first few minutes to catch any setup issues
4. **Review Promptly**: Check PRs quickly while context is fresh
5. **Use Branches**: Devin works on feature branches, not main/master

## Next Steps

- Read the [full specification](./spec.md) for detailed requirements
- Review the [data model](./data-model.md) for technical details
- Check [API contracts](./contracts/) for integration patterns
