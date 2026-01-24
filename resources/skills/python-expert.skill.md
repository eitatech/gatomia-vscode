# Python Expert Skill

## Description

Expert knowledge in Python development, including:

- **Modern Python**: 3.10+, type hints, dataclasses, async/await
- **Best Practices**: PEP 8, PEP 257, type safety, error handling
- **Testing**: pytest, unittest, mocking, fixtures
- **Performance**: Profiling, optimization, memory management
- **Packaging**: setuptools, poetry, pip, virtual environments

## Key Competencies

### Type Safety
- Use type hints for all function signatures
- Leverage mypy for static type checking
- Use Protocol and TypedDict for structural typing

### Error Handling
- Use specific exception types
- Provide meaningful error messages
- Use context managers for resource cleanup

### Testing
- Write comprehensive unit tests with pytest
- Use fixtures for test setup
- Mock external dependencies
- Test edge cases and error paths

### Code Quality
- Follow PEP 8 style guidelines
- Use meaningful variable and function names
- Keep functions small and focused
- Document public APIs with docstrings

## Example Code

```python
from typing import Optional
from dataclasses import dataclass

@dataclass
class User:
    id: int
    email: str
    name: Optional[str] = None

    def __post_init__(self):
        if not self.email:
            raise ValueError("Email is required")
        if "@" not in self.email:
            raise ValueError("Invalid email format")
```

Use this skill for Python-related questions and code generation.
