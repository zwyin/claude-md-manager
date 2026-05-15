# CLAUDE.md Manager — Design Spec

> Date: 2026-05-15
> Status: Self-reviewed, pending user review

## Background

Current `~/.claude/CLAUDE.md` is a 171-line monolithic file with 15 sections, no version control, no usage tracking. After reviewing [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills), we identified gaps (Surgical Changes, explicit assumption surfacing) and want to iterate CLAUDE.md more effectively.

## Goals

1. **Modular management** — Split CLAUDE.md into maintainable units with version control
2. **One-click rollback** — Any change can be reverted via git
3. **Visual dashboard** — Browse rules, see structure, view diffs in a local web app
4. **Citation tracking** — Know which rules are actually used in conversations, like paper citation counts
5. **Data-driven iteration** — Identify cold rules for removal and hot rules for refinement

## Non-Goals

- Multi-user collaboration (single user system)
- Cloud deployment (local only)
- Automated rule generation (human writes rules, system tracks them)

---

## Architecture

### Project Structure

```
repo_ds1600/claude-md-manager/
├── rules/                          # Modular rule source files
│   ├── 00_核心原则.md
│   ├── 10_任务分流.md
│   ├── 15_浏览器规则.md
│   ├── 20_Subagent策略.md
│   ├── 25_模型与并发限制.md
│   ├── 30_E2E测试策略.md
│   ├── 35_安全护栏.md
│   ├── 40_多轮独立Review.md
│   ├── 45_TDD与覆盖率标准.md
│   ├── 50_ChangeDeliveryGate.md
│   ├── 55_不要重复造轮子.md
│   └── 60_覆盖率门禁.md
├── build/
│   └── assemble.py                 # Build: rules/*.md → ~/.claude/CLAUDE.md
├── web/                            # Next.js visualization dashboard
│   ├── package.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Dashboard home
│   │   │   ├── rules/
│   │   │   │   ├── page.tsx        # Rules overview
│   │   │   │   └── [id]/page.tsx   # Rule detail
│   │   │   ├── history/page.tsx    # Version timeline
│   │   │   └── analytics/page.tsx  # Citation analytics
│   │   ├── components/
│   │   └── lib/
│   │       ├── db.ts               # SQLite reader
│   │       └── types.ts
│   └── ...
├── data/
│   ├── usage.db                    # SQLite: rule citation records
│   └── history/                    # Build snapshots for rollback
├── hooks/
│   └── session-logger.py           # Claude Code hook: log rule citations
├── scripts/
│   ├── init-history.py             # Import historical baseline from episodic memory
│   └── export-report.py            # Export reports
├── CLAUDE.md                       # This project's own CLAUDE.md
└── README.md
```

### Rule File Format

Each file in `rules/` uses YAML frontmatter + markdown body:

```markdown
---
id: task-triage
title: 任务分流
order: 10
tags: [workflow, triage]
rules:
  - id: task-triage.readonly
    title: 只读任务
    keywords: ["只读任务", "分析", "解释", "架构说明", "代码阅读"]
  - id: task-triage.light
    title: 轻量任务
    keywords: ["轻量任务", "单文件", "小范围修改", "明确bug修复"]
  - id: task-triage.medium
    title: 中任务
    keywords: ["中任务", "多文件", "新功能", "重构"]
  - id: task-triage.heavy
    title: 大任务
    keywords: ["大任务", "跨模块", "新架构", "公共API变更"]
---

## 任务分流

### 只读任务
- 分析、解释、架构说明、代码阅读 —— 直接处理。
- 真实 bug 排查但尚未修改 —— 用 systematic-debugging。

### 轻量任务
...
```

Key design decisions:
- **File name prefix** (`00_`, `10_`, ...) controls ordering
- **`rules` array** in frontmatter declares sub-rule IDs and keywords
- **`keywords`** per sub-rule drive both hook matching and search
- **Build script** strips frontmatter, concatenates bodies by order
- Sub-rule IDs follow pattern: `{section-id}.{sub-rule-slug}`

### New Rules to Add (from Karpathy comparison)

Based on the comparison analysis, two new rule files will be added:

**`07_手术刀原则.md`** (high priority):
```yaml
id: surgical-changes
order: 07
tags: [coding-style, changes]
rules:
  - id: surgical-changes.no-adjacent
    title: 不改相邻代码
    keywords: ["相邻代码", "adjacent", "格式化", "注释改进"]
  - id: surgical-changes.match-style
    title: 匹配现有风格
    keywords: ["匹配风格", "match style", "现有风格"]
  - id: surgical-changes.clean-own
    title: 只清理自己产生的孤儿
    keywords: ["孤儿代码", "dead code", "unused import"]
  - id: surgical-changes.trace-to-request
    title: 每行改动可追溯到用户请求
    keywords: ["trace", "追溯到", "diff膨胀"]
```

**`03_显式假设.md`** (medium priority):
```yaml
id: explicit-assumptions
order: 03
tags: [thinking, communication]
rules:
  - id: explicit-assumptions.state
    title: 逐条声明假设
    keywords: ["假设", "assumption", "不确定"]
  - id: explicit-assumptions.pushback
    title: 有更简方案时提出
    keywords: ["更简方案", "push back", "更简单"]
  - id: explicit-assumptions.stop-confused
    title: 不确定时停下来问
    keywords: ["不确定", "困惑", "confused", "stop and ask"]
```

---

## Component 1: Build System (assemble.py)

### Input → Output

```
rules/*.md → assemble.py → ~/.claude/CLAUDE.md
```

### Behavior

