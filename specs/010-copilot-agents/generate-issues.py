#!/usr/bin/env python3
"""
Generate GitHub issues from tasks.md using gh CLI
This script:
1. Creates generic, reusable labels
2. Parses tasks.md to extract all tasks
3. Creates GitHub issues with proper metadata
"""

import re
import subprocess
import sys
from typing import Dict, List, Tuple

# Configuration
REPO = "eitatech/gatomia-vscode"
FEATURE_NUMBER = "010"
FEATURE_NAME = "copilot-agents"

# Label colors (GitHub format: RRGGBB)
COLORS = {
    "feature": "0366d6",      # Blue
    "phase": "1d76db",        # Dark blue  
    "priority": "d73a4a",     # Red
    "user_story": "7057ff",   # Purple
    "parallel": "28a745",     # Green
    "type": "fbca04",         # Yellow
}

# Generic labels that can be reused across specs
LABELS = [
    # Feature-specific (will be templated)
    (f"feature:{FEATURE_NUMBER}", COLORS["feature"], f"Feature {FEATURE_NUMBER} - {FEATURE_NAME}"),
    
    # Phase labels (generic, reusable)
    ("phase:setup", COLORS["phase"], "Setup and initialization phase"),
    ("phase:foundational", COLORS["phase"], "Foundational infrastructure phase"),
    ("phase:implementation", COLORS["phase"], "Implementation phase"),
    ("phase:polish", COLORS["phase"], "Polish and refinement phase"),
    
    # Priority labels (generic, reusable)
    ("priority:critical", COLORS["priority"], "Critical priority - blocks other work"),
    ("priority:p1", COLORS["priority"], "High priority - MVP scope"),
    ("priority:p2", COLORS["priority"], "Medium priority"),
    ("priority:p3", COLORS["priority"], "Low priority"),
    
    # User story labels (generic, reusable)
    ("user-story:1", COLORS["user_story"], "User Story 1"),
    ("user-story:2", COLORS["user_story"], "User Story 2"),
    ("user-story:3", COLORS["user_story"], "User Story 3"),
    ("user-story:4", COLORS["user_story"], "User Story 4"),
    ("user-story:5", COLORS["user_story"], "User Story 5"),
    ("user-story:6", COLORS["user_story"], "User Story 6"),
    
    # Special labels (generic, reusable)
    ("parallel", COLORS["parallel"], "Can run in parallel with other tasks"),
    ("type:documentation", COLORS["type"], "Documentation updates"),
    ("type:performance", COLORS["type"], "Performance improvements"),
    ("type:security", COLORS["type"], "Security enhancements"),
    ("type:telemetry", COLORS["type"], "Telemetry and monitoring"),
    ("type:testing", COLORS["type"], "Testing and validation"),
    ("type:memory", COLORS["type"], "Memory optimization"),
    ("type:quality", COLORS["type"], "Code quality improvements"),
    ("type:demo", COLORS["type"], "Demo and showcase"),
    ("mandatory", COLORS["priority"], "Mandatory task - must be completed"),
]


def create_label(name: str, color: str, description: str) -> bool:
    """Create a GitHub label if it doesn't exist"""
    # Check if label exists
    result = subprocess.run(
        ["gh", "label", "list", "-R", REPO],
        capture_output=True,
        text=True
    )
    
    if name in result.stdout:
        print(f"✓ Label already exists: {name}")
        return True
    
    # Create label
    try:
        subprocess.run(
            ["gh", "label", "create", name, "--color", color, "--description", description, "-R", REPO],
            check=True,
            capture_output=True
        )
        print(f"✓ Created label: {name}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to create label {name}: {e.stderr.decode()}")
        return False


def create_labels():
    """Create all labels"""
    print("=" * 80)
    print(f"Creating GitHub labels for feature {FEATURE_NUMBER}...")
    print("=" * 80)
    
    success_count = 0
    for name, color, description in LABELS:
        if create_label(name, color, description):
            success_count += 1
    
    print(f"\n✅ Successfully created/verified {success_count}/{len(LABELS)} labels\n")


def parse_phase_info(content: str) -> Dict[str, str]:
    """Extract phase information from content"""
    phase_map = {
        "Phase 1": "phase:setup",
        "Phase 2": "phase:foundational",
        "Phase 3": "phase:implementation",
        "Phase 4": "phase:implementation",
        "Phase 5": "phase:implementation",
        "Phase 6": "phase:implementation",
        "Phase 7": "phase:implementation",
        "Phase 8": "phase:implementation",
        "Phase 9": "phase:polish",
    }
    
    for phase_name, label in phase_map.items():
        if phase_name in content:
            return {"label": label, "name": phase_name}
    
    return {"label": "phase:implementation", "name": "Unknown Phase"}


