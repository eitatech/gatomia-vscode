#!/usr/bin/env python3
"""
Generate a CSV file for bulk issue import via GitHub web UI
or a markdown file for manual creation

Since you don't have write permissions via API, this creates
files you can use through the GitHub web interface.
"""

import csv
import re

FEATURE_NUMBER = "010"
FEATURE_NAME = "copilot-agents"

def parse_tasks_from_file(filepath: str):
    """Parse tasks.md and extract all tasks"""
    with open(filepath, 'r') as f:
        content = f.read()
    
    tasks = []
    current_phase = "Unknown"
    
    lines = content.split('\n')
    for i, line in enumerate(lines):
        # Track current phase
        if line.startswith('## Phase'):
            phase_match = re.search(r'Phase\s+(\d+)[:\s]+(.+?)(?:\s+\(|$)', line)
            if phase_match:
                current_phase = f"Phase {phase_match.group(1)}: {phase_match.group(2)}"
        
        # Find task lines
        task_match = re.match(r'^-\s+\[\s*\]\s+(T\d+)\s+(.+)$', line)
        if task_match:
            task_id = task_match.group(1)
            task_desc = task_match.group(2)
            
            # Determine labels
            labels = [f"feature:{FEATURE_NUMBER}"]
            
            # Phase label
            phase_num = re.search(r'Phase\s+(\d+)', current_phase)
            if phase_num:
                pn = int(phase_num.group(1))
                if pn == 1:
                    labels.append("phase:setup")
                elif pn == 2:
                    labels.append("phase:foundational")
                elif pn <= 8:
                    labels.append("phase:implementation")
                else:
                    labels.append("phase:polish")
            
            # Check for markers
            if '[P]' in task_desc:
                labels.append("parallel")
            
            # User story
            us_match = re.search(r'\[US(\d+)\]', task_desc)
            if us_match:
                labels.append(f"user-story:{us_match.group(1)}")
            
            # Priority
            if 'Priority: P1' in current_phase or '🎯 MVP' in current_phase:
                labels.append("priority:p1")
            elif 'Priority: P2' in current_phase:
                labels.append("priority:p2")
            elif 'Priority: P3' in current_phase:
                labels.append("priority:p3")
            elif 'CRITICAL' in current_phase or 'CRITICAL' in task_desc:
                labels.append("priority:critical")
            
            # Clean title
            title = re.sub(r'\[P\]|\[US\d+\]', '', task_desc).strip()
            title = f"[{task_id}] {title}"
            
            # Build body
            body = f"""**Phase**: {current_phase}
**Task**: {task_id}
**Feature**: {FEATURE_NUMBER}-{FEATURE_NAME}

## Description
{task_desc}

## Reference
From specs/{FEATURE_NUMBER}-{FEATURE_NAME}/tasks.md
"""
            
            tasks.append({
                'title': title[:80],  # GitHub limits
                'body': body.replace('\n', '\\n'),  # CSV escape
                'labels': ','.join(labels),
                'task_id': task_id,
                'phase': current_phase,
                'description': task_desc
            })
    
    return tasks


def generate_csv(tasks, output_file):
    """Generate CSV for GitHub bulk import"""
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['title', 'body', 'labels'])
        writer.writeheader()
        for task in tasks:
            writer.writerow({
                'title': task['title'],
                'body': task['body'],
                'labels': task['labels']
            })
    print(f"✅ Created CSV file: {output_file}")
    print(f"   You can import this via GitHub web UI")


def generate_markdown_checklist(tasks, output_file):
    """Generate markdown file with gh commands"""
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"# GitHub Issues for Feature {FEATURE_NUMBER}\n\n")
        f.write("**IMPORTANT**: You need WRITE permissions to create these issues.\n\n")
        f.write("## Contact Repository Admin\n\n")
        f.write("Ask the `eitatech` organization admin to grant you **Write** or **Maintain** permissions.\n\n")
        f.write("Check who has admin access: Go to https://github.com/eitatech/gatomia-vscode/settings/access\n\n")
        f.write("---\n\n")
        f.write("## Manual Creation Commands\n\n")
        f.write("Once you have permissions, run these commands:\n\n")
        f.write("```bash\n")
        
        for task in tasks:
            # Escape quotes and newlines for shell
            title = task['title'].replace('"', '\\"')
            body = task['description'].replace('"', '\\"').replace('\n', '\\n')
            
            f.write(f'\n# {task["task_id"]}\n')
            f.write(f'gh issue create -R eitatech/gatomia-vscode \\\n')
            f.write(f'  --title "{title}" \\\n')
            f.write(f'  --body "{body}" \\\n')
            f.write(f'  --label "{task["labels"]}"\n')
        
        f.write("```\n\n")
        f.write("---\n\n")
        f.write("## Issues Summary\n\n")
        
        for task in tasks:
            f.write(f"- [ ] **{task['task_id']}**: {task['description'][:100]}...\n")
            f.write(f"      - Phase: {task['phase']}\n")
            f.write(f"      - Labels: {task['labels']}\n\n")
    
    print(f"✅ Created markdown file: {output_file}")
    print(f"   This contains all commands to run once you have permissions")


def main():
    print("\n" + "=" * 80)
    print("GitHub Issues Helper (Read-Only Mode)")
    print("=" * 80 + "\n")
    
    tasks_file = f"specs/{FEATURE_NUMBER}-{FEATURE_NAME}/tasks.md"
    print(f"Parsing tasks from {tasks_file}...")
    
    tasks = parse_tasks_from_file(tasks_file)
    print(f"✓ Found {len(tasks)} tasks\n")
    
    # Generate CSV for web import
    csv_file = f"specs/{FEATURE_NUMBER}-{FEATURE_NAME}/issues-import.csv"
    generate_csv(tasks, csv_file)
    
    # Generate markdown with commands
    md_file = f"specs/{FEATURE_NUMBER}-{FEATURE_NAME}/issues-commands.md"
    generate_markdown_checklist(tasks, md_file)
    
    print("\n" + "=" * 80)
    print("Summary")
    print("=" * 80)
    print(f"Total tasks: {len(tasks)}")
    print(f"\nNext steps:")
    print(f"1. Request Write permissions from eitatech organization admin")
    print(f"2. Option A: Use {csv_file} for bulk import via GitHub web UI")
    print(f"3. Option B: Run commands from {md_file} once you have permissions")
    print(f"4. Option C: Create issues manually from the checklist in {md_file}")
    print()


if __name__ == "__main__":
    main()
