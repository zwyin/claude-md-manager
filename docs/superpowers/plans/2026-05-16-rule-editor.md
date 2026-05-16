# Rule Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an end-to-end visual rule editor at `/editor` with drag-to-reorder, CodeMirror editing, live preview, and draft+publish workflow.

**Architecture:** New `/editor` page with three-zone layout (rule list, CodeMirror editor, preview). Drafts stored in SQLite `rule_drafts` table. Publish writes to `rules/*.md` files and runs `assemble.py`. API routes under `/api/editor/`.

**Tech Stack:** Next.js 16, React 19, @dnd-kit/core + @dnd-kit/sortable, @uiw/react-codemirror, @codemirror/lang-yaml, @codemirror/lang-markdown, better-sqlite3, shadcn/ui, react-markdown (already installed).

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `web/src/app/editor/page.tsx` | Editor page (client component) |
| `web/src/app/editor/EditorLayout.tsx` | Three-zone layout container |
| `web/src/app/editor/RuleListPanel.tsx` | Draggable rule cards with dnd-kit |
| `web/src/app/editor/EditorPanel.tsx` | CodeMirror split pane (YAML + Markdown) |
| `web/src/app/editor/PreviewPanel.tsx` | Live rendered preview using react-markdown |
| `web/src/app/editor/PublishDialog.tsx` | Confirmation dialog before publish |
| `web/src/app/editor/types.ts` | Editor-specific TypeScript interfaces |
| `web/src/app/api/editor/rules/route.ts` | GET: list rules with draft status |
| `web/src/app/api/editor/rules/[id]/draft/route.ts` | GET/PUT/DELETE: draft CRUD |
| `web/src/app/api/editor/reorder/route.ts` | POST: update rule order |
| `web/src/app/api/editor/publish/route.ts` | POST: write drafts to files + assemble |
| `web/src/app/api/editor/publish-history/route.ts` | GET: publish audit trail |
| `web/src/app/api/editor/validate/route.ts` | POST: validate drafts |
| `web/src/lib/editor-db.ts` | SQLite functions for editor tables |

### Modified files

| File | Change |
|------|--------|
| `hooks/db.py` | Add `rule_drafts` and `publish_history` tables to `SCHEMA_SQL` |
| `web/src/components/app-sidebar.tsx` | Add Editor nav item |
| `web/package.json` | Add dnd-kit, codemirror dependencies |

---

## Task 1: Add editor tables to SQLite schema

**Files:**
- Modify: `hooks/db.py:10-47` (SCHEMA_SQL constant)

- [ ] **Step 1: Add tables to SCHEMA_SQL**

Append these two tables to the `SCHEMA_SQL` string in `hooks/db.py`, after the existing `sections_metadata` table:

```sql
CREATE TABLE IF NOT EXISTS rule_drafts (
    rule_id TEXT PRIMARY KEY,
    frontmatter_yaml TEXT NOT NULL,
    markdown_body TEXT NOT NULL,
    order_override INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS publish_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    rules_changed INTEGER NOT NULL,
    snapshot_name TEXT,
    status TEXT NOT NULL,
    error_message TEXT
);
```

- [ ] **Step 2: Verify schema loads**

Run: `cd /Users/zhiweiyin/repo_ds1600/claude-md-manager/.claude/worktrees/editor-design && python -c "from hooks.db import get_db; conn = get_db(); tables = [r[0] for r in conn.execute('SELECT name FROM sqlite_master WHERE type=\"table\"').fetchall()]; print(tables); conn.close()"`
Expected: `['rule_references', 'sessions', 'rules_metadata', 'sections_metadata', 'rule_drafts', 'publish_history']`

- [ ] **Step 3: Commit**

```bash
git add hooks/db.py
git commit -m "feat(db): add rule_drafts and publish_history tables for editor"
```

---

## Task 2: Install frontend dependencies

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Install dnd-kit and codemirror packages**

Run: `cd /Users/zhiweiyin/repo_ds1600/claude-md-manager/.claude/worktrees/editor-design/web && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @uiw/react-codemirror @codemirror/lang-yaml @codemirror/lang-markdown`

- [ ] **Step 2: Verify install**