def extract_task_metadata(task_line: str, section_content: str) -> Dict:
    """Extract metadata from task line"""
    metadata = {
        "parallel": "[P]" in task_line,
        "user_story": None,
        "priority": None,
    }
    
    # Extract user story
    us_match = re.search(r'\[US(\d+)\]', task_line)
    if us_match:
        metadata["user_story"] = us_match.group(1)
    
    # Determine priority from section
    if "Priority: P1" in section_content or "🎯 MVP" in section_content:
        metadata["priority"] = "p1"
    elif "Priority: P2" in section_content:
        metadata["priority"] = "p2"
    elif "Priority: P3" in section_content:
        metadata["priority"] = "p3"
    elif "CRITICAL" in section_content:
        metadata["priority"] = "critical"
    
    return metadata


def build_labels_list(phase_label: str, metadata: Dict) -> str:
    """Build comma-separated labels list"""
    labels = [f"feature:{FEATURE_NUMBER}", phase_label]
    
    if metadata["parallel"]:
        labels.append("parallel")
    
    if metadata["priority"]:
        labels.append(f"priority:{metadata['priority']}")
    
    if metadata["user_story"]:
        labels.append(f"user-story:{metadata['user_story']}")
    
    return ",".join(labels)


def create_issue(title: str, body: str, labels: str) -> bool:
    """Create a GitHub issue"""
    print(f"Creating: {title}")
    
    try:
        subprocess.run(
            ["gh", "issue", "create", "-R", REPO, "--title", title, "--body", body, "--label", labels],
            check=True,
            capture_output=True,
            text=True
        )
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to create: {title}")
        print(f"  Error: {e.stderr}")
        return False


def parse_tasks_from_file(filepath: str) -> List[Dict]:
    """Parse tasks.md and extract all tasks with metadata"""
    with open(filepath, 'r') as f:
        content = f.read()
    
    tasks = []
    
    # Split by phase sections
    phase_sections = re.split(r'##\s+Phase\s+\d+:', content)
    
    for i, section in enumerate(phase_sections[1:], 1):  # Skip first empty section
        phase_info = parse_phase_info(f"Phase {i}")
        
        # Find all task lines
        task_pattern = r'^-\s+\[\s*\]\s+(T\d+)(.*?)$'
        for match in re.finditer(task_pattern, section, re.MULTILINE):
            task_id = match.group(1)
            task_desc = match.group(2).strip()
            
            # Extract metadata
            metadata = extract_task_metadata(task_desc, section)
            
            # Build title (remove markers like [P], [US1] from title)
            title = re.sub(r'\[P\]\s*|\[US\d+\]\s*', '', task_desc).strip()
            title = f"[{task_id}] {title[:100]}"  # Limit title length
            
            # Build labels
            labels = build_labels_list(phase_info["label"], metadata)
            
            tasks.append({
                "id": task_id,
                "title": title,
                "description": task_desc,
                "phase": phase_info["name"],
                "labels": labels,
                "metadata": metadata,
            })
    
    return tasks


def generate_issue_body(task: Dict) -> str:
    """Generate issue body from task info"""
    body = f"""**Phase**: {task['phase']}
**Feature**: {FEATURE_NUMBER}-{FEATURE_NAME}"""
    
    if task['metadata']['user_story']:
        body += f"\n**User Story**: US{task['metadata']['user_story']}"
    
    if task['metadata']['parallel']:
        body += "\n**Can Run in Parallel**: Yes [P]"
    
    body += f"""

## Description
{task['description']}

## Task
{task['id']} from specs/{FEATURE_NUMBER}-{FEATURE_NAME}/tasks.md

---
*This issue was auto-generated from tasks.md*
"""
    
    return body


def main():
    """Main execution"""
    print("\n" + "=" * 80)
    print(f"GitHub Issue Generator for Feature {FEATURE_NUMBER}")
    print("=" * 80 + "\n")
    
    # Step 1: Create labels
    create_labels()
    
    # Step 2: Parse tasks
    tasks_file = f"specs/{FEATURE_NUMBER}-{FEATURE_NAME}/tasks.md"
    print(f"Parsing tasks from {tasks_file}...")
    
    try:
        tasks = parse_tasks_from_file(tasks_file)
        print(f"✓ Found {len(tasks)} tasks\n")
    except FileNotFoundError:
        print(f"✗ Error: {tasks_file} not found")
        print("  Make sure you're running from the repository root")
        sys.exit(1)
    
    # Step 3: Create issues
    print("=" * 80)
    print("Creating GitHub issues...")
    print("=" * 80 + "\n")
    
    success_count = 0
    for task in tasks:
        body = generate_issue_body(task)
        if create_issue(task["title"], body, task["labels"]):
            success_count += 1
    
    # Summary
    print("\n" + "=" * 80)
    print(f"✅ Successfully created {success_count}/{len(tasks)} issues")
    print("=" * 80)
    print(f"\nView all issues at:")
    print(f"https://github.com/{REPO}/issues?q=is%3Aissue+label%3Afeature%3A{FEATURE_NUMBER}")
    print()


if __name__ == "__main__":
    main()
