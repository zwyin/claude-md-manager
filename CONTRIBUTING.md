# Contributing to CLAUDE.md Manager

Thank you for your interest in contributing!

## Development Setup

```bash
# Clone the repo
git clone https://github.com/zwyin/claude-md-manager.git
cd claude-md-manager

# Python dependencies
pip install pyyaml pytest

# Dashboard dependencies
cd web && npm install
```

## Project Structure

```
build/           → assemble.py — build system
hooks/           → session-logger.py, db.py — citation tracking
rules/           → Modular rule files (YAML frontmatter + Markdown)
web/             → Next.js dashboard (App Router + shadcn/ui)
tests/           → Python unit tests
scripts/         → Utility scripts
docs/specs/      → Design documents
```

## Code Style

### Python
- Type annotations on function signatures
- f-strings for formatting
- `pathlib.Path` for file paths
- Functions should be small and focused

### TypeScript / React
- Function components with hooks
- Use shadcn/ui components (Card, Table, Badge, etc.)
- No hand-crafted layout CSS — use the component library

## Making Changes

1. Create a branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Run tests: `python -m pytest tests/ -v`
4. Build dashboard: `cd web && npm run build`
5. Commit with a clear message
6. Open a Pull Request

## Commit Messages

Use conventional commit format:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `refactor:` code restructuring
- `test:` adding or updating tests

## Adding New Rules

Rule files live in `rules/` with numeric prefixes for ordering:

```
rules/00_core.md       → order: 0
rules/10_triage.md     → order: 10
rules/20_subagent.md   → order: 20
```

Each file must have:
- Valid YAML frontmatter with `id`, `title`, `order`
- At least one sub-rule with `id` and `keywords`
- Non-empty Markdown body

Validate with: `python build/assemble.py --validate`

## Reporting Issues

- Describe the expected vs actual behavior
- Include steps to reproduce
- Mention your OS, Python version, and Node.js version

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
