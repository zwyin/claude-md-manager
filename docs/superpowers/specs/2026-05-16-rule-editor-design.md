# Rule Editor Design Spec

Date: 2026-05-16

## Overview

End-to-end visual rule editor in the CLAUDE.md Manager dashboard. Users can drag-to-reorder rules, edit YAML frontmatter and Markdown body with syntax highlighting, preview assembled output, and publish changes — all from a new `/editor` page.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Editor scope | End-to-end (edit + build + publish) | Single page for the full workflow |
| Page location | Independent `/editor` route | Doesn't clutter existing dashboard pages |
| Save model | Draft + Publish | Safe experimentation, explicit publish |
| Architecture | Monolithic API + SQLite (Method A) | Simple, consistent with existing codebase |

## Data Model

### `rule_drafts` table

```sql
CREATE TABLE IF NOT EXISTS rule_drafts (
    rule_id TEXT PRIMARY KEY,
    frontmatter_yaml TEXT NOT NULL,
    markdown_body TEXT NOT NULL,
    order_override INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

A row exists only when the user has unsaved changes. No row = no draft, rule content comes from the file.

**Order precedence**: `order_override` (from drag-and-drop) takes precedence over the `order` field in `frontmatter_yaml`. On publish, the override value is written back into the file's frontmatter `order` field, and `order_override` is cleared.

### `publish_history` table

```sql
CREATE TABLE IF NOT EXISTS publish_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    rules_changed INTEGER NOT NULL,
    snapshot_name TEXT,
    status TEXT NOT NULL,
    error_message TEXT
);
```

Audit trail for publishes. Each row is one publish action.

## UI Layout

Three-zone layout on desktop, stacked on mobile:

| Zone | Content | Width |
|------|---------|-------|
| Left: Rule List | Draggable cards by `order`, grouped by section | 280px |
| Center: Editor | CodeMirror with YAML frontmatter (top) + Markdown body (bottom) | flex |
| Right: Preview | Rendered preview of assembled output | 320px |

### Rule List Panel

- Drag-and-drop via `@dnd-kit/sortable`
- Each card: rule title, section badge, draft/published status dot (orange = draft, green = published)
- Section dividers between groups
- Dropping a card updates the `order_override` field

### Editor Panel

- CodeMirror 6 with split panes
- Top pane: YAML mode for frontmatter (schema validation)
- Bottom pane: Markdown mode for body
- Toolbar: **Save Draft** | **Discard Draft** | **Validate**

### Preview Panel

- Shows how the rule will render in the assembled CLAUDE.md
- Updates live as user types (debounced 300ms)
- Matches the actual output format from `assemble.py`

## API Design

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/editor/rules` | GET | List all rules with draft status |
| `/api/editor/rules/[id]/draft` | GET | Read draft for a rule (404 if no draft) |
| `/api/editor/rules/[id]/draft` | PUT | Save/update draft |
| `/api/editor/rules/[id]/draft` | DELETE | Discard draft |
| `/api/editor/reorder` | POST | Accepts `[{id, order}]` array |
| `/api/editor/publish` | POST | Write drafts to files + run assemble.py |
| `/api/editor/publish-history` | GET | Recent publish events |
| `/api/editor/validate` | POST | Validate drafts without saving |

## Component Architecture

```
EditorPage (/editor/page.tsx)
├── EditorLayout
│   ├── RuleListPanel
│   │   ├── DraggableRuleCard (dnd-kit sortable)
│   │   └── SectionDivider
│   ├── EditorPanel
│   │   ├── FrontmatterEditor (CodeMirror, YAML mode)
│   │   ├── BodyEditor (CodeMirror, Markdown mode)
│   │   └── EditorToolbar
│   └── PreviewPanel
│       └── MarkdownPreview
└── PublishDialog (confirmation modal)
```

State management: React `useState`/`useReducer`. No external state library.

## Publish Flow

1. User clicks **Publish All** → dialog shows which rules will change
2. POST `/api/editor/publish` → server:
   - Read all drafts from `rule_drafts`
   - For each draft: reconstruct file (YAML frontmatter + `---` separator + Markdown body), write to `rules/*.md`
   - Apply order overrides (update `order` field in frontmatter)
   - Run `python build/assemble.py` as subprocess
   - Insert row into `publish_history`
   - Delete published drafts from `rule_drafts`
3. Success → refresh list, toast notification
4. Failure → show error, keep drafts intact for retry

### Error Handling

- If `assemble.py` fails: rule files are already written but no snapshot. User can fix and retry.
- Drafts are never deleted on failure.
- Validate endpoint checks YAML syntax + required frontmatter fields (`id`, `title`, `order`) before publish.

## Dependencies

- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-and-drop
- `@codemirror/lang-yaml` + `@codemirror/lang-markdown` — syntax editing
- `@uiw/react-codemirror` — React wrapper for CodeMirror 6
- All existing dependencies (shadcn/ui, better-sqlite3, Next.js)

## Out of Scope

- Real-time collaboration / multi-user editing
- Git diff view (can be added later)
- Rule template system (separate feature)
- Undo/redo beyond draft discard