Run: `cd /Users/zhiweiyin/repo_ds1600/claude-md-manager/.claude/worktrees/editor-design/web && node -e "require('@dnd-kit/core'); require('@uiw/react-codemirror'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "feat(web): add dnd-kit and codemirror dependencies for editor"
```

---

## Task 3: Create editor TypeScript types

**Files:**
- Create: `web/src/app/editor/types.ts`

- [ ] **Step 1: Write editor types**

Create `web/src/app/editor/types.ts`:

```typescript
export interface RuleFile {
  rule_id: string;
  section_id: string;
  title: string;
  order: number;
  source_file: string;
  frontmatter_yaml: string;
  markdown_body: string;
  has_draft: boolean;
  draft_order_override: number | null;
}

export interface RuleDraft {
  rule_id: string;
  frontmatter_yaml: string;
  markdown_body: string;
  order_override: number | null;
  created_at: string;
  updated_at: string;
}

export interface PublishEvent {
  id: number;
  published_at: string;
  rules_changed: number;
  snapshot_name: string | null;
  status: "success" | "failed";
  error_message: string | null;
}

export interface ReorderItem {
  rule_id: string;
  order: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/app/editor/types.ts
git commit -m "feat(editor): add TypeScript types for editor data model"
```

---

## Task 4: Create editor-db.ts (SQLite functions for editor)

**Files:**
- Create: `web/src/lib/editor-db.ts`

- [ ] **Step 1: Write editor-db.ts**

Create `web/src/lib/editor-db.ts`. This module opens the database in **read-write** mode (unlike the existing `db.ts` which is read-only) because drafts need write access.

