#!/usr/bin/env python3
"""
GatomIA Documentation Orchestrator
Coordinates the entire documentation generation process.
"""

import json
import os
from pathlib import Path
from typing import Any

from codewiki_analyzer import GatomiaAnalyzer


class GatomiaOrchestrator:
    """Orchestrates the GatomIA documentation generation process."""

    def __init__(
        self,
        module_tree_path: str,
        dependency_graph_path: str,
        output_dir: str = "./docs",
    ):
        """Initialize orchestrator."""
        self.analyzer = GatomiaAnalyzer(module_tree_path, dependency_graph_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.generated_docs: dict[str, Path] = {}

    def generate_all_documentation(self) -> None:
        """Generate complete documentation suite."""
        print("GatomIA Documentation Generator")
        print("=" * 60)

        print("\nStep 1: Analyzing repository...")
        summary = self.analyzer.get_repository_summary()
        print(f"  Modules: {summary['total_modules']}")
        print(f"  Components: {summary['total_components']}")
        print(f"  Depth: {summary['max_depth']}")

        print("\nStep 2: Determining processing order...")
        processing_order = self.analyzer.get_processing_order()
        print(f"  Levels to process: {len(processing_order)}")

        print("\nStep 3: Generating leaf module documentation...")
        leaf_count = 0
        for module_path in processing_order[0]:
            self._generate_leaf_module_doc(module_path)
            leaf_count += 1
            print(f"  [{leaf_count}/{len(processing_order[0])}] {module_path}")

        if len(processing_order) > 1:
            print("\nStep 4: Generating parent module documentation...")
            parent_count = 0
            total_parents = sum(len(level) for level in processing_order[1:])

            for level_idx, level_modules in enumerate(processing_order[1:], 1):
                for module_path in level_modules:
                    self._generate_parent_module_doc(module_path)
                    parent_count += 1
                    print(f"  [{parent_count}/{total_parents}] Level {level_idx}: {module_path}")

        print("\nStep 5: Generating repository overview...")
        self._generate_repository_overview()
        print("  README.md generated")

        print("\nStep 6: Generating navigation...")
        self._generate_navigation()
        print("  Navigation generated")

        print("\n" + "=" * 60)
        print(f"Documentation generated in: {self.output_dir}")
        print(f"Total files: {len(self.generated_docs)}")
        print("=" * 60)

    def _generate_leaf_module_doc(self, module_path: str) -> None:
        """Generate documentation for a leaf module."""
        report = self.analyzer.generate_analysis_report(module_path)
        markdown = self._format_leaf_module_markdown(report)

        output_path = self._get_module_doc_path(module_path)
        self._save_documentation(output_path, markdown)
        self.generated_docs[module_path] = output_path

    def _generate_parent_module_doc(self, module_path: str) -> None:
        """Generate documentation for a parent module."""
        if not self.analyzer.parsed_tree:
            return

        module_info = self.analyzer.parsed_tree["modules"][module_path]

        child_docs = {}
        for child_path in self._get_child_modules(module_path):
            if child_path in self.generated_docs:
                child_docs[child_path] = self._load_documentation(self.generated_docs[child_path])

        markdown = self._format_parent_module_markdown(module_path, module_info, child_docs)

        output_path = self._get_module_doc_path(module_path)
        self._save_documentation(output_path, markdown)
        self.generated_docs[module_path] = output_path

    def _generate_repository_overview(self) -> None:
        """Generate repository-level overview documentation."""
        summary = self.analyzer.get_repository_summary()

        if not self.analyzer.parsed_tree:
            return

        module_summaries = {}
        for module_path in self.analyzer.parsed_tree["root_modules"]:
            if module_path in self.generated_docs:
                module_summaries[module_path] = self._extract_module_summary(
                    self.generated_docs[module_path]
                )

        markdown = self._format_repository_overview_markdown(summary, module_summaries)

        output_path = self.output_dir / "README.md"
        self._save_documentation(output_path, markdown)
        self.generated_docs["_repository_overview"] = output_path

    def _generate_navigation(self) -> None:
        """Generate navigation index."""
        nav_content = "# Documentation Index\n\n"
        nav_content += "## Module Documentation\n\n"

        if not self.analyzer.parsed_tree:
            return

        for module_path in sorted(self.generated_docs.keys()):
            if module_path.startswith("_"):
                continue

            level = self.analyzer.parsed_tree["modules"][module_path]["level"]
            indent = "  " * level
            rel_path = self._get_relative_path(
                self.output_dir / "INDEX.md", self.generated_docs[module_path]
            )

            nav_content += f"{indent}- [{module_path}]({rel_path})\n"

        output_path = self.output_dir / "INDEX.md"
        self._save_documentation(output_path, nav_content)

    def _format_leaf_module_markdown(self, report: dict[str, Any]) -> str:
        """Format leaf module documentation as markdown."""
        cohesion = report.get("complexity", {}).get("cohesion_score", 0) * 100

        md = f"# Module: {report['module']}\n\n"

        md += "## Overview\n\n"
        md += f"This module contains {report['summary']['component_count']} components "
        md += f"with a cohesion score of {cohesion:.1f}%. "
        md += self._infer_module_purpose(report) + "\n\n"

        md += "## Architecture\n\n"
        md += self._generate_component_diagram(report) + "\n\n"

        md += "## Components\n\n"
        for comp_id, comp_data in report.get("components", {}).items():
            md += self._format_component_section(comp_id, comp_data)

        if report.get("dependencies"):
            md += "## External Dependencies\n\n"
            for dep in report["dependencies"]:
                md += f"### {dep['target_module']}\n"
                md += f"- {len(dep['relationships'])} relationship(s)\n\n"

        if report.get("dependents"):
            md += "## Used By\n\n"
            for dep in report["dependents"]:
                md += f"### {dep['source_module']}\n"
                md += f"- {len(dep['relationships'])} relationship(s)\n\n"

        return md

    def _format_parent_module_markdown(
        self,
        module_path: str,
        module_info: dict[str, Any],
        child_docs: dict[str, str],
    ) -> str:
        """Format parent module documentation as markdown."""
        md = f"# Module: {module_path}\n\n"

        md += "## Overview\n\n"
        md += f"This is a parent module containing {len(module_info['children'])} submodules. "
        md += self._infer_parent_module_purpose(module_path, child_docs) + "\n\n"

        md += "## Architecture\n\n"
        md += self._generate_module_hierarchy_diagram(module_path) + "\n\n"

        md += "## Submodules\n\n"
        for child_path in self._get_child_modules(module_path):
            if child_path in child_docs:
                summary = self._extract_module_summary_from_content(child_docs[child_path])
                rel_path = self._get_relative_path(
                    self._get_module_doc_path(module_path),
                    self.generated_docs[child_path],
                )
                md += f"### [{child_path}]({rel_path})\n"
                md += f"{summary}\n\n"

        return md

    def _format_repository_overview_markdown(
        self,
        summary: dict[str, Any],
        module_summaries: dict[str, str],
    ) -> str:
        """Format repository overview documentation as markdown."""
        md = "# Repository Documentation\n\n"

        md += "## Purpose\n\n"
        md += "This repository contains a modular software system organized into "
        md += (
            f"{summary['total_modules']} modules with {summary['total_components']} components.\n\n"
        )

        md += "## Architecture Overview\n\n"
        md += f"The system is organized in a {summary['max_depth']}-level hierarchy:\n\n"
        md += self._generate_repository_architecture_diagram() + "\n\n"

        md += "## Module Structure\n\n"
        for module_path, module_summary in module_summaries.items():
            if module_path in self.generated_docs:
                rel_path = self._get_relative_path(
                    self.output_dir / "README.md", self.generated_docs[module_path]
                )
                md += f"### [{module_path}]({rel_path})\n"
                md += f"{module_summary}\n\n"

        md += "## Getting Started\n\n"
        md += "Start by exploring the root modules:\n\n"

        if self.analyzer.parsed_tree:
            for module_path in self.analyzer.parsed_tree["root_modules"]:
                if module_path in self.generated_docs:
                    rel_path = self._get_relative_path(
                        self.output_dir / "README.md", self.generated_docs[module_path]
                    )
                    md += f"- [{module_path}]({rel_path})\n"

        return md

    def _infer_module_purpose(self, report: dict[str, Any]) -> str:
        """Infer module purpose from components."""
        roles = []
        for comp_data in report.get("components", {}).values():
            purpose = comp_data.get("purpose", {})
            if "role" in purpose:
                roles.append(purpose["role"])

        if "analyzer" in roles or "parser" in roles:
            return "It provides data analysis and parsing capabilities."
        elif "service" in roles:
            return "It implements business logic and services."
        elif "manager" in roles:
            return "It manages resources and orchestrates operations."
        elif "generator" in roles:
            return "It generates or constructs data and objects."
        else:
            return "It provides core functionality for the system."

    def _infer_parent_module_purpose(self, module_path: str, child_docs: dict[str, str]) -> str:
        """Infer parent module purpose from children."""
        if "fe" in module_path.lower():
            return "It manages the frontend layer of the application."
        elif "be" in module_path.lower():
            return "It manages the backend layer of the application."
        elif "cli" in module_path.lower():
            return "It provides command-line interface functionality."
        else:
            return "It coordinates its submodules to provide system functionality."

    def _generate_component_diagram(self, report: dict[str, Any]) -> str:
        """Generate Mermaid diagram for components."""
        diagram = "```mermaid\ngraph LR\n"

        comp_nodes = {}
        for idx, comp_id in enumerate(report.get("components", {})):
            node_id = f"C{idx}"
            comp_name = report["components"][comp_id]["info"]["name"]
            comp_nodes[comp_id] = node_id
            diagram += f"    {node_id}[{comp_name}]\n"

        for node_id in comp_nodes.values():
            diagram += f"    style {node_id} fill:#e1f5ff\n"

        diagram += "```\n"
        return diagram

    def _generate_module_hierarchy_diagram(self, module_path: str) -> str:
        """Generate Mermaid diagram for module hierarchy."""
        diagram = "```mermaid\ngraph TB\n"

        diagram += f'    P["{module_path}"]\n'

        for idx, child_path in enumerate(self._get_child_modules(module_path)):
            child_id = f"C{idx}"
            diagram += f'    {child_id}["{child_path}"]\n'
            diagram += f"    P --> {child_id}\n"

        diagram += "```\n"
        return diagram

    def _generate_repository_architecture_diagram(self) -> str:
        """Generate Mermaid diagram for repository architecture."""
        diagram = "```mermaid\ngraph TB\n"

        if self.analyzer.parsed_tree:
            for idx, module_path in enumerate(self.analyzer.parsed_tree["root_modules"]):
                mod_id = f"M{idx}"
                diagram += f'    {mod_id}["{module_path}"]\n'

        diagram += "```\n"
        return diagram

    def _format_component_section(self, comp_id: str, comp_data: dict[str, Any]) -> str:
        """Format a component section."""
        info = comp_data["info"]
        purpose = comp_data.get("purpose", {})
        deps = comp_data.get("dependencies", {})

        md = f"### {info['name']}\n\n"
        md += f"**Type**: {info['component_type']}\n"
        md += f"**File**: `{info['relative_path']}`\n\n"
        md += f"**Purpose**: {purpose.get('primary_purpose', 'Unknown')}\n\n"

        internal_deps = deps.get("internal_dependencies", [])
        if internal_deps:
            md += "**Internal Dependencies**:\n"
            for dep in internal_deps:
                md += f"- {dep['name']}\n"
            md += "\n"

        external_deps = deps.get("external_dependencies", [])
        if external_deps:
            md += "**External Dependencies**:\n"
            for dep in external_deps:
                md += f"- {dep['name']} ({dep.get('module', 'unknown')})\n"
            md += "\n"

        return md

    def _get_child_modules(self, module_path: str) -> list[str]:
        """Get direct children of a module."""
        if not self.analyzer.parsed_tree:
            return []
        module_info = self.analyzer.parsed_tree["modules"][module_path]
        return list(module_info["children"].keys())

    def _get_module_doc_path(self, module_path: str) -> Path:
        """Get output path for module documentation."""
        path_parts = module_path.split("/")
        doc_path = self.output_dir / "modules"

        for part in path_parts:
            doc_path = doc_path / part

        doc_path.mkdir(parents=True, exist_ok=True)
        return doc_path / "README.md"

    def _get_relative_path(self, from_path: Path, to_path: Path) -> str:
        """Get relative path between two paths."""
        try:
            return os.path.relpath(to_path, from_path.parent)
        except ValueError:
            return str(to_path)

    def _save_documentation(self, path: Path, content: str) -> None:
        """Save documentation to file."""
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def _load_documentation(self, path: Path) -> str:
        """Load documentation from file."""
        with open(path, encoding="utf-8") as f:
            return f.read()

    def _extract_module_summary(self, doc_path: Path) -> str:
        """Extract summary from module documentation."""
        content = self._load_documentation(doc_path)
        return self._extract_module_summary_from_content(content)

    def _extract_module_summary_from_content(self, content: str) -> str:
        """Extract summary from documentation content."""
        lines = content.split("\n")
        in_overview = False
        summary_lines = []

        for line in lines:
            if line.startswith("## Overview"):
                in_overview = True
                continue

            if in_overview:
                if line.startswith("#"):
                    break
                if line.strip():
                    summary_lines.append(line.strip())
                    if len(summary_lines) >= 2:
                        break

        return " ".join(summary_lines) if summary_lines else "Module documentation."


def main() -> None:
    """Main entry point."""
    import sys

    if len(sys.argv) < 3:
        print(
            "Usage: python orchestrator.py <module_tree.json> <dependency_graph.json> [output_dir]"
        )
        sys.exit(1)

    module_tree_path = sys.argv[1]
    dep_graph_path = sys.argv[2]
    output_dir = sys.argv[3] if len(sys.argv) > 3 else "./docs"

    orchestrator = GatomiaOrchestrator(module_tree_path, dep_graph_path, output_dir)
    orchestrator.generate_all_documentation()


if __name__ == "__main__":
    main()