1. Scan `rules/` directory, sort by filename prefix
2. Parse YAML frontmatter from each file
3. Concatenate bodies (everything after frontmatter) in order
4. Prepend auto-generated header: `<!-- Built by claude-md-manager at YYYY-MM-DD HH:MM -->`
5. Write to `~/.claude/CLAUDE.md`
6. Save snapshot to `data/history/<timestamp>.md`
7. If content changed from previous build, auto-commit to git

### CLI Interface

```bash
# Normal build (write + snapshot + git commit)
python build/assemble.py

# Preview without writing
python build/assemble.py --dry-run

# Rollback to specific snapshot
python build/assemble.py --rollback 2026-05-15T19-30-00

# List available snapshots
python build/assemble.py --list-snapshots

# Validate all rule files (check IDs, keywords, format)
python build/assemble.py --validate
```

### Rollback Mechanism

Snapshots stored in `data/history/` with git. Rollback:
1. Find snapshot by timestamp
2. Copy snapshot content to `~/.claude/CLAUDE.md`
3. Log rollback event

---

## Component 2: Hook-Based Citation Tracking

### Hook Configuration

Registered in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "python /path/to/claude-md-manager/hooks/session-logger.py"
      }]
    }]
  }
}
```

### Tracking Logic

**Decision**: Claude Code PostToolUse hooks receive tool context (name, input, output), NOT full conversation transcripts. Our hook will read the current session's JSONL file directly from `~/.claude/projects/` directory instead.

1. Hook fires on session end (Stop event or PostToolUse with empty matcher)
2. Script locates the current session's JSONL file in `~/.claude/projects/*/conversations/`
3. Session ID = JSONL filename (contains timestamp and unique ID)
4. Script loads keyword mapping from all rule files' frontmatter
5. Scans the session JSONL content for keyword matches (assistant messages only)
6. Records matches to SQLite with timestamp, session ID, matched keyword
7. Deduplicates: if same keyword matches multiple times in one session, count as 1 reference

### SQLite Schema

```sql
CREATE TABLE rule_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    matched_keyword TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rule_id) REFERENCES rules_metadata(rule_id)
);

CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    started_at DATETIME,
    ended_at DATETIME,
    model TEXT,
    task_summary TEXT
);

CREATE TABLE rules_metadata (
    rule_id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    title TEXT NOT NULL,
    keywords TEXT,              -- JSON array
    source_file TEXT NOT NULL,
    updated_at DATETIME
);

CREATE INDEX idx_refs_rule ON rule_references(rule_id);
CREATE INDEX idx_refs_time ON rule_references(timestamp);
CREATE INDEX idx_refs_session ON rule_references(session_id);
```

### Historical Baseline Import

`scripts/init-history.py`:
1. Scan episodic memory for past conversations
2. Apply same keyword matching logic
3. Import results with estimated timestamps
4. Mark as "historical" source in session_id prefix

---

## Component 3: Next.js Dashboard

### Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Data**: SQLite via better-sqlite3 (server-side)
- **Markdown**: react-markdown + remark-gfm

### Pages

#### `/` Dashboard Home
- Total rules count, total citations, active rule percentage
- 7-day citation trend (line chart)
- Cold rule alerts (rules with 0 citations in 30 days)
- Recent build changes

#### `/rules` Rules Overview
- Tree view: category → section → sub-rules (2 levels)
- Each node shows citation count badge
- Expandable rule text (rendered markdown)
- Search bar + tag filter
- Sort by: name, citations (desc/asc), last updated

#### `/rules/[id]` Rule Detail
- Full rule text (markdown rendered)
- Citation trend chart (daily/weekly/monthly toggle)
- Related rules (shared tags or co-occurring in sessions)
- Git history for this rule's source file
- Edit button → opens file in editor

#### `/history` Version Timeline
- Chronological list of builds
- Each entry: timestamp, changed rules, diff summary
- Click to expand inline diff view
- One-click rollback button (calls assemble.py)

#### `/analytics` Citation Analytics
- Top 10 rules bar chart (most cited)
- Bottom 10 rules (cold rules)
- Citation distribution by category (pie chart)
- Heatmap: rules × time period
- New vs deprecated rules trend

### API Routes

```
GET /api/rules          → List all rules with citation counts
GET /api/rules/[id]     → Single rule detail + citation data
GET /api/citations      → Citation time series (filterable by rule, date range)
GET /api/history        → Build history list
GET /api/history/[ts]   → Specific snapshot diff
POST /api/rollback/[ts] → Trigger rollback
GET /api/analytics      → Aggregated analytics data
```

---

## Implementation Phases

### Phase 1: Core (assemble.py + rules split)
- Initialize git repo in claude-md-manager/
- Split current CLAUDE.md into modular files
- Implement assemble.py (build, validate, dry-run)
- Add new Karpathy-inspired rules (surgical-changes, explicit-assumptions)
- First build → verify output matches original CLAUDE.md + new rules

### Phase 2: Hook Tracking
- Implement session-logger.py
- Register hook in settings.json
- Implement init-history.py for baseline import
- Verify hook fires and records data

### Phase 3: Dashboard
- Scaffold Next.js project
- Implement SQLite data layer
- Build Dashboard + Rules pages
- Build History page
- Build Analytics page

### Phase 4: Polish
- README with usage instructions
- CLAUDE.md for the project itself
- Testing (assemble.py unit tests, hook integration test)

---

## Success Criteria

1. `assemble.py` builds identical output from modular files
2. `assemble.py --rollback <ts>` restores any previous version
3. Hook records citations within 5 seconds of session end
4. Dashboard shows all rules with citation counts
5. Git log shows every CLAUDE.md change with diff
6. Cold rules (unused for 30+ days) are visually flagged