```typescript
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { execFileSync } from "child_process";
import type { RuleFile, RuleDraft, PublishEvent, ReorderItem } from "@/app/editor/types";

const DB_PATH = path.join(process.cwd(), "..", "data", "usage.db");
const RULES_DIR = path.join(process.cwd(), "..", "rules");

function getReadWriteDb(): Database.Database {
  return new Database(DB_PATH);
}

function getReadonlyDb(): Database.Database {
  return new Database(DB_PATH, { readonly: true });
}

// ── Read rule files from disk ──

function parseFrontmatter(content: string): { yaml: string; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)/);
  if (!match) return { yaml: "", body: content };
  return { yaml: match[1], body: match[2] };
}

function parseYamlField(yaml: string, field: string): string | number | undefined {
  const regex = new RegExp(`^${field}:\\s*(.+)$`, "m");
  const match = yaml.match(regex);
  if (!match) return undefined;
  const val = match[1].trim();
  const num = Number(val);
  return isNaN(num) ? val : num;
}

export function getAllRulesWithDraftStatus(): RuleFile[] {
  const db = getReadonlyDb();
  try {
    const drafts = db.prepare("SELECT rule_id, order_override FROM rule_drafts").all() as Array<{
      rule_id: string;
      order_override: number | null;
    }>;
    const draftMap = new Map(drafts.map((d) => [d.rule_id, d]));

    const files = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith(".md")).sort();
    const rules: RuleFile[] = [];

    for (const fileName of files) {
      const content = fs.readFileSync(path.join(RULES_DIR, fileName), "utf-8");
      const { yaml, body } = parseFrontmatter(content);
      const ruleId = String(parseYamlField(yaml, "id") ?? "");
      const title = String(parseYamlField(yaml, "title") ?? ruleId);
      const order = Number(parseYamlField(yaml, "order") ?? 999);
      const draft = draftMap.get(ruleId);

      rules.push({
        rule_id: ruleId,
        section_id: ruleId,
        title,
        order,
        source_file: fileName,
        frontmatter_yaml: yaml,
        markdown_body: body,
        has_draft: !!draft,
        draft_order_override: draft?.order_override ?? null,
      });
    }

    rules.sort((a, b) => {
      const orderA = a.draft_order_override ?? a.order;
      const orderB = b.draft_order_override ?? b.order;
      return orderA - orderB;
    });

    return rules;
  } finally {
    db.close();
  }
}

// ── Draft CRUD ──

export function getDraft(ruleId: string): RuleDraft | null {
  const db = getReadonlyDb();
  try {
    return db.prepare("SELECT * FROM rule_drafts WHERE rule_id = ?").get(ruleId) as RuleDraft | null;
  } finally {
    db.close();
  }
}

export function saveDraft(
  ruleId: string,
  frontmatterYaml: string,
  markdownBody: string,
  orderOverride?: number | null
): void {
  const db = getReadWriteDb();
  try {
    db.prepare(
      `INSERT INTO rule_drafts (rule_id, frontmatter_yaml, markdown_body, order_override, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(rule_id) DO UPDATE SET
         frontmatter_yaml = excluded.frontmatter_yaml,
         markdown_body = excluded.markdown_body,
         order_override = excluded.order_override,
         updated_at = datetime('now')`
    ).run(ruleId, frontmatterYaml, markdownBody, orderOverride ?? null);
  } finally {
    db.close();
  }
}

export function deleteDraft(ruleId: string): void {
  const db = getReadWriteDb();
  try {
    db.prepare("DELETE FROM rule_drafts WHERE rule_id = ?").run(ruleId);
  } finally {
    db.close();
  }
}

// ── Reorder ──

export function saveReorder(items: ReorderItem[]): void {
  const db = getReadWriteDb();
  try {
    const upsert = db.prepare(
      `INSERT INTO rule_drafts (rule_id, frontmatter_yaml, markdown_body, order_override, updated_at)
       VALUES (?, '', '', ?, datetime('now'))
       ON CONFLICT(rule_id) DO UPDATE SET
         order_override = excluded.order_override,
         updated_at = datetime('now')`
    );
    const transaction = db.transaction(() => {
      for (const item of items) {
        upsert.run(item.rule_id, item.order);
      }
    });
    transaction();
  } finally {
    db.close();
  }
}

// ── Validate ──

export interface ValidationError {
  rule_id: string;
  message: string;
}

export function validateDrafts(drafts: Array<{ rule_id: string; frontmatter_yaml: string }>): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const d of drafts) {
    const yaml = d.frontmatter_yaml;
    const id = parseYamlField(yaml, "id");
    const title = parseYamlField(yaml, "title");
    const order = parseYamlField(yaml, "order");

    if (!id) errors.push({ rule_id: d.rule_id, message: "missing 'id'" });
    if (!title) errors.push({ rule_id: d.rule_id, message: "missing 'title'" });
    if (order === undefined) errors.push({ rule_id: d.rule_id, message: "missing 'order'" });
  }
  return errors;
}

// ── Publish ──

export function publishDrafts(): { rulesChanged: number; snapshotName: string | null; error?: string } {
  const db = getReadWriteDb();
  try {
    const drafts = db.prepare("SELECT * FROM rule_drafts").all() as RuleDraft[];
    if (drafts.length === 0) {
      return { rulesChanged: 0, snapshotName: null };
    }

    // Write each draft to its rule file
    const allRules = getAllRulesWithDraftStatus();
    for (const draft of drafts) {
      const rule = allRules.find((r) => r.rule_id === draft.rule_id);
      if (!rule) continue;

      // Apply order override to frontmatter
      let yaml = draft.frontmatter_yaml;
      if (draft.order_override !== null) {
        yaml = yaml.replace(/^order:\s*\d+/m, `order: ${draft.order_override}`);
      }

      const content = `---\n${yaml}\n---\n${draft.markdown_body}`;
      fs.writeFileSync(path.join(RULES_DIR, rule.source_file), content, "utf-8");
    }

    // Run assemble.py using execFileSync (no shell injection risk)
    let snapshotName: string | null = null;
    let errorMsg: string | null = null;
    try {
      const output = execFileSync("python", ["build/assemble.py"], {
        cwd: path.join(process.cwd(), ".."),
        encoding: "utf-8",
        timeout: 30000,
      });
      if (output.includes("Built CLAUDE.md")) {
        snapshotName = new Date().toISOString().replace(/[:.]/g, "-");
      }
    } catch (err: any) {
      errorMsg = err.stderr || err.message || "assemble.py failed";
    }

    // Record publish event
    db.prepare(
      `INSERT INTO publish_history (published_at, rules_changed, snapshot_name, status, error_message)
       VALUES (datetime('now'), ?, ?, ?, ?)`
    ).run(
      drafts.length,
      snapshotName,
      errorMsg ? "failed" : "success",
      errorMsg
    );

    // Clear drafts on success
    if (!errorMsg) {
      db.prepare("DELETE FROM rule_drafts").run();
    }

    return { rulesChanged: drafts.length, snapshotName, error: errorMsg ?? undefined };
  } finally {
    db.close();
  }
}

// ── Publish history ──

export function getPublishHistory(): PublishEvent[] {
  const db = getReadonlyDb();
  try {
    return db.prepare("SELECT * FROM publish_history ORDER BY published_at DESC LIMIT 20").all() as PublishEvent[];
  } finally {
    db.close();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/lib/editor-db.ts
git commit -m "feat(editor): add SQLite functions for editor draft/publish workflow"
```

---

## Task 5: Create API routes

**Files:**
- Create: `web/src/app/api/editor/rules/route.ts`
- Create: `web/src/app/api/editor/rules/[id]/draft/route.ts`
- Create: `web/src/app/api/editor/reorder/route.ts`
- Create: `web/src/app/api/editor/publish/route.ts`
- Create: `web/src/app/api/editor/publish-history/route.ts`
- Create: `web/src/app/api/editor/validate/route.ts`

- [ ] **Step 1: Create rules list route**

Create `web/src/app/api/editor/rules/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getAllRulesWithDraftStatus } from "@/lib/editor-db";

export async function GET() {
  try {
    const rules = getAllRulesWithDraftStatus();
    return NextResponse.json({ rules });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create draft CRUD route**

Create `web/src/app/api/editor/rules/[id]/draft/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDraft, saveDraft, deleteDraft } from "@/lib/editor-db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const draft = getDraft(decodeURIComponent(id));
    if (!draft) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(draft);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    saveDraft(
      decodeURIComponent(id),
      body.frontmatter_yaml,
      body.markdown_body,
      body.order_override
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    deleteDraft(decodeURIComponent(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create reorder route**

Create `web/src/app/api/editor/reorder/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { saveReorder } from "@/lib/editor-db";

export async function POST(request: NextRequest) {
  try {
    const items = await request.json();
    saveReorder(items);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create publish route**

Create `web/src/app/api/editor/publish/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { publishDrafts } from "@/lib/editor-db";

export async function POST() {
  try {
    const result = publishDrafts();
    if (result.error) {
      return NextResponse.json({ error: result.error, rulesChanged: result.rulesChanged }, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 5: Create publish-history route**

Create `web/src/app/api/editor/publish-history/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getPublishHistory } from "@/lib/editor-db";

export async function GET() {
  try {
    const history = getPublishHistory();
    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 6: Create validate route**

Create `web/src/app/api/editor/validate/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateDrafts } from "@/lib/editor-db";

export async function POST(request: NextRequest) {
  try {
    const drafts = await request.json();
    const errors = validateDrafts(drafts);
    return NextResponse.json({ valid: errors.length === 0, errors });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 7: Verify build**

Run: `cd /Users/zhiweiyin/repo_ds1600/claude-md-manager/.claude/worktrees/editor-design/web && npx next build`
Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add web/src/app/api/editor/
git commit -m "feat(editor): add API routes for draft CRUD, reorder, publish, validate"
```

---

## Task 6: Add Editor nav item to sidebar

**Files:**
- Modify: `web/src/components/app-sidebar.tsx`

- [ ] **Step 1: Add Editor nav item**

Add a new entry to the `navItems` array in `web/src/components/app-sidebar.tsx`, after the "Rules" item:

```typescript
const navItems = [
  { href: "/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/rules", label: "Rules", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  { href: "/editor", label: "Editor", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  { href: "/history", label: "History", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/analytics", label: "Analytics", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
];
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/app-sidebar.tsx
git commit -m "feat(sidebar): add Editor navigation item"
```

---

## Task 7: Create EditorLayout component

**Files:**
- Create: `web/src/app/editor/EditorLayout.tsx`

- [ ] **Step 1: Write EditorLayout**

Create `web/src/app/editor/EditorLayout.tsx`:

```typescript
"use client";

import type { RuleFile } from "./types";

interface EditorLayoutProps {
  rules: RuleFile[];
  children: {
    ruleList: React.ReactNode;
    editor: React.ReactNode;
    preview: React.ReactNode;
  };
}

export function EditorLayout({ rules, children }: EditorLayoutProps) {
  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-border bg-card">
        {children.ruleList}
      </div>
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {children.editor}
      </div>
      <div className="w-[320px] shrink-0 overflow-y-auto rounded-lg border border-border bg-card">
        {children.preview}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/app/editor/EditorLayout.tsx
git commit -m "feat(editor): add three-zone layout component"
```

---

## Task 8: Create RuleListPanel with drag-and-drop

**Files:**
- Create: `web/src/app/editor/RuleListPanel.tsx`

- [ ] **Step 1: Write RuleListPanel**

Create `web/src/app/editor/RuleListPanel.tsx`:

```typescript
"use client";

import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { RuleFile } from "./types";
import { Badge } from "@/components/ui/badge";

interface RuleListPanelProps {
  rules: RuleFile[];
  selectedId: string | null;
  onSelect: (ruleId: string) => void;
  onReorder: (items: Array<{ rule_id: string; order: number }>) => void;
}

function SortableCard({ rule, isSelected, onSelect }: { rule: RuleFile; isSelected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: rule.rule_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`px-3 py-2 cursor-pointer border-b border-border last:border-b-0 transition-colors ${
        isSelected ? "bg-accent" : "hover:bg-accent/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-6">{rule.order}</span>
        <span className="text-sm font-medium truncate flex-1">{rule.title}</span>
        {rule.has_draft && (
          <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" title="Has draft" />
        )}
      </div>
      <div className="mt-1 pl-6">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {rule.source_file}
        </Badge>
      </div>
    </div>
  );
}

export function RuleListPanel({ rules, selectedId, onSelect, onReorder }: RuleListPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rules.findIndex((r) => r.rule_id === active.id);
    const newIndex = rules.findIndex((r) => r.rule_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...rules];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const updates = reordered.map((r, i) => ({
      rule_id: r.rule_id,
      order: i * 10,
    }));
    onReorder(updates);
  }

  return (
    <div className="p-2">
      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Rules ({rules.length})
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rules.map((r) => r.rule_id)} strategy={verticalListSortingStrategy}>
          {rules.map((rule) => (
            <SortableCard
              key={rule.rule_id}
              rule={rule}
              isSelected={selectedId === rule.rule_id}
              onSelect={() => onSelect(rule.rule_id)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/app/editor/RuleListPanel.tsx
git commit -m "feat(editor): add draggable rule list panel with dnd-kit"
```

---

## Task 9: Create EditorPanel with CodeMirror

**Files:**
- Create: `web/src/app/editor/EditorPanel.tsx`

- [ ] **Step 1: Write EditorPanel**

Create `web/src/app/editor/EditorPanel.tsx`:

```typescript
"use client";

import { CodeMirror } from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { markdown } from "@codemirror/lang-markdown";
import { Button } from "@/components/ui/button";

interface EditorPanelProps {
  frontmatterYaml: string;
  markdownBody: string;
  hasDraft: boolean;
  onFrontmatterChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSaveDraft: () => void;
  onDiscardDraft: () => void;
}

export function EditorPanel({
  frontmatterYaml,
  markdownBody,
  hasDraft,
  onFrontmatterChange,
  onBodyChange,
  onSaveDraft,
  onDiscardDraft,
}: EditorPanelProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-2">
        <Button size="sm" onClick={onSaveDraft}>
          Save Draft
        </Button>
        {hasDraft && (
          <Button size="sm" variant="outline" onClick={onDiscardDraft}>
            Discard Draft
          </Button>
        )}
        {hasDraft && (
          <span className="text-xs text-orange-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            Unsaved changes
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="h-[40%] border border-border rounded-lg overflow-hidden">
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground bg-muted/50 border-b border-border">
            YAML Frontmatter
          </div>
          <CodeMirror
            value={frontmatterYaml}
            height="100%"
            extensions={[yaml()]}
            onChange={onFrontmatterChange}
            className="text-sm"
            theme="dark"
          />
        </div>
        <div className="flex-1 border border-border rounded-lg overflow-hidden">
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground bg-muted/50 border-b border-border">
            Markdown Body
          </div>
          <CodeMirror
            value={markdownBody}
            height="100%"
            extensions={[markdown()]}
            onChange={onBodyChange}
            className="text-sm"
            theme="dark"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/app/editor/EditorPanel.tsx
git commit -m "feat(editor): add CodeMirror split-pane editor panel"
```

---

## Task 10: Create PreviewPanel

**Files:**
- Create: `web/src/app/editor/PreviewPanel.tsx`

- [ ] **Step 1: Write PreviewPanel**

Create `web/src/app/editor/PreviewPanel.tsx`:

```typescript
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface PreviewPanelProps {
  markdownBody: string;
  title: string;
}

export function PreviewPanel({ markdownBody, title }: PreviewPanelProps) {
  return (
    <div className="p-3">
      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
        Preview
      </div>
      <div className="prose prose-sm prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {markdownBody}
        </ReactMarkdown>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/app/editor/PreviewPanel.tsx
git commit -m "feat(editor): add markdown preview panel"
```

---

## Task 11: Create PublishDialog

**Files:**
- Create: `web/src/app/editor/PublishDialog.tsx`

- [ ] **Step 1: Write PublishDialog**

Create `web/src/app/editor/PublishDialog.tsx`:

```typescript
"use client";

import { Button } from "@/components/ui/button";
import type { RuleFile } from "./types";

interface PublishDialogProps {
  rules: RuleFile[];
  onPublish: () => void;
  onCancel: () => void;
}

export function PublishDialog({ rules, onPublish, onCancel }: PublishDialogProps) {
  const draftRules = rules.filter((r) => r.has_draft);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold mb-4">Publish Changes</h3>
        <p className="text-sm text-muted-foreground mb-3">
          The following {draftRules.length} rule{draftRules.length !== 1 ? "s" : ""} will be written to disk and assembled:
        </p>
        <ul className="text-sm space-y-1 mb-4 max-h-48 overflow-y-auto">
          {draftRules.map((r) => (
            <li key={r.rule_id} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              {r.title}
              <span className="text-xs text-muted-foreground">({r.source_file})</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onPublish}>
            Publish {draftRules.length} Rule{draftRules.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/app/editor/PublishDialog.tsx
git commit -m "feat(editor): add publish confirmation dialog"
```

---

## Task 12: Create Editor page (main orchestration)

**Files:**
- Create: `web/src/app/editor/page.tsx`

- [ ] **Step 1: Write Editor page**

Create `web/src/app/editor/page.tsx`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { RuleFile } from "./types";
import { EditorLayout } from "./EditorLayout";
import { RuleListPanel } from "./RuleListPanel";
import { EditorPanel } from "./EditorPanel";
import { PreviewPanel } from "./PreviewPanel";
import { PublishDialog } from "./PublishDialog";

export default function EditorPage() {
  const [rules, setRules] = useState<RuleFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frontmatter, setFrontmatter] = useState("");
  const [body, setBody] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const selectedRule = rules.find((r) => r.rule_id === selectedId) ?? null;

  // Load rules on mount
  useEffect(() => {
    fetch("/api/editor/rules")
      .then((r) => r.json())
      .then((data) => {
        setRules(data.rules);
        if (data.rules.length > 0 && !selectedId) {
          setSelectedId(data.rules[0].rule_id);
        }
      });
  }, []);

  // Load selected rule content
  useEffect(() => {
    if (!selectedRule) return;

    fetch(`/api/editor/rules/${encodeURIComponent(selectedRule.rule_id)}/draft`)
      .then((r) => {
        if (r.status === 404) return null;
        return r.json();
      })
      .then((draft) => {
        if (draft) {
          setFrontmatter(draft.frontmatter_yaml);
          setBody(draft.markdown_body);
          setHasDraft(true);
        } else {
          setFrontmatter(selectedRule.frontmatter_yaml);
          setBody(selectedRule.markdown_body);
          setHasDraft(false);
        }
      });
  }, [selectedId, rules]);

  const handleSaveDraft = useCallback(async () => {
    if (!selectedId) return;
    await fetch(`/api/editor/rules/${encodeURIComponent(selectedId)}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        frontmatter_yaml: frontmatter,
        markdown_body: body,
      }),
    });
    setHasDraft(true);
    const res = await fetch("/api/editor/rules");
    const data = await res.json();
    setRules(data.rules);
  }, [selectedId, frontmatter, body]);

  const handleDiscardDraft = useCallback(async () => {
    if (!selectedId) return;
    await fetch(`/api/editor/rules/${encodeURIComponent(selectedId)}/draft`, {
      method: "DELETE",
    });
    setFrontmatter(selectedRule?.frontmatter_yaml ?? "");
    setBody(selectedRule?.markdown_body ?? "");
    setHasDraft(false);
    const res = await fetch("/api/editor/rules");
    const data = await res.json();
    setRules(data.rules);
  }, [selectedId, selectedRule]);

  const handleReorder = useCallback(async (items: Array<{ rule_id: string; order: number }>) => {
    await fetch("/api/editor/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items),
    });
    const res = await fetch("/api/editor/rules");
    const data = await res.json();
    setRules(data.rules);
  }, []);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      const res = await fetch("/api/editor/publish", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        alert(`Publish failed: ${data.error}`);
      } else {
        alert(`Published ${data.rulesChanged} rules successfully.`);
      }
    } catch (err) {
      alert(`Publish error: ${err}`);
    } finally {
      setPublishing(false);
      setShowPublish(false);
      const res = await fetch("/api/editor/rules");
      const refreshed = await res.json();
      setRules(refreshed.rules);
      setHasDraft(false);
    }
  }, []);

  const draftCount = rules.filter((r) => r.has_draft).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Rule Editor</h1>
          <p className="text-sm text-muted-foreground">
            Drag to reorder, edit, preview, and publish rule changes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <span className="text-xs text-orange-400">
              {draftCount} unsaved draft{draftCount !== 1 ? "s" : ""}
            </span>
          )}
          <Button
            onClick={() => setShowPublish(true)}
            disabled={draftCount === 0 || publishing}
          >
            Publish All
          </Button>
        </div>
      </div>

      <EditorLayout rules={rules}>
        {{
          ruleList: (
            <RuleListPanel
              rules={rules}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onReorder={handleReorder}
            />
          ),
          editor: selectedRule ? (
            <EditorPanel
              frontmatterYaml={frontmatter}
              markdownBody={body}
              hasDraft={hasDraft}
              onFrontmatterChange={setFrontmatter}
              onBodyChange={setBody}
              onSaveDraft={handleSaveDraft}
              onDiscardDraft={handleDiscardDraft}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a rule to edit
            </div>
          ),
          preview: selectedRule ? (
            <PreviewPanel markdownBody={body} title={selectedRule.title} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Preview
            </div>
          ),
        }}
      </EditorLayout>

      {showPublish && (
        <PublishDialog
          rules={rules}
          onPublish={handlePublish}
          onCancel={() => setShowPublish(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/zhiweiyin/repo_ds1600/claude-md-manager/.claude/worktrees/editor-design/web && npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/editor/page.tsx
git commit -m "feat(editor): add main editor page with draft/publish workflow"
```

---

## Task 13: Build verification and smoke test

**Files:** None (verification only)

- [ ] **Step 1: Full build check**

Run: `cd /Users/zhiweiyin/repo_ds1600/claude-md-manager/.claude/worktrees/editor-design/web && npx next build`
Expected: Build succeeds with no type errors.

- [ ] **Step 2: Python tests still pass**

Run: `cd /Users/zhiweiyin/repo_ds1600/claude-md-manager/.claude/worktrees/editor-design && python -m pytest tests/ -v`
Expected: All existing tests pass.

- [ ] **Step 3: Verify SQLite tables created**

Run: `cd /Users/zhiweiyin/repo_ds1600/claude-md-manager/.claude/worktrees/editor-design && python -c "from hooks.db import get_db; conn = get_db(); tables = [r[0] for r in conn.execute('SELECT name FROM sqlite_master WHERE type=\"table\"').fetchall()]; assert 'rule_drafts' in tables; assert 'publish_history' in tables; print('OK:', tables); conn.close()"`
Expected: `OK: [...]` containing both new tables.

- [ ] **Step 4: Final commit (if any fixes needed)**

---

## Self-Review

- **Spec coverage**: Data model (Task 1), UI layout (Tasks 7-12), API endpoints (Task 5), component tree (Tasks 7-11), publish flow (Task 12), error handling (in editor-db.ts publishDrafts), dependencies (Task 2), sidebar nav (Task 6). All spec sections covered.
- **Placeholder scan**: No TBD/TODO found. All code blocks contain actual implementation.
- **Type consistency**: `RuleFile` type used consistently across all components. API route params use `Promise<{ id: string }>` matching Next.js 16 async params pattern. `execFileSync` used instead of `execSync` for security.
