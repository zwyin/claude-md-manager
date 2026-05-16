# CLAUDE.md Manager

> Modular management for your `~/.claude/CLAUDE.md` — version control, citation tracking, and a visual dashboard.

[中文文档](#中文文档)

---

## Features

- **Modular Rules** — Split your CLAUDE.md into individual files with YAML frontmatter. Each file declares sub-rules and keywords for tracking.
- **Build System** — One command assembles all rules into `~/.claude/CLAUDE.md`, sorted and versioned with git snapshots.
- **Citation Tracking** — A Claude Code hook scans session logs and records which rules are actually referenced, with keyword-level granularity.
- **Visual Dashboard** — A Next.js web app showing section-level aggregation, top rules, cold rules, citation history, and analytics.
- **One-command Rollback** — Every build creates a snapshot. Roll back to any previous version instantly.

## Quick Start

### Prerequisites

- Python 3.10+ with `pyyaml`
- Node.js 20+ (for the dashboard)

### Install

```bash
git clone https://github.com/zwyin/claude-md-manager.git
cd claude-md-manager
pip install pyyaml   # Python dependency
cd web && npm install # Dashboard dependencies
```

### Build CLAUDE.md

```bash
# Build and write to ~/.claude/CLAUDE.md
python build/assemble.py

# Preview without writing
python build/assemble.py --dry-run

# Validate all rule file formats
python build/assemble.py --validate

# List available snapshots
python build/assemble.py --list-snapshots

# Rollback to a snapshot
python build/assemble.py --rollback 2026-05-15T21-38-58
```

### Start the Dashboard

```bash
cd web && npm run dev    # Development: http://localhost:3456
cd web && npm run build  # Production build
```

For auto-start on macOS, see `scripts/setup-launchd.sh`.

### Register the Citation Hook

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "python3 /path/to/claude-md-manager/hooks/session-logger.py"
      }]
    }]
  }
}
```

Then sync rule metadata into the database:

```bash
python hooks/session-logger.py --sync-metadata
```

## Rule File Format

Each file in `rules/` uses YAML frontmatter + Markdown:

```yaml
---
id: task-triage
title: Task Triage
order: 10
tags: [workflow, triage]
rules:
  - id: task-triage.readonly
    title: Read-only Tasks
    keywords: ["read-only", "analyze", "explain", "architecture"]
  - id: task-triage.light
    title: Light Tasks
    keywords: ["light task", "single file", "bug fix"]
---

## Task Triage

### Read-only Tasks
- Analysis, explanation, code reading — handle directly.

### Light Tasks
- Single-file changes, clear bug fixes, config tweaks.
```

The build script:
1. Scans `rules/*.md`, sorts by `order`
2. Strips frontmatter, concatenates Markdown bodies
3. Adds a timestamp header
4. Writes to `~/.claude/CLAUDE.md` + saves a snapshot

## Architecture

```
rules/*.md        → YAML frontmatter + Markdown body
build/assemble.py → Sort by order, concatenate → ~/.claude/CLAUDE.md + snapshot
hooks/            → session-logger.py (PostToolUse hook) → SQLite citations
web/              → Next.js 16 + shadcn/ui dashboard
data/usage.db     → SQLite (rule metadata + citations + sessions)
data/history/     → Build snapshots for rollback
```

### Dashboard Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Stats cards + Sections overview + Top 10 rules + Cold rules |
| Rules | `/rules` | All rules grouped by section, collapsible |
| Rule Detail | `/rules/[id]` | Single rule + keywords + citation records + sibling rules |
| History | `/history` | Rule metadata grouped by update date |
| Analytics | `/analytics` | Top 10 chart + category distribution |

### Dashboard Tech Stack

- Next.js 16 + React 19 + Tailwind CSS v4
- **shadcn/ui** (Radix UI primitives) — Card, Table, Badge, Sidebar, Collapsible
- better-sqlite3 (server-side, read-only)

## Design Docs

- [English](docs/specs/2026-05-15-claude-md-manager-design.md)
- [Chinese](docs/specs/2026-05-15-claude-md-manager-design.zh.md)

## Development

```bash
# Run tests
python -m pytest tests/ -v

# Build dashboard
cd web && npm run build

# Sync rule metadata
python hooks/session-logger.py --sync-metadata
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)

---

<a id="中文文档"></a>

# CLAUDE.md Manager（中文）

> 模块化管理 `~/.claude/CLAUDE.md` — 版本控制、引用追踪、可视化仪表盘。

## 功能

- **模块化规则** — 将 CLAUDE.md 拆分为独立文件，YAML frontmatter 声明子规则和关键词
- **构建系统** — 一条命令按顺序拼接所有规则，写入 `~/.claude/CLAUDE.md` 并创建 git 快照
- **引用追踪** — Claude Code Hook 扫描会话日志，记录哪些规则被实际引用
- **可视化仪表盘** — Next.js Web 应用，展示章节聚合、热门规则、冷门规则、引用历史
- **一键回滚** — 每次构建创建快照，可回滚到任意历史版本

## 快速开始

```bash
# 安装
git clone https://github.com/zwyin/claude-md-manager.git
cd claude-md-manager
pip install pyyaml
cd web && npm install

# 构建 CLAUDE.md
python build/assemble.py              # 构建 + 快照 + git commit
python build/assemble.py --dry-run    # 预览（不写文件）
python build/assemble.py --validate   # 校验规则文件
python build/assemble.py --rollback 2026-05-15T21-38-58  # 回滚

# 启动仪表盘
cd web && npm run dev                 # 开发模式 http://localhost:3456
```

## 架构

```
rules/*.md        → YAML frontmatter + Markdown 正文
build/assemble.py → 按 order 排序拼接 → ~/.claude/CLAUDE.md + 快照
hooks/            → session-logger.py (PostToolUse) → SQLite 引用记录
web/              → Next.js 16 + shadcn/ui 仪表盘
data/usage.db     → SQLite (规则元数据 + 引用记录 + 会话信息)
data/history/     → 构建快照（用于回滚）
```

## 设计文档

- [英文版](docs/specs/2026-05-15-claude-md-manager-design.md)
- [中文版](docs/specs/2026-05-15-claude-md-manager-design.zh.md)

## 许可证

[MIT](LICENSE)
