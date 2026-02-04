#!/usr/bin/env python3
"""
GatomIA Diagram Generator
Generates Mermaid diagrams for code documentation.
"""

import json
from pathlib import Path
from typing import Any


class DiagramGenerator:
    """Generates Mermaid diagrams for GatomIA documentation."""

    def __init__(
        self,
        module_tree_path: str | None = None,
        dependency_graph_path: str | None = None,
    ):
        """Initialize diagram generator."""
        self.module_tree: dict[str, Any] = {}
        self.dependency_graph: dict[str, Any] = {}

        if module_tree_path:
            self.module_tree = self._load_json(module_tree_path)
        if dependency_graph_path:
            self.dependency_graph = self._load_json(dependency_graph_path)

    def _load_json(self, filepath: str) -> dict[str, Any]:
        """Load and parse JSON file."""
        with open(filepath, encoding="utf-8") as f:
            return json.load(f)

    def generate_architecture_diagram(
        self,
        module_path: str | None = None,
        max_depth: int = 2,
    ) -> str:
        """Generate architecture diagram for a module or entire repository."""
        diagram = "```mermaid\ngraph TB\n"

        if module_path:
            diagram += self._generate_module_architecture(module_path, max_depth)
        else:
            diagram += self._generate_repository_architecture(max_depth)

        diagram += "```"
        return diagram

    def _generate_repository_architecture(self, max_depth: int) -> str:
        """Generate architecture for entire repository."""
        lines = []

        def traverse(
            modules: dict[str, Any],
            parent_id: str | None = None,
            depth: int = 0,
        ) -> None:
            if depth >= max_depth:
                return

            for idx, (module_path, module_data) in enumerate(modules.items()):
                node_id = f"M{depth}_{idx}"
                safe_name = module_path.replace("/", "_").replace("-", "_")
                lines.append(f'    {node_id}["{module_path}"]')

                if parent_id:
                    lines.append(f"    {parent_id} --> {node_id}")

                children = module_data.get("children", {})
                if children:
                    traverse(children, node_id, depth + 1)

        traverse(self.module_tree)
        return "\n".join(lines) + "\n"

    def _generate_module_architecture(self, module_path: str, max_depth: int) -> str:
        """Generate architecture for a specific module."""
        lines = []

        module_data = self._find_module(module_path)
        if not module_data:
            return f'    Error["Module {module_path} not found"]\n'

        node_id = "Root"
        lines.append(f'    {node_id}["{module_path}"]')

        for idx, comp_id in enumerate(module_data.get("components", [])):
            comp_node = f"C{idx}"
            comp_name = comp_id.split(".")[-1] if "." in comp_id else comp_id
            lines.append(f'    {comp_node}["{comp_name}"]')
            lines.append(f"    {node_id} --> {comp_node}")
            lines.append(f"    style {comp_node} fill:#e1f5ff")

        return "\n".join(lines) + "\n"

    def _find_module(self, module_path: str) -> dict[str, Any] | None:
        """Find a module in the tree by path."""

        def search(modules: dict[str, Any]) -> dict[str, Any] | None:
            for path, data in modules.items():
                if path == module_path:
                    return data
                children = data.get("children", {})
                if children:
                    result = search(children)
                    if result:
                        return result
            return None

        return search(self.module_tree)

    def generate_dependency_diagram(
        self,
        component_ids: list[str] | None = None,
        max_nodes: int = 20,
    ) -> str:
        """Generate dependency diagram for components."""
        diagram = "```mermaid\ngraph LR\n"

        if component_ids:
            components = {cid: self.dependency_graph.get(cid, {}) for cid in component_ids}
        else:
            items = list(self.dependency_graph.items())[:max_nodes]
            components = dict(items)

        node_map = {}
        for idx, (comp_id, comp_data) in enumerate(components.items()):
            node_id = f"N{idx}"
            node_map[comp_id] = node_id
            comp_name = comp_data.get("name", comp_id.split(".")[-1])
            diagram += f'    {node_id}["{comp_name}"]\n'

        for comp_id, comp_data in components.items():
            from_id = node_map.get(comp_id)
            if not from_id:
                continue

            for dep_id in comp_data.get("depends_on", []):
                to_id = node_map.get(dep_id)
                if to_id:
                    diagram += f"    {from_id} --> {to_id}\n"

        for node_id in node_map.values():
            diagram += f"    style {node_id} fill:#e1f5ff\n"

        diagram += "```"
        return diagram

    def generate_sequence_diagram(
        self,
        flow: list[dict[str, str]],
        title: str = "Interaction Flow",
    ) -> str:
        """Generate sequence diagram from flow definition.

        Args:
            flow: List of dicts with 'from', 'to', 'action', 'response' keys
            title: Diagram title

        Returns:
            Mermaid sequence diagram
        """
        participants = set()
        for step in flow:
            participants.add(step["from"])
            participants.add(step["to"])

        diagram = "```mermaid\nsequenceDiagram\n"

        for participant in sorted(participants):
            safe_name = participant.replace(" ", "_")
            diagram += f"    participant {safe_name} as {participant}\n"

        for step in flow:
            from_name = step["from"].replace(" ", "_")
            to_name = step["to"].replace(" ", "_")
            action = step.get("action", "")
            response = step.get("response")

            diagram += f"    {from_name}->>{to_name}: {action}\n"
            if response:
                diagram += f"    {to_name}-->>{from_name}: {response}\n"

        diagram += "```"
        return diagram

    def generate_data_flow_diagram(
        self,
        nodes: list[dict[str, str]],
        edges: list[dict[str, str]],
    ) -> str:
        """Generate data flow diagram.

        Args:
            nodes: List of dicts with 'id', 'label', 'type' keys
            edges: List of dicts with 'from', 'to', 'label' keys

        Returns:
            Mermaid flowchart
        """
        diagram = "```mermaid\nflowchart LR\n"

        type_shapes = {
            "input": "([{label}])",
            "process": "[{label}]",
            "output": "([{label}])",
            "database": "[({label})]",
            "decision": "{{{label}}}",
        }

        for node in nodes:
            node_id = node["id"]
            label = node["label"]
            node_type = node.get("type", "process")
            shape = type_shapes.get(node_type, "[{label}]")
            diagram += f"    {node_id}{shape.format(label=label)}\n"

        for edge in edges:
            from_id = edge["from"]
            to_id = edge["to"]
            label = edge.get("label", "")

            if label:
                diagram += f"    {from_id} -->|{label}| {to_id}\n"
            else:
                diagram += f"    {from_id} --> {to_id}\n"

        diagram += "```"
        return diagram

    def generate_class_diagram(
        self,
        classes: list[dict[str, Any]],
        relationships: list[dict[str, str]] | None = None,
    ) -> str:
        """Generate class diagram.

        Args:
            classes: List of class definitions with 'name', 'attributes', 'methods'
            relationships: List of relationships with 'from', 'to', 'type'

        Returns:
            Mermaid class diagram
        """
        diagram = "```mermaid\nclassDiagram\n"

        for cls in classes:
            class_name = cls["name"]
            diagram += f"    class {class_name} {{\n"

            for attr in cls.get("attributes", []):
                diagram += f"        {attr}\n"

            for method in cls.get("methods", []):
                diagram += f"        {method}()\n"

            diagram += "    }\n"

        if relationships:
            rel_symbols = {
                "inheritance": "<|--",
                "composition": "*--",
                "aggregation": "o--",
                "association": "--",
                "dependency": "..",
            }

            for rel in relationships:
                from_cls = rel["from"]
                to_cls = rel["to"]
                rel_type = rel.get("type", "association")
                symbol = rel_symbols.get(rel_type, "--")
                diagram += f"    {from_cls} {symbol} {to_cls}\n"

        diagram += "```"
        return diagram


def main() -> None:
    """Example usage."""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python diagram_generator.py <module_tree.json> [dependency_graph.json]")
        print("\nExamples:")
        print("  python diagram_generator.py module_tree.json")
        print("  python diagram_generator.py module_tree.json dependency_graph.json")
        sys.exit(1)

    module_tree_path = sys.argv[1]
    dep_graph_path = sys.argv[2] if len(sys.argv) > 2 else None

    generator = DiagramGenerator(module_tree_path, dep_graph_path)

    print("Architecture Diagram:")
    print(generator.generate_architecture_diagram())

    if dep_graph_path:
        print("\nDependency Diagram:")
        print(generator.generate_dependency_diagram())


if __name__ == "__main__":
    main()
